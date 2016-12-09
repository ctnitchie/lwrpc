function slice(arr, start) {
  return Array.prototype.slice.call(arr, start);
}

function Proxy(client, service, methods) {
  let proxy = {};
  if (!Array.isArray(methods)) {
    methods = slice(arguments, 1);
  }
  methods.forEach(m => {
    if (typeof m !== 'string') {
      return;
    }
    proxy[m] = function() {
      return client.call(service, m, slice(arguments, 0)).then(resp => {
        if (resp.error) {
          throw new Error(resp.error.message + ' (' + resp.error.code + ')');
        }
        return resp.result;
      });
    };
  });
  return proxy;
}

export default Proxy;
