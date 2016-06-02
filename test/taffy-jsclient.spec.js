var fs = require('fs');
var expect = require('chai').expect;
var ts = require('typescript');

describe('taffy-typescript-client', () => {
  var taffyJsClient = require('../taffy-typescript-client');

  var baseResourceStr = `
    class BaseResource {
      protected encodeQueryData(data) {};
      protected get(url, options? : any) {}
      protected post(url, data? : any, options? : any) {}
    }
  `;

  var clientStr;
  var TestResource;

  beforeEach('', (done) => {
    var fileContents = fs.readFileSync('./test/fixtures/fixture2.cfc', 'utf8');
    taffyJsClient(fileContents, 'TestResource', 'http://example.com', (err, jsClient) => {
      clientStr = jsClient;
      done();
    });
  });

  it('should return a some client', () => {
    expect(clientStr).to.be.ok;
  });
  
  it('should return a client that compiles', () => {
    var clientJs = ts.transpile(clientStr);
    expect(clientJs).to.be.ok;
  });

  it('should return a client that compiles and is valid', () => {
    var js = ts.transpile(baseResourceStr + clientStr);

    eval(js.replace('"use strict";', ''));

    expect(TestResource).to.be.ok;
  });
});
