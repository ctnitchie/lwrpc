import EventEmitter from 'events';

const ErrorCodes = {
  PARSE: -32700,
  INVALID_REQUEST: -32600,
  NO_SUCH_METHOD: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  APP_ERROR: -32000
};

class RPCRequest {
  constructor(method, params, id) {
    this.jsonrpc = "2.0";
    [this.method, this.params] = [method, params];
    if (id) this.id = id;
  }
}

class RPCResponse {
  constructor(result, err, id) {
    this.jsonrpc = "2.0";
    if (result !== undefined && !err) this.result = result;
    if (err) this.error = err;
    if (id) this.id = id;
  }
}

class RPCError {
  constructor(code, message) {
    if (code instanceof Error) {
      code = ErrorCodes.APP_ERROR;
      message = code.message;
    }
    [this.code, this.message] = [code, message];
  }
}

class RPCRequestReceivedEvent {
  constructor(request) {
    this.request = request;
  }

  fail(error) {
    this.error = error;
  }
}

function ServiceManager(handler) {
  const services = {
    '': handler || {}
  };
  ServiceManager.curRequest = null;

  class _ServiceManager extends EventEmitter {
    serviceExists(service='') {
      return services[service] !== undefined;
    }

    getServiceNames() {
      return Object.keys(services);
    }

    methodExists(service, method) {
      if (arguments.length === 1) {
        method = service;
        service = '';
      }
      return this.serviceExists(service)
          && typeof services[service][method] === 'function';
    }

    registerService(service, handlerObj) {
      if (typeof service === 'object') {
        handlerObj = service;
        service = '';
      }
      services[service] = handlerObj || {};
      this.emit('serviceAdded', service, handlerObj);
    }

    uninstallService(service) {
      let svc = services[service];
      if (svc) {
        delete services[service];
        this.emit('serviceRemoved', service, svc);
      }
    }

    registerProcedure(service, name, fn) {
      switch(arguments.length) {
        case 0:
          throw new Error("No function specified.");

        case 1:
          fn = service;
          name = fn.name;
          service = '';
          break;

        case 2:
          fn = name;
          name = service;
          service = '';
          break;
      }
      if (!name) {
        throw new Error('Anonymous functions not supported');
      }
      if (!services[service]) {
        services[service] = {};
      }
      services[service][name] = fn;
    }

    invoke(service, req) {
      if (typeof service === 'object') {
        req = service;
        service = '';
      }
      // Error handler.
      const fail = (error, code, data) => {
        let errorObj;
        if (error instanceof Error) {
          errorObj = {code: ErrorCodes.APP_ERROR, message: error.message};
        } else if (error.code && error.message) {
          errorObj = error;
        } else {
          errorObj = {
            code: code || ErrorCodes.INTERNAL_ERROR,
            message: error + '',
            data
          };
        }
        let resp = new RPCResponse(null, errorObj, req.id);
        this.emit('methodFailed', req, resp, error);
        this.emit('methodCompleted', req, resp);

        if (req.id === null || req.id === undefined) {
          // No ID, no respnse, per spec.
          return Promise.resolve();
        } else {
          return Promise.resolve(resp);
        }
      };

      const success = (v) => {
        // The servce _might_ return an RPCResponse, so use it as-is if so.
        let resp;
        if (v !== undefined && (v.result || v.error)) {
          resp = Object.assign({}, v);
        } else {
          resp = new RPCResponse(v, null);
        }
        resp.jsonrpc = '2.0';
        if (req.id) {
          resp.id = req.id;
        }
        this.emit(resp.error === undefined ? 'methodSucceeded' : 'methodFailed', req, resp);
        this.emit('methodCompleted', req, resp);
        if (req.id === null || req.id === undefined) {
          // No ID, no response, per spec.
          return Promise.resolve();
        } else {
          return Promise.resolve(resp);
        }
      };

      if (!req || !req.method) {
        return fail('No method specified', ErrorCodes.INVALID_REQUEST);
      }

      let event = new RPCRequestReceivedEvent(req);
      this.emit('requestReceived', event);
      if (event.error) {
        fail(event.error);
      }

      let serviceHandler = services[service];
      if (!serviceHandler) {
        return fail('Invalid service: ' + service, ErrorCodes.INVALID_REQUEST);
      }
      let fn = serviceHandler[req.method];
      if (!fn || typeof fn !== 'function') {
        return fail('Invalid method: ' + req.method, ErrorCodes.NO_SUCH_METHOD);
      }

      try {
        // Expose the current request to RPC-aware functions.
        let params = req.params || [];
        if (!Array.isArray(params)) {
          params = [params];
        }
        if (fn.rpcAware || serviceHandler.rpcAware) {
          params = params.concat(req);
        }
        ServiceManager.curRequest = req;
        let retval = fn.apply(serviceHandler, params);
        ServiceManager.curRequest = null;
        this.emit('methodExecuted', req, retval);

        if (req.id === null || req.id === undefined) {
          // No request ID, no return, per spec. Don't even wait.
          return success(null);
        } else if (retval instanceof Promise) {
          return retval.then(success).catch(err => fail(err, ErrorCodes.APP_ERROR));
        } else {
          return success(retval);
        }

      } catch (e) {
        return fail(e);
      }
    }
  }
  let serviceManager = new _ServiceManager();

  // WebSockets subscribe to serviceAdded/serviceRemoved events; every client
  // will be notified. Need to boost the maxListener threshhold to avoid
  // outofmemory errors.
  serviceManager.setMaxListeners(10000);
  return serviceManager;
}

Object.defineProperty(ServiceManager, 'default', {
  value: ServiceManager()
});
['on', 'removeListener', 'registerService', 'invoke', 'serviceExists', 'methodExists'].forEach(m => {
  ServiceManager[m] = ServiceManager.default[m].bind(ServiceManager.default);
});

export {ServiceManager, RPCRequest, RPCResponse, ErrorCodes, RPCError};
export default ServiceManager;
