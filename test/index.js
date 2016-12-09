import 'babel-polyfill';
import './testServer';
import remoteTests from './remoteTests';
import io from 'socket.io-client';

import {HTTPClient, SocketClient} from '../src/client';

const httpClient = new HTTPClient('http://localhost:2999/services');
const httpMethodPrefixClient = new HTTPClient('http://localhost:2999/rpc', {mode: 'methodPrefix'});
const prefixedSocketClient = new SocketClient(io('http://localhost:2999'));
const socketClient = new SocketClient(io('http://localhost:2999'), {
  mode: 'channelSuffix',
  callMessage: 'call2',
  returnMessage: 'return2'
});

// Client uses the 'fetch' API
import fetch from 'node-fetch';
global.fetch = fetch;

describe('lwrpc', () => {
  describe('HTTP Interface - urlSuffix mode', () => {
    remoteTests(httpClient);
  });
  describe('HTTP Interface - methodPrefix mode', () => {
    remoteTests(httpMethodPrefixClient);
  });
  describe('Socket.IO Interface - methodPrefix mode', () => {
    remoteTests(prefixedSocketClient);
  });
  describe('Socket.IO Interface - channelSuffix mode', () => {
    remoteTests(socketClient);
  });
});
