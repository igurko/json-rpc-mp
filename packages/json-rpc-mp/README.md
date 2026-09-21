# iframe Data Exchange with the Parent Window

- Data exchange with the parent window is performed via messaging using the [JSON-RPC 2.0](https://www.jsonrpc.org/specification) protocol.
- The transport for the exchange is [MessageChannel](https://developer.mozilla.org/en-US/docs/Web/API/MessageChannel).
- The [MessagePort](https://developer.mozilla.org/en-US/docs/Web/API/MessagePort) for such an exchange is obtained by sending/handling the `getMessagePort` request via `postMessage` of the parent window (`window.parent`).

This client implements basic interaction and may not always be convenient given the set of libraries you use. You can implement your own functions that wrap the response in a format or technology convenient for you (promise/rxjs/signals, etc.).

## JsonRpcClient Functions

- **getMessagePort**: obtains the port for data exchange.  
Along with the port, you can request the data needed for initial initialization. The function call itself returns an object with a `dispose()` function so you can unsubscribe from the callback invocation. The callback argument is the same as the callback argument of the `call` function.
- **call**: invokes a single server method.  
The result is handled in the callback. The function call itself returns an object containing a `dispose()` function so you can unsubscribe from handling the response and the callback invocation. The single callback argument receives three objects:  
  - `response` — an object with a JSON-RPC response
  - `request` — the original JSON-RPC request passed during the call (the _jsonrpc: "2.0"_ field is filled in automatically when the request is sent, so it may be absent from the original request if you did not pass it.)
  - `disposable` — an object containing a `dispose()` function so you can cancel response handling and the callback invocation.  
  This is exactly the same object that is returned by the `call` function itself (as well as `batch`/`watch`/`getMessagePort`).  
  This object is not very useful for one-off requests, but it can be useful for storing any data you need in it when using the `watch` function.
- **batch**: invokes multiple server methods.  
The result is handled in the callback. The function call itself returns an object with a `dispose()` method so you can unsubscribe from the callback invocation. The callback argument is the same as the callback argument of the `call` function.
- **watch**: requests periodic notifications about changes to the specified data on the server.  
The ability to observe changing values is not part of the JSON-RPC standard, but the request/response formats conform to the standard.  
The function call itself returns an object with a `dispose()` function so you can stop observing changes and unsubscribe from the callback invocation. The callback argument is the same as the callback argument of the `call` function.  
The `disposable` object passed in the argument can be used to store information you need between calls, since the reference to it does not change for the duration of the subscription. When using it for this purpose, be careful not to overwrite the `dispose()` function it contains for canceling response handling.  
- **getUnuqId**: generates a unique string identifier for a request.  
The simplest logic for creating a unique string identifier is used. You can use any other generator of unique string or integer values.
- **isReady**: the client's readiness for data exchange with the server (checks for the presence of a `MessagePort`)
- **getResponseError**: checks the response for an error.  
The result is a JSON-RPC error object or `null`.
This function is not very useful when calling requests with `call` or `watch`, since the response result is always an object, and the response result can easily be checked by the presence of the `error` field in the response.  
In the case of `batch`, the response result can be either an array or an object with an error. In this case, you can check for an error using this function. The function does not check for nested errors in the response array.

## Usage Examples

### Initialization/Requesting the Port

```js
const client = createJsonRpcClient();

function init(data) {
  console.log("init", data);
}

client.getMessagePort(
  { 
    id: client.getUniqId(),
    params: ["ui.themeMode", "ui.language", "user.id"],
  },
  ({ response }) => {
    if (!response.error) {
      return init(response.result)
    }

    console.log("error", response.error)    
  }
);
```

### Invoking a Single Server Method

```js
client.сall(
  {
    method: "user.id",
    id: client.getUniqId(),
  },
  ({ response }) => {
    if (response.error) {
      console.log("error", response.error);

      return;
    }

    console.log("success", response.result);
  },
);
```

### Invoking Multiple Server Methods (batch)

```js
client.batch([
    { method: "user.id", id: client.getUniqId() },
    { method: "ui.themeMode", id: client.getUniqId() },
  ])
  .then({ response }) => {
    const error = client.getResponseError(response)
    
    if (error) {
      return console.log("error", error);
    }

    console.log("success", response.result);
  },
);
```

### Observing Value Changes

On the first event, an object containing the full set of requested data is returned.
Subsequently, the object will contain only the data that has changed.

```js
client.watch(
  {
    method: "changes",
    id: client.getUniqId(),
    params: {
        themeMode: "ui.themeMode",
        language: "ui.language",
    },
  },
  ({ response, disposable }) => {
    if (response.error) {  
      disposable.dispose();
      console.log("error", response.error);

      return;
    }
    
    disposable.count = 'count' in disposable ? disposable.count++ : 0;    

    console.log("success", disposable.count, response.result);
  },
);
```

### Stopping Observation of Value Changes

```js
const disposable = client.watch(
  {
    method: "changes",
    id: client.getUniqId(),
    params: {
        themeMode: "ui.themeMode",
    },
  },
  (data) => console.log("data", data),
);

setTimeout(() => {
  disposable.dispose();
}, 5000);
```