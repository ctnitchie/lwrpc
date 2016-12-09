import HTTPClient from './HTTPClient';
import SocketClient from './SocketClient';
import Proxy from './Proxy';

export default rpc;

var rpc = {HTTPClient, SocketClient, Proxy};

(function() {
  // Node.js-style exposure
  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = rpc;
    }
  }

  // AMD and browser global exposure
  if (typeof window !== 'undefined') {
    if (typeof window.define === 'function' && window.define.amd) {
      window.define([], function() {
        return rpc;
      });
    } else {
      window.rpc = rpc;
    }
  }
}());
