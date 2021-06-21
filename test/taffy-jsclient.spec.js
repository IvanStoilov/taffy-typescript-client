var fs = require('fs');
var expect = require('chai').expect;
var ts = require('typescript');
var rimraf = require('rimraf');

describe('taffy-typescript-client', () => {
  var taffyJsClient = require('../taffy-typescript-client');

  var clientStr;
  var TestResource;

  before('', (done) => {
    var fileContents = fs.readFileSync('./test/fixtures/fixture2.cfc', 'utf8');
    var options = {
      srcDir: './test/fixtures',
      outDir: './test/out',
      serviceName: 'TestClient'
    };

    rimraf('./test/out', () => {
      taffyJsClient(options);
      getContents();
    });

    function getContents() {
      try {
        clientStr = fs.readFileSync('./test/out/taffy-typescript-client.ts', 'utf8');
        done();
      } catch (err) {
        setTimeout(getContents, 100);
      }
    }
  });

  it('should return some client', () => {
    expect(clientStr).to.be.ok;
  });

  it('should include all the endpoints', () => {
    [
      `fixture1: Interfaces.fixture1<TResult> = create<TResult>(this.taffyTypescriptHttpService, "/admin/sd/stats")`,
      `fixture2: Interfaces.fixture2<TResult> = create<TResult>(this.taffyTypescriptHttpService, "/app/{companyId}/sd/tickets/{ticketId}/comments")`,
      `fixture3: Interfaces.fixture3<TResult> = create<TResult>(this.taffyTypescriptHttpService, "/app/{companyId}/em/users/{userId}/presences/{date}")`
    ].forEach(endpoint => {
        expect(clientStr).to.contain(endpoint);
    });
  });

  it('should return a client that compiles', () => {
    var js = ts.createProgram(['./test/out/taffy-typescript-client-interfaces.ts', './test/out/taffy-typescript-client.ts'], {});
    var problems = js.getSemanticDiagnostics();
    var errors = problems.map(p => `"${p.messageText}" in ${p.file.fileName}`);
    expect(errors).to.deep.equal([]);
  });

  it('should return a client that compiles and is valid', () => {
    var js = ts.transpile(clientStr);
    eval(js.replace('"use strict";', ''));
    expect(TestClient).to.be.ok;
  });
});
