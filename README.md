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

    socket.emit('call:echo', {
      jsonrpc: "2.0",
      method: "doEcho",
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

    expressBinding([serviceManager], router);

If no `serviceManager` is provided, the default will be used. Requests sent to
the base URL of the router will be interpreted as calls to the default service.
Otherwise, address specific services by their names as part of the URL path.

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

    socketioBinding([serviceManager], server, options);

Once bound, clients can send `call` messages whose body is the RPC request to
invoke methods on the default service, and `call:serviceName` for calls to
specific named services. The client may pass an array of method call requests
to have them executed in batch, per the JSON-RPC 2.0 spec. The base message
can be customized via the `callMessage` option. Method returns will be
transmitted as `return` messages whose body is the call result, when a result
is required. This message can be customized via the `returnMessage` option.

### Creating Custom Bindings

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

    var client = rpc.HTTPClient(baseUrl);

The resulting object is an `EventEmitter` with the following events:

- `request(url, body, config)` - Before a request is sent. The `config` object
  will be passed to the `fetch` call and can be modified, e.g. with custom
  headers.
- `response(resp, url, body, config)` - After a response is received but before
  it is analyzed and parsed.

**NOTE:** The Fetch API is not supported in Node.js and is not available on some
browsers, so you'll want to use a polyfill, like
[this one](https://github.com/github/fetch) (for browsers) or
[this one](https://www.npmjs.com/package/isomorphic-fetch) (for Node).

## SocketClient

The `SocketClient` class uses socket.io connections to communicate with the
RPC server.

    var client = rpc.SocketClient(connection, options);

By default, the client will send requests using `call` for the default service,
`call:service`, and listen for `return` messages. You can alter this using the
`callMessage` and `returnMessage` options.

The `SocketClient` emits the following events:

- `sending(service, topic, message)` before sending a request.
- `received(response)` when a response is recieved.

**NOTE:** Attempts to call invalid services will fail silently over WebSockets.
This is because the server is not listening for messages to services it doesn't
know about, and so will never acknowledge them.
