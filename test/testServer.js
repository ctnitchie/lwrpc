import http from 'http';
import socketio from 'socket.io';
import express from 'express';
import path from 'path';
import bodyParser from 'body-parser';

import * as rpc from '../src/server';

class TestService {
  constructor() {
    this.val = 0;
  }
  get() {
    return this.val;
  }
  set(v) {
    let curVal = this.val;
    this.val = v;
    return curVal;
  }
  returnsPromise(v) {
    return new Promise(resolve => {
      setTimeout(() => resolve(v), 20);
    });
  }
  returnsUndefined() {}
  throwsException() {
    throw new Error('This is an exception!');
  }
}
class EchoService {
  echo(v) {
    return v;
  }
}
const serviceManager = new rpc.ServiceManager(new TestService());
serviceManager.registerService('echo', new EchoService());

const app = express();
app.set('port', 2999);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'static')));
app.use(express.static(path.join(__dirname, '../dist/browser')));
app.use('/services', rpc.expressBinding(express.Router(), {serviceManager}));
app.use('/rpc', rpc.expressBinding(express.Router(), {serviceManager, mode: 'methodPrefix'}));

const server = http.createServer(app);
server.listen(2999);

const io = socketio(server);
rpc.socketioBinding(io, serviceManager);

export {app, server, io, serviceManager};
