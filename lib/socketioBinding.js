import {ServiceManager} from './ServiceManager';

export const socketioBinding = function socketioBinding(io, serviceManager = ServiceManager.default, opts = {}) {
  io.on('connection', socket => initSocket(socket, serviceManager, opts));
};

export const initSocket = function(socket, serviceManager = ServiceManager.default, opts = {}) {
  if (!serviceManager || !serviceManager.invoke) {
    opts = serviceManager;
    serviceManager = ServiceManager.default;
  }
  opts = Object.assign({}, socketioBinding.defaults, opts);

  async function doMethod(service, sreq) {
    if (Array.isArray(sreq)) {
      let promises = sreq.map(req => serviceManager.invoke(service, req));
      let respArr = await Promise.all(promises);
      respArr = respArr.filter(resp => resp && resp.id !== null && resp.id !== undefined);
      socket.emit(opts.returnMessage, respArr);

    } else {
      let resp = await serviceManager.invoke(service, sreq);
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
  serviceManager.getServiceNames().forEach(setupServiceListener);
  serviceManager.on('serviceAdded', setupServiceListener);
  serviceManager.on('serviceRemoved', service => {
    socket.removeListener(opts.callMessage + ':' + service);
  });
};

socketioBinding.defaults = {
  callMessage: 'call',
  returnMessage: 'return',
};

export default socketioBinding;
