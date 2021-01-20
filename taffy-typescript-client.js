var fs = require('fs');
var path = require('path');
var Parser = require('xml2js').Parser;
var parser = new Parser();

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
        }

        clientPromises.push(generateClient(contents, endpointName));
    }

    try {
        fs.statSync(options.outDir);
    } catch (e) {
        fs.mkdir(options.outDir);
    }

    Promise.all(tsdPromises)
        .then(
            result => writeTsdFile(path.resolve(options.outDir, 'taffy-typescript-client-interfaces.ts'), result.join('\n'), endpointNames, options),
            err => console.log('Error occurred while generating client', err)
        );

    Promise.all(clientPromises)
        .then(
            result => writeClientFile(path.resolve(options.outDir, 'taffy-typescript-client.ts'), result, options),
            err => console.log('Error occurred while generating client', err)
        );
}

function writeClientFile(fileName, endpoints, options) {
    var endpointsStr = endpoints.filter(l => !!l).join(';\n');
    
    var out = `
    import * as Interfaces from './taffy-typescript-client-interfaces';
    
    export class ${options.serviceName}<TResult> {
        constructor(protected taffyTypescriptHttpService: Interfaces.TaffyHttpClientProvider<TResult>) {
        }

        ${endpointsStr}
    }
        
    ${getCreateFunction()}
`;

    fs.writeFile(fileName, out, (err) => {
        if (err) {
            console.log(`Error while writing ${fileName}`, err);
        }
    });
}

function writeTsdFile(fileName, tsdStr, endpoints, options) {
    var tsdOut = `
        export interface TaffyHttpClientProvider<TResult> {
            get(url: string, options: any): TResult;
            delete(url: string, options: any): TResult;
            put(url: string, data: any, options: any): TResult;
            patch(url: string, data: any, options: any): TResult;
            post(url: string, data: any, options: any): TResult;    
        }

        ${tsdStr}
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
 * @param endpointName
 * @returns {Promise|Promise<T>}
 */
function readFileAsJsObject(fileContents, endpointName) {
    var filteredXml = filterFunctions(fileContents);
    var errorListener = function (error) {
        console.log({
            message: 'Error while processing ' + endpointName,
            error: error
        });
    };

    var promise = new Promise((resolve, reject) => {
        parser.addListener('error', errorListener);

        parser.parseString(filteredXml, (err, result) => {
            if (err) {
                reject(err);
            } else {
                resolve(result);
            }

            parser.removeListener('error', errorListener);
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
    return readFileAsJsObject(fileContents, endpointName)
        .then(result => extractTsd(result, endpointName));
}

/**
 *
 * @param fileContents
 * @param endpointName
 * @returns {Promise<TResult>|Promise.<TResult>}
 */
function generateClient(fileContents, endpointName) {
    return readFileAsJsObject(fileContents, endpointName)
        .then(componentObj => {
            if (!componentObj.cfcomponent.$.taffy_uri) {
                return '';
            }

            var url = (componentObj.cfcomponent.$.taffy_uri).replace('//', '/');
            return `${endpointName}: Interfaces.${endpointName}<TResult> = create<TResult>(this.taffyTypescriptHttpService, "${cleanUpUrlParam(url)}")`;
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
            .map(arg => format("{0}{1}: {2}", arg.name, (arg.required === 'false' || verb.name.toLowerCase() === 'patch' ? "?" : ""), TYPES_MAP[arg.type]))
            .join(', ');

        var methodName = "do" + capitalize(verb.name);

        return `${methodName}: (data?: { ${verbArgs} }, options?: any) => TResult`;
    }).join('\n');

    ////////// Interface
    var resourceVars = endpoint.arguments.map(a => cleanUpUrlParam(a) + ': string | number').join(', ');
    
    return `
        export interface ${endpointName}<TResult> {
            (${resourceVars}): {
                ${methods}
                url: string;
            }
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

function cleanUpUrlParam(param) {
    return param.replace(':.+', '');
}

/** client code **/
function getCreateFunction() {
    return `
    function create<TResult>(taffyTypescriptHttpService: any, url: string) {
        return function () {
            var args = Array.prototype.slice.call(arguments);
            var formattedUrl = format(url, args);
            return {
                doGet: function (data: any, options: any): TResult { return taffyTypescriptHttpService.get(formattedUrl + encodeQueryData(data), options) },
                doDelete: function (data: any, options: any): TResult { return taffyTypescriptHttpService.delete(formattedUrl + encodeQueryData(data), options) },
                doPost: function (data: any, options: any): TResult { return taffyTypescriptHttpService.post(formattedUrl, data, options) },
                doPatch: function (data: any, options: any): TResult { return taffyTypescriptHttpService.patch(formattedUrl, data, options) },
                doPut: function (data: any, options: any): TResult { return taffyTypescriptHttpService.put(formattedUrl, data, options) },
                url: formattedUrl
            }
        }
    
        function encodeQueryData(data: any) {
            var ret = [];
            for (var d in data) {
                ret.push(encodeURIComponent(d) + "=" + encodeURIComponent(data[d]));
            }
            return (ret.length > 0) ? "?" + ret.join("&") : '';
        }
    
        function format(str: string, args: any) {
            while (str.match(/{([\\w\\d]+)}/)) {
                str = str.replace(/{([\\w\\d]+)}/, args.shift());
            }
            return str;
        }
    }    
`;
}

module.exports = main;
