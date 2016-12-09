import {ServiceManager} from './ServiceManager';

export const socketioBinding = function socketioBinding(io, serviceManager = ServiceManager.default, opts = {}) {
  io.on('connection', socket => initSocket(socket, serviceManager, opts));
};

export const initSocket = function(socket, opts = {}) {
  opts = Object.assign({}, socketioBinding.defaults, opts);

  // Massage service and method if mode is methodPrefix
  let prepareCall = function(service, call){return [service, call];};
  if (opts.mode === 'methodPrefix') {
    prepareCall = function(service, call) {
      let dot = call.method ? call.method.indexOf('.') : -1;
      if (dot > 0) {
        service = call.method.substring(0, dot);
        call.method = call.method.substring(dot + 1);
      }
      return [service, call];
    };
  }

  function doInvoke(service, call) {
    [service, call] = prepareCall(service, call);
    return opts.serviceManager.invoke(service, call);
  }

  async function doMethod(service, sreq) {
    if (Array.isArray(sreq)) {
      let promises = sreq.map(req => doInvoke(service, req));
      let respArr = await Promise.all(promises);
      respArr = respArr.filter(resp => resp && resp.id !== null && resp.id !== undefined);
      socket.emit(opts.returnMessage, respArr);

    } else {
      let resp = await doInvoke(service, sreq);
      if (sreq.id !== null && sreq.id !== undefined) {
        socket.emit(opts.returnMessage, resp);
      }
    }
  }
  socket.on(opts.callMessage, req => doMethod('', req));

  function setupServiceListener(service) {
    socket.on(opts.callMessage + ':' + service, (req) => {
      doMethod(service, req);
    });
  }
  function removeServiceListener(service) {
    socket.removeListener(opts.callMessage + ':' + service);
  }

  if (opts.mode === 'channelSuffix') {
    opts.serviceManager.getServiceNames().forEach(setupServiceListener);
    opts.serviceManager.on('serviceAdded', setupServiceListener);
    opts.serviceManager.on('serviceRemoved', removeServiceListener);
    socket.on('disconnect', () => {
      opts.serviceManager.removeListener('serviceAdded', setupServiceListener);
      opts.serviceManager.removeListener('serviceRemoved', removeServiceListener);
    });
  }
};

socketioBinding.defaults = {
  serviceManager: ServiceManager.default,
  callMessage: 'call',
  returnMessage: 'return',
  mode: 'methodPrefix'
};

export default socketioBinding;
