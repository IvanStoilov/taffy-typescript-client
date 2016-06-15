var fs = require('fs');
var path = require('path');
var parseString = require('xml2js').parseString;

var TYPES_MAP = {
    array: 'any[]',
    date: 'string',
    string: 'string',
    numeric: 'number',
    boolean: 'boolean',
    struct: 'Object'
};

function main(options) {
    var files = fs.readdirSync(options.srcDir);

    var tsdPromises = [];
    var clientPromises = [];
    var endpointNames = [];

    if (!options.exclude) {
        options.exclude = [];
    }

    for (var i in files) {
        var fileName = path.resolve(options.srcDir, files[i]);

        var contents = fs.readFileSync(fileName, 'utf-8');

        var endpointName = path.basename(fileName, path.extname(fileName));

        if (options.exclude.indexOf(endpointName) === -1) {
            endpointNames.push(endpointName);
            console.log(`Processing ${endpointName}`);

            tsdPromises.push(generateTsd(contents, endpointName));
            clientPromises.push(generateClient(contents, endpointName));
        }
    }

    try {
        fs.statSync(options.outDir);
    } catch (e) {
        fs.mkdir(options.outDir);
    }

    Promise.all(tsdPromises)
        .then(
            result => writeTsdFile(path.resolve(options.outDir, 'taffy-typescript-client.d.ts'), result.join('\n'), endpointNames, options),
            err => console.log('Error occurred while generating client', err)
        );

    Promise.all(clientPromises)
        .then(
            result => writeClientFile(path.resolve(options.outDir, 'taffy-typescript-client.js'), result, options),
            err => console.log('Error occurred while generating client', err)
        );
}

function writeClientFile(fileName, endpoints, options) {
    var endpointsStr = endpoints.filter(l => !!l).join(',\n');
    var createFunction = create.toString();

    var out = `
        angular
            .module('taffy-typescript-client', [])
            .service('taffyTypescriptHttpService', function () { })
            .service('${options.serviceName}', ['taffyTypescriptHttpService', function (taffyTypescriptHttpService) {
                return {
                    ${endpointsStr}
                };
                
                ${createFunction}
            }]);
`;

    fs.writeFile(fileName, out, (err) => {
        if (err) {
            console.log(`Error while writing ${fileName}`, err);
        }
    });
}

function writeTsdFile(fileName, tsdStr, endpoints, options) {
    var endpointsStr = endpoints.map(endpoint => `${endpoint}: I${endpoint};`).join('\n');

    var tsdOut = `
        declare module "taffy-typescript-client" {
          ${tsdStr}
        
          interface I${options.serviceName} {
            ${endpointsStr}
          }
        }
`;

    fs.writeFile(fileName, tsdOut, (err) => {
        if (err) {
            console.log(`Error while writing ${fileName}`, err);
        }
    });
}


/**
 *
 * @param fileContents
 * @returns {Promise|Promise<T>}
 */
function readFileAsJsObject(fileContents) {
    var filteredXml = filterFunctions(fileContents);

    var promise = new Promise((resolve, reject) => {
        parseString(filteredXml, (err, result) => {
            if (err) {
                reject(err);
            } else {
                resolve(result);
            }
        });
    });

    return promise;
}

/**
 *
 * @param fileContents
 * @param endpointName
 * @returns {Promise<TResult>|Promise.<TResult>}
 */
function generateTsd(fileContents, endpointName) {
    return readFileAsJsObject(fileContents)
        .then(result => extractTsd(result, endpointName));
}

/**
 *
 * @param fileContents
 * @param endpointName
 * @returns {Promise<TResult>|Promise.<TResult>}
 */
function generateClient(fileContents, endpointName) {
    return readFileAsJsObject(fileContents)
        .then(componentObj => {
            if (!componentObj.cfcomponent.$.taffy_uri) {
                return '';
            }

            var url = (componentObj.cfcomponent.$.taffy_uri).replace('//', '/');
            return `${endpointName}: create("${url}")`;
        });
}

function extractTsd(obj, endpointName) {
    var component = obj.cfcomponent;

    if (!component.$.taffy_uri) {
        return "";
    }

    var endpoint = {
        name: endpointName,
        url: component.$.taffy_uri,
        arguments: component.$.taffy_uri.split('/').filter(startsWithBracket).map(stripBrackets),
        verbs: component.cffunction
            .filter(func => func.$.access === 'public')
            .map(func => ({
                    name: func.$.name,
                    arguments: !func.cfargument ? [] : func.cfargument.map(item => item.$)
                })
            )
    };

    ////////// Methods

    var methods = endpoint.verbs.map(verb => {
        var verbArgs = verb.arguments
            .filter(arg => endpoint.arguments.indexOf(arg.name) === -1)
            .map(arg => format("{0}{1}: {2}", arg.name, (arg.required == 'true' ? "?" : ""), TYPES_MAP[arg.type]))
            .join(', ');

        var methodName = "do" + capitalize(verb.name);

        return `${methodName}: (data?: { ${verbArgs} }, options?: any) => ng.IPromise<any>`;
    }).join('\n');

    ////////// Interface
    var resourceVars = endpoint.arguments.join(', ');
    
    return `
        interface I${endpointName} {
          (${resourceVars}) : {
            ${methods}
            url: string;
          };
        }
    `;
}
function format(string, args) {
    for (var i = 1; i < arguments.length; i++) {
        string = string.replace('{'+(i-1)+'}', arguments[i]);
    }

    return string;
}

function startsWithBracket(str) {
    return typeof str === 'string' && str.length > 0 && str[0] === '{';
}

function stripBrackets(item) {
    return item.replace(/[\{\}]/g, '');
}

function capitalize(str) {
    if (str.length === 0) {
        return str;
    }

    return str.substr(0, 1).toUpperCase() + str.substr(1);
}

function filterFunctions(fileContents) {
    return fileContents
        .split("\n")
        .filter(line => /(cfcomponent|cffunction|cfargument)/i.test(line))
        .map(line => line.replace(/<!--- .* --->/i, ''))
        .join("\n");
}

/** client code **/
var taffyTypescriptHttpService;

function create(url) {
    return function () {
        var args = Array.prototype.slice.call(arguments);
        return {
            doGet: (data, options) => taffyTypescriptHttpService.get(format(url, args) + encodeQueryData(data), options),
            doDelete: (data, options) => taffyTypescriptHttpService.delete(format(url, args) + encodeQueryData(data), options),
            doPost: (data, options) => taffyTypescriptHttpService.post(format(url, args), data, options),
            doPatch: (data, options) => taffyTypescriptHttpService.get(format(url, args), data, options),
            doPut: (data, options) => taffyTypescriptHttpService.post(format(url, args), data, options),
            url: url
        }
    }

    function encodeQueryData(data)
    {
        var ret = [];
        for (var d in data) {
            ret.push(encodeURIComponent(d) + "=" + encodeURIComponent(data[d]));
        }
        return (ret.length > 0) ? "?" + ret.join("&") : '';
    }

    function format(str, args) {
        while (str.match(/{([\w\d]+)}/)) {
            str = str.replace(/{([\w\d]+)}/, args.shift());
        }
        return str;
    }
}

module.exports = main;
