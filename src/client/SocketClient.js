import Call from './Call';
import EventEmitter from 'events';

function SocketClient(socket, opts) {
  let returnBus = new EventEmitter();
  opts = Object.assign({}, SocketClient.defaults, opts);

  socket.on(opts.returnMessage, resp => {
    client.emit('received', resp);

    if (Array.isArray(resp)) {
      resp.forEach(resp => returnBus.emit('return-' + resp.id, resp));

    } else {
      returnBus.emit('return-' + resp.id, resp);
    }
  });

  function sendCall(service, method, params, isNotification) {
    let call = new Call(method, params, isNotification);
    let topic = opts.callMessage;
    if (service) {
      switch (opts.mode) {
        case 'methodPrefix':
          call.method = service + '.' + call.method;
          break;

        case 'channelSuffix':
        default:
          topic += ':' + service;
      }
    }

    let p;
    if (Array.isArray(call)) {
      let promiseArr = call.filter(c => !(!c.id)).map(c => {
        return new Promise(resolve => returnBus.once('return-' + c.id, resolve));
      });
      p = Promise.all(promiseArr);

    } else if (!call.id) {
      p = Promise.resolve();

    } else {
      p = new Promise(resolve => returnBus.once('return-' + call.id, resolve));
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
  returnMessage: 'return',
  mode: 'methodPrefix'
};

export default SocketClient;
