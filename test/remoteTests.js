import {expect} from 'chai';
import {Proxy as RPCProxy} from '../client';
import {serviceManager} from './testServer';

function remoteTests(client) {
  it('should get the current counter value', done => {
    client.call(null, 'get').then(resp => {
      expect(resp.result).to.exist;
      expect(resp.error).to.not.exist;
      expect(resp.jsonrpc).to.equal('2.0');
      done();
    }).catch(done);
  });

  it('should accept arguments and send returns', done => {
    client.call(null, 'set', [5]).then(resp => {
      return client.call(null, 'get');

    }).then(resp => {
      expect(resp.result).to.equal(5);
      done();

    }).catch(done);
  });

  it('should gracefully handle undefined returns', done => {
    client.call(null, 'returnsUndefined').then(resp => {
      expect(resp.result).to.not.exist;
      expect(resp.error).to.not.exist;
      done();

    }).catch(done);
  });

  it('should gracefully fail unknown methods', done => {
    client.call(null, 'doesntExist').then(resp => {
      expect(resp.result).to.not.exist;
      expect(resp.error).to.exist;
      expect(resp.error.code).to.equal(-32601);
      done();

    }).catch(done);
  });

  it('should be able to client.call methods that return promises', done => {
    client.call(null, 'returnsPromise', ['test']).then(resp => {
      expect(resp.result).to.equal('test');
      done();
    }).catch(done);
  });

  it('should handle server-side exceptions', done => {
    client.call(null, 'throwsException').then(resp => {
      expect(resp.result).to.not.exist;
      expect(resp.error).to.exist;
      expect(resp.error.message).to.equal('This is an exception!');
      done();
    }).catch(done);
  });

  it('should not recieve returns from notifications', done => {
    client.notify(null, 'set', [2]).then((v) => {
      expect(v).to.not.exist;
      done();
    }).catch(done);
  });

  it('should be able to call non-default services', done => {
    client.call('echo', 'echo', ['foobar']).then(resp => {
      expect(resp).to.exist;
      expect(resp.result).to.equal('foobar');
      done();
    }).catch(done);
  });

  it('should work with proxies for the default service', done => {
    let service = new RPCProxy(client, null, 'set', 'get');
    service.set(25).then(() => {
      return service.get();
    }).then(v => {
      expect(v).to.equal(25);
      done();
    }).catch(done);
  });

  it('should work with proxies for named services', done => {
    let service = new RPCProxy(client, 'echo', 'echo');
    service.echo('proxyTest').then(r => {
      expect(r).to.equal('proxyTest');
      done();
    }).catch(done);
  });

  it('should rethrow server exceptions when using a proxy', done => {
    let service = new RPCProxy(client, null, 'throwsException');
    service.throwsException().then(() => {
      done(new Error('Exception not thrown.'));
    }).catch(e => {
      expect(e.message).to.equal('This is an exception! (-32000)');
      done();
    });
  });

  it('should take a call object natively', done => {
    client.call('echo', {method: 'echo', params: ['callObjectTest']}).then(r => {
      expect(r.result).to.equal('callObjectTest');
      done();
    }).catch(done);
  });

  it('should handle batch requests', done => {
    client.call(null, [
      {method: 'set', params: [5]},
      {method: 'get'}
    ]).then(arr => {
      expect(arr).to.be.instanceof(Array);
      expect(arr.length).to.equal(2);
      expect(arr[1].result).to.equal(5);
      done();
    }).catch(done);
  });

  describe('Client Events', () => {
    afterEach(() => {
      client.removeAllListeners('request');
      client.removeAllListeners('sending');
      client.removeAllListeners('received');
      client.removeAllListeners('response');
    });

    it('should emit sending events', done => {
      client.on('request', () => done());
      client.on('sending', () => done());
      client.call(null, 'get');
    });

    it('should emit recieving events', done => {
      client.on('received', () => done());
      client.on('response', () => done());
      client.call(null, 'get');
    });
  });

  describe('Server Events', () => {
    afterEach(() => {
      serviceManager.removeAllListeners('requestReceived');
      serviceManager.removeAllListeners('methodExecuted');
      serviceManager.removeAllListeners('methodSucceeded');
      serviceManager.removeAllListeners('methodFailed');
      serviceManager.removeAllListeners('methodCompleted');
    });

    it('should emit requestReceived', done => {
      serviceManager.on('requestReceived', () => done());
      client.call(null, 'get');
    });

    it('should emit methodExecuted', done => {
      serviceManager.on('methodExecuted', () => done());
      client.call(null, 'get');
    });

    it('should emit methodSucceeded', done => {
      serviceManager.on('methodSucceeded', () => done());
      client.call(null, 'get');
    });

    it('should emit methodFailed', done => {
      serviceManager.on('methodFailed', () => done());
      client.call(null, 'throwsException');
    });

    it('should emit methodFailed for bad method names', done => {
      serviceManager.on('methodFailed', () => done());
      client.call(null, 'badMethodName');
    });

    it('should emit methodCompleted on success', done => {
      serviceManager.on('methodCompleted', () => done());
      client.call('echo', 'echo', 'hi');
    });

    it('should emit methodCompleted on exception', done => {
      serviceManager.on('methodCompleted', () => done());
      client.call(null, 'throwsException');
    });

    it('should emit methodCompleted on bad method name', done => {
      serviceManager.on('methodCompleted', () => done());
      client.call(null, 'xyz');
    });

  });
}

export default remoteTests;
