lwrpc
=====

Lightweight, JSON-RPC 2.0 client and server plumbing for Node.js and browsers.
This library allows you to

- Create and manage [JSON-RPC 2.0](http://www.jsonrpc.org/specification)-compliant
  services based on simple Javascript objects and functions.
- Expose those functions via any number of transports, including (but not
  limited to) HTTP and WebSockets.
- Invoke RPC methods on JSON-RPC 2.0-compliant servers.
- Quickly and easily create promise-based proxy objects whose methods are
  invoked on a server.
- Build custom RPC transport mechanisms.
- No dependencies

Getting Started
---------------

### On the server:

    // Import the library
    const rpc = require('lwrpc/server');

    // Create a service and configure it for RPC
    const service = {
      doEcho(input) {
        return "ECHO: " + input;
      }
    };
    rpc.ServiceManager.registerService('echo', service);

    // Expose it via an Express Router
    app.use(bodyParser.json()); // Important!
    app.use('/rpc', rpc.expressBinding(express.Router()));

    // And/or via socket.io
    const io = socketio(server);
    rpc.socketioBinding(io);

### From node.js clients

    // Load a 'fetch' polyfill and other dependencies
    require('isomorphic-fetch');
    const io = require('socket.io-client');

    // Load the library
    const rpc = require('lwrpc/client');

    // Create the connection
    const httpClient = new rpc.HTTPClient('http://localhost:3000/rpc/');
    // or
    const socketClient = new rpc.SocketClient(io('localhost:3000'));

    // Create proxies by passing either type of client, a service name, and the
    // methods to be proxied.
    const echoService = new rpc.Proxy(httpClient, 'echo', 'doEcho');

    // Then just call it like you would any other promise-based method.
    echoService.doEcho('Proxy Message').then(retval => {
      console.log(retval); // 'ECHO: Proxy Message'
    });

    // Or if you have access to async/await
    console.log(await echoService.doEcho('Proxy Message'));

### From the browser

    <!-- Get the Promise polyfill just to be safe. -->
    <!-- https://github.com/taylorhakes/promise-polyfill -->
    <script src="promise.js"></script>
    <!-- And we need the fetch polyfill - https://github.com/github/fetch -->
    <script src="fetch.js"></script>


    <script src="dist/browser/rpcClient.js"></script>
    <script>
      // Same 'rpc' object as in the Node client.
      var httpClient = new rpc.HTTPClient('/rpc/');
      var echoService = new rpc.Proxy(httpClient, 'echo', 'doEcho');
      echoService.doEcho('Browser message').then(function(resp) {
        alert(resp); // 'ECHO: Browser message'
      });
    </script>

### Using CURL or any other HTTP client.

    curl -d '{"jsonrpc": "2.0", "method": "echo", "params": ["test"], "id": 1}' \
      -H "Content-Type: application/json" \
      -X POST http://localhost:3000/rpc/echo
    # Returns {"jsonrpc":"2.0","result":"ECHO: test","id":1}

### Using WebSockets

    socket.emit('call', {
      jsonrpc: "2.0",
      method: "echo.doEcho",
      params: ["test"],
      id: 1
    });
    socket.on('return', msg => {
      if (msg.id === 1) {
        console.log(msg.result); // "ECHO: test"
      }
    });

API
===

Server
------

### ServiceManager

A `ServiceManager` manages objects whose methods are exposed for invocation via
RPC.

**`constructor([defaultService])`**

    const serviceManager = new rpc.ServiceManager([defaultService]);

Creates a new ServiceManager, optionally with a default, unnamed service to be
called when `null` is used for the service name in an invocation.

**`registerService([name], handler)`**

Register services using the `registerService` method. A service manager _may_
have an unnamed service, configured either by passing the service object to the
constructor, or by calling `registerService` with just an object.

**`uninstallService(name)`**

Uninstalls the given service and returns it.

**`serviceExists(name)`**

Determines if any service exists with the given name.

**`getServiceNames()`**

Returns an array of service names.

**`methodExists([service], method)`**

Determines if the given method exists on the given service, or the default
service if no service name is specified.

**`invoke(service, call)`**

Once services are configured with the object, their methods are invoked via
`invoke([service], requestObject)`.

    let request = new rpc.RPCRequest(method, paramsArray, requestId);
    let promise = serviceManager.invoke(service, request);
    // or, for the default service
    promise = serviceManager.invoke(request)

The resulting `promise` will be provided with an `RPCResponse` object
representing the JSON-RPC 2.0-compliant response message.

**Note:** `invoke` will (hopefully) not throw any exceptions; errors will be
reported by the response message's `error` property and reported via events
(see below).

**`ServiceManager.default`**

There is a read-only `ServiceManager.default` instance which serves as the
default `ServiceManager` instance. Its methods are also exposed on the
`ServiceManager` constructor.

    // Doing this
    ServiceManager.registerService('foo', new FooService());
    // Is the same as this
    ServiceManager.default.registerService('foo', new FooService());

**RPC-Aware Services**

Services can get the raw RPC request in one of two ways.

- Via the `ServiceManager.curRequest` object.
- By marking themselves as `_rpcAware`, in which case the request will be added
  to the arguments being passed to the function. This can be either at the
  service or function level.

In addition, services can return JSON-RPC 2.0-compliant response objects, in
which case that object will be returned to the client as-is.

    const rpcAwareService = {
      rpcAware: true,
      echo(message, rpcRequest) {
        return {result: message, id: rpcRequest.id};
      }
    };

    const serviceWithRpcAwareFunction = {
      echo(message, rpcRequest) {
        return {result: message, id: rpcRequest.id};
      }
    };
    serviceWithRpcAwareFunction.echo.rpcAware = true;

    const serviceUsingGlobalRequest = {
      echo(message) {
        let rpcRequest = rpc.ServiceManager.curRequest;
        return {result: message, id: rpcRequest.id};
      }
    };

### Asynchronous Methods in Services

If a method on a service is asynchronous, it must return a `Promise`. If a
method you intend to expose uses node-style callbacks, it must be converted into
a promise-returning function. You can use something like
[es6-promisify](https://www.npmjs.com/package/es6-promisify) to simplify the
process.

    const service = {
      echoCallback(message, cb) {
        // Can't be called directly over RPC.
        cb(null, message);
      },

      echoPromise(message) {
        // This, though, will work
        return new Promise((resolve, reject) {
          this.echoCallback(message, (err, v) => {
            if (err) {
              reject(err);
            } else {
              resolve(v);
            }
          });
        });
      },
    };

    // Or simply generate the Promise-based version with promisify
    const promisify = require('es6-promisify');
    service.echoPromisify = promisify(service.echoCallback.bind(service));

### Events

`ServiceManager` instances emit the following events:

- `serviceAdded(serviceName, handler)` when a service is registered.
- `serviceRemoved(serviceName, handler)` when a service is removed.
- `requestReceived(event)` when an RPC call is received, but before it is
   executed. This event has a `request` property with the JSON-RPC 2.0 message,
   and a `fail(error)` method allowing you to cancel the method call.
- `methodExecuted(request)` when a method is executed but before its result has
  been evaluated.
- `methodSucceeded(request, response)` when a method completes without errors.
- `methodFailed(request, response)` if the method call fails for any reason.
- `methodCompleted(request, response)` after all other processing, whether the
  method succeeded or failed.

### expressBinding

The `expressBinding()` function binds a `ServiceManager` to an Express `Router`
for handling RPC requests over `HTTP POST`.

    expressBinding(router, opts);

If no `serviceManager` is provided, the default will be used.

Options:

- `serviceManager` - The `ServiceManager` instance to use;
  `ServiceManager.default` by default.
- `mode` - Either `"urlSuffix"` (the default) or `"methodPrefix"`.
  - `"urlSuffix"` means that named services are addressed by adding their names
    to the end of the base URL. For instance, POSTs to `/rpc/echo` would go to
    the `echo` service.
  - `"methodPrefix"` means that all requests to all services are handled by the
    base URL, and the service is indicated by a prefix on the `method` property
    of the request. For instance, all requests would go to `/rpc`, with calls
    to `method: "echo.doEcho"` being routed to the `echo` service.

This function returns the router.

For example:

    app.use('/rpc', rpc.expressBinding(express.Router()));

- POST requests to `/rpc` or `/rpc/` would be sent to the default service
- POST requests to `/rpc/echo` would go to the `echo` service.

And so forth. The client may send an array of method calls to have them invoked
in batch mode, per the JSON-RPC 2.0 spec.

**NOTE:** You _must_ pass the Router instance to the `expressBinding` function;
it will not instantiate one for you. This allows the library to avoid a direct
dependency on Express.

### socketioBinding

The `socketioBinding()` function binds a `ServiceManager` to a socket.io server.

    socketioBinding(server, [options]);

Options:

- `serviceManager` - The `ServiceManager` instance to use. Defaults to
  `ServiceManager.default`.
- `callMessage` - The event to listen to for requests. Defaults to `"call"`.
  Calls to named services may use a different message; see `mode`.
- `returnMessage` - The event to send for return values. Defaults to
  `"return"`.
- `mode` - Either `methodPrefix` (the default) or `channelSuffix`.
  - In `methodPrefix` mode, the name of the service is assumed to be prepended
    to the `method` property of the request, followed by a period. For example,
    a call to `echo.doEcho` would be interpreted as a call to the `doEcho`
    method on the `echo` service. A method with no period in the name would be
    routed to the default service in the `serviceManager`.
  - In `channelSuffix` mode, the service name would be appended to the
    `callMessage` event name with a colon. For example, calls to the `echo`
    service would be listened for with the `"call:echo"` event. Periods in
    method names are assumed to be part of the method property name on the
    service object. So a `call` for `echo.doEcho` would invoke
    `defaultService["echo.doEcho"]()`, not `echo.doEcho()`. Note that in this
    mode, calls to invalid service names fail silently, as no listener exists on
    for the events used by those services.

### Creating New Transport Bindings

Creating a transport binding is relatively simple. All the binding does is
interpret incoming messages over some transport into JSON-RPC 2.0 method call
requests, passes them to `ServiceManager.invoke()`, and encodes the result for
transmission back to the caller (if applicable). See the source code for
`expressBinding` and `socketioBinding` for examples.

Client
======

The package includes two RPC client implementations.

- `HTTPClient` makes RPC calls using HTTP POST to a given base URL.
- `SocketClient` uses takes a socket.io client connection and uses it to pass
  method calls and recieve results.

Both implementations use the same interface:

- `call(service, method, params)`
- `notify(service, method, params)`

The only difference is that `notify` calls will not receive any return values or
be notified of any errors. Both methods return promises with the full JSON-RPC
response message, regardless of whether that message represents success or
failure.

## Proxies

Because of this common interface, either client can be used to create `Proxy`
objects. These are normal JavaScript objects whose methods use the underlying
RPC client to pass the method call to the server and return the response (or
throw the error).

    const myService = new rpc.Proxy(client, serviceName, 'method1', 'method2');
    myService.method1(); // executes on the server; returns a Promise.

When using an RPC server whose protocol doesn't match one of the out-of-the-box
clients, you can write your own that implements `call` and `notify`, then
construct Proxy objects with that.

## HTTPClient

The `HTTPClient` class uses the
[Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) to send
HTTP POST requests to the appropriate service.

    var client = rpc.HTTPClient(baseUrl, opts);

Options:

- `headers` - An object containing HTTP headers to add to all RPC requests. The
  `Content-Type` header will always be set to `"application/json"`.
- `mode` - Either `"urlSuffix"` (the default) or `"methodPrefix"`.
  - `"urlSuffix"` means that calls to a specific service will go to a URL ending
    with that service name. For instance, calls to the `echo` service would go
    to `/rpc/echo`.
  - `"methodPrefix"` means that the service name, if present, will be prepended
    to the method name in the `method` value sent to the server, and all
    requests will go to the same URL. For instance, a call to the `doEcho`
    method of the `echo` service would all go to `/rpc`, but the `"method"`
    in the request would be set to `"echo.doEcho"`.
- `credentials` - The credentials to be assigned to the `credentials` field in
  fetch requests. See the
  [API documentation](https://developer.mozilla.org/en-US/docs/Web/API/Request/credentials)
  for details. Set to `"same-origin"` by default.

The resulting object is an `EventEmitter` with the following events:

- `request(url, body, config)` - Before a request is sent. The `config` object
  will be passed to the `fetch` call and can be modified, e.g. with custom
  headers.
- `response(resp, url, body, config)` - After a response is received but before
  it is analyzed and parsed.

**NOTE:** The Fetch API is not supported in Node.js and is not available on some
browsers, so you'll want to use a polyfill, like
[this one](https://www.npmjs.com/package/isomorphic-fetch).

## SocketClient

The `SocketClient` class uses socket.io connections to communicate with the
RPC server.

    var client = rpc.SocketClient(connection, options);

Options:
- `callMessage` - The event to emit for requests. Defaults to `"call"`.
  Calls to named services may use a different message; see `mode`.
- `returnMessage` - The event to listen to for return values. Defaults to
  `"return"`.
- `mode` - Either `methodPrefix` (the default) or `channelSuffix`.
  - In `methodPrefix` mode, the name of the service is prepended
    to the method name, followed by a period. For example,
    `call('echo', 'doEcho', 'test')` would send `"method": "echo.doEcho"` via
    the event named by `callMessage`. Calls to the `null` service have no
    prefix.
  - In `channelSuffix` mode, the service name is appended to the
    `callMessage` event name with a colon. For example, calls to the `echo`
    service would be sent with the `"call:echo"` event, and the `method`
    property of the request is unchanged.

The `SocketClient` emits the following events:

- `sending(service, topic, message)` before sending a request.
- `received(response)` when a response is recieved.
