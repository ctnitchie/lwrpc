import 'babel-polyfill';
import './testServer';
import remoteTests from './remoteTests';
import io from 'socket.io-client';

import {HTTPClient, SocketClient} from '../client';

const httpClient = new HTTPClient('http://localhost:2999/rpc/');
const socketClient = new SocketClient(io('http://localhost:2999'));

// Client uses the 'fetch' API
import fetch from 'node-fetch';
global.fetch = fetch;

describe('lwrpc', () => {
  describe('HTTP Interface', () => {
    remoteTests(httpClient);
  });
  describe('Socket.IO Interface', () => {
    remoteTests(socketClient);
  });
});
