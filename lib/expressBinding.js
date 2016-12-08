import {ServiceManager} from './ServiceManager';

export const expressBinding = function(router, serviceManager = ServiceManager.default, opts = {}) {
  async function doMethod(service, sreq, resp) {
    if (Array.isArray(sreq)) {
      // Batch request
      let promises = sreq.map(req => serviceManager.invoke(service, req));
      let respArr = await Promise.all(promises);
      respArr = respArr.filter(resp => resp.id !== null && resp.id !== undefined);
      resp.json(respArr);

    } else {
      if (sreq.id === null || sreq.id === undefined) {
        // No return; no waiting.
        serviceManager.invoke(service, sreq);
        resp.sendStatus(200);

      } else {
        let sresp = await serviceManager.invoke(service, sreq);
        resp.json(sresp);
      }
    }
  }

  router.post('/', (req, resp, next) => {
    return doMethod('', req.body, resp);
  });

  router.post('/:service', (req, resp, next) => {
    return doMethod(req.params.service, req.body, resp);
  });

  return router;
};

export default expressBinding;
