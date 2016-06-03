var taffyTsClient = require('./taffy-typescript-client');

if (process.argv.length < 5) {
    console.log('Usage: node index.js [sourceFolder] [outputFolder] [serviceName]');
    return 1;
}

taffyTsClient({
    srcDir: process.argv[2],
    outDir: process.argv[3],
    serviceName: process.argv[4]
});
