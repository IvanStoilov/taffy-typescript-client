var parseString = require('xml2js').parseString;

var TYPES_MAP = {
    array: 'any[]',
    date: 'string',
    string: 'string',
    numeric: 'number',
    boolean: 'boolean'
};

function parseFile(fileContents, endpointName, baseUrl, callback) {
    var filteredXml = filterFunctions(fileContents);
    
    parseString(filteredXml, (err, result) => {
        if (err) {
            callback(err, null);
        } else {
            callback(null, generateClient(result, endpointName, baseUrl));
        }
    });
}

function generateClient(obj, endpointName, baseUrl) {
    var component = obj.cfcomponent;

    if (!component.$.taffy_uri) {
        return "";
    }

    var endpoint = {
        name: endpointName,
        url: component.$.taffy_uri,
        arguments: component.$.taffy_uri.split('/').filter(startsWithBracket).map(stripBrackets),
        verbs: component.cffunction.map(func => ({
                name: func.$.name,
                arguments: !func.cfargument ? [] : func.cfargument.map(item => item.$)
            })
        )
    };

    ////////// Methods

    var methods = endpoint.verbs.map(verb => {
        var verbArgs = verb.arguments.map(arg => {
            return format("{0}{1}: {2}", arg.name, (arg.required == 'true' ? "?" : ""), TYPES_MAP[arg.type]);
        });

        var methodBody = '';
        if (verb.name.match(/(post|put|patch)/i)) {
            methodBody = format('    return this.{0}(this.url, data, options);', verb.name);
        } else {
            methodBody = format('    return this.{0}(this.url + this.encodeQueryData(data), options);', verb.name)
        }
        var methodName = "do" + capitalize(verb.name);

        return format("  public {0}(data?: {{1}}, options?) {\n{2}\n  }\n", methodName, verbArgs.join('; '), methodBody);
    });

    ////////// Class

    var classArgs = endpoint.arguments;
    var body = format(
        '  public url : string = "' + baseUrl + '{0}".replace(/{(\\d*)}/g, (match, key) => [{2}][key]);\n\n{3}',
        endpoint.url,
        classArgs.map((i, key) => `'{${key}}'`).join(', '),
        classArgs.map(i => `'${i}'`).join(', '),
        methods.join('')
    );

    var classData = format("  constructor({0}) { super(); }\n\n", (classArgs.length > 0 ? 'private ' : '') + classArgs.join(', private '));
    classData += body;

    var toReturn = "class " + endpoint.name + " extends BaseResource { \n\n" + classData + "}\n";

    return toReturn;
}

function format(string, args)
{
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
        .join('');
}

module.exports = parseFile;
