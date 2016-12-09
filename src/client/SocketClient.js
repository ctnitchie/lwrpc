import Call from './Call';
import EventEmitter from 'events';

function SocketClient(socket, opts) {
  let pendingReturns = {};
  opts = Object.assign({}, SocketClient.defaults, opts);

  socket.on(opts.returnMessage, resp => {
    client.emit('received', resp);

    function processReturnMessage(msg) {
      pendingReturns[msg.id](msg);
      delete pendingReturns[msg.id];
    }

    if (Array.isArray(resp)) {
      resp.forEach(processReturnMessage);

    } else {
      processReturnMessage(resp);
    }
  });

  function sendCall(service, method, params, isNotification) {
    let call = new Call(method, params, isNotification);
    let topic = service ? (opts.callMessage + ':' + service) : opts.callMessage;
    let p;

    if (Array.isArray(call)) {
      let promiseArr = call.filter(c => !(!c.id)).map(c => {
        return new Promise(resolve => pendingReturns[c.id] = resolve);
      });
      p = Promise.all(promiseArr);

    } else if (!call.id) {
      p = Promise.resolve();

    } else {
      p = new Promise(resolve => pendingReturns[call.id] = resolve);
    }
    client.emit('sending', service, topic, call);
    socket.emit(topic, call);
    return p;
  }

  let client = Object.assign(new EventEmitter(), {
    call(service, method, params) {
      return sendCall(service, method, params, false);
    },

    notify(service, method, params) {
      return sendCall(service, method, params, true);
    }
  });

  return client;
}

SocketClient.defaults = {
  callMessage: 'call',
  returnMessage: 'return'
};

export default SocketClient;
