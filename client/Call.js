let nextId = 1;

function RPCCall(method, params, isNotification) {
  let call = {jsonrpc: '2.0'};
  if (method.method) {
    // Copy constructor
    Object.assign(call, method);

  } else if (Array.isArray(method)) {
    // batch
    call = method.map(c => RPCCall(c, null, isNotification));

  } else {
    call.method = method;
    call.params = params || [];
  }
  if (!isNotification && !call.id) {
    call.id = nextId++;
  }
  return call;
}

export default RPCCall;
