import {ServiceManager} from './ServiceManager';

export const expressBinding = function(router, opts = {}) {
  opts = Object.assign({}, expressBinding.defaults, opts);

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

  async function doMethod(service, sreq, resp) {
    if (Array.isArray(sreq)) {
      // Batch request
      let promises = sreq.map(req => doInvoke(service, req));
      let respArr = await Promise.all(promises);
      respArr = respArr.filter(resp => resp.id !== null && resp.id !== undefined);
      resp.json(respArr);

    } else {
      if (sreq.id === null || sreq.id === undefined) {
        // No return; no waiting.
        doInvoke(service, sreq);
        resp.sendStatus(200);

      } else {
        let sresp = await doInvoke(service, sreq);
        resp.json(sresp);
      }
    }
  }

  router.post('/', (req, resp, next) => {
    return doMethod('', req.body, resp);
  });

  if (opts.mode === 'urlSuffix') {
    router.post('/:service', (req, resp, next) => {
      return doMethod(req.params.service, req.body, resp);
    });
  }

  return router;
};

expressBinding.defaults = {
  serviceManager: ServiceManager.default,
  mode: 'urlSuffix' // or methodPrefix for method='service.method'-style
};

export default expressBinding;
