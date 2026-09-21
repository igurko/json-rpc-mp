import {
  isObject,
  isArray,
  isFunction,
  isFilledString,
  getOrigin,
  isError,
  getJsonRpcId,
  isValidRequestItem,
  cloneJson,
  getTraceId,
} from './utils';

import type {
  JsonRpcDisposable,
  JsonRpcRequestItem,
  JsonRpcError,
  JsonRpcResponseItem,
  JsonRpcRequestList,
  JsonRpcRequest,
  JsonRpcResponse,
  Callback,
} from './JsonRpc.types';

const RESULT = 'result';
const ERROR = 'error';

export function createJsonRpcClient(params?: { origin?: string }) {
  const jsonrpc = '2.0';
  const origin = getOrigin(params?.origin);
  let port: MessagePort | undefined;

  function getUniqId() {
    return Math.random().toString(36).substring(2);
  }

  function addJsonRpcField(requestOriginal: unknown) {
    const addJsonrpc = (request: unknown) => {
      if (!isObject(request)) return;

      if (!isFilledString(request.jsonrpc)) {
        request.jsonrpc = jsonrpc;
      }
    };

    if (isArray(requestOriginal)) {
      requestOriginal.forEach(addJsonrpc);
    } else {
      addJsonrpc(requestOriginal);
    }
  }

  function getErroredResponseByRequest(
    request: unknown,
  ): JsonRpcResponseItem | undefined {
    const erroredResponse: JsonRpcResponseItem = {
      jsonrpc,
      error: {
        code: -32600,
        message: 'Invalid Request',
      },
    };

    if (isArray(request)) {
      const hasError =
        request.length !== request.filter(isValidRequestItem).length;

      return hasError ? erroredResponse : undefined;
    }

    const id = getJsonRpcId(request);

    if (id !== undefined && !isError(id)) {
      erroredResponse.id = id;
    }

    return isValidRequestItem(request) ? undefined : erroredResponse;
  }

  function getResponseError(response: unknown) {
    const defaultCode = 1;
    const defaultMessage = 'Unknown error';
    let type: string | undefined;
    if (isObject<JsonRpcResponseItem>(response)) {
      type = 'object';
      if (ERROR in response) {
        const code = response.error?.code || defaultCode;
        const message = response.error?.message || defaultMessage;

        if (
          code === response.error?.code &&
          message === response.error?.message
        ) {
          return response.error;
        }

        const data = response.error?.data;
        const error: JsonRpcError = {
          code,
          message,
        };

        if (data !== undefined) {
          error.data = data;
        }

        return error;
      }

      if (!(RESULT in response)) {
        return { code: defaultCode, message: 'Invalid Response' };
      }
    }

    if (isArray<JsonRpcResponseItem>(response)) {
      type = 'array';

      if (response.length === 0) {
        return { code: defaultCode, message: 'Invalid Response' };
      }
    }

    return type ? null : { code: defaultCode, message: 'Invalid Response' };
  }

  function getMessagePort<TResult = unknown, TParams = unknown>(
    requestOriginal: { id: number | string; method?: string; params?: TParams },
    callback?: Callback<
      JsonRpcRequestItem<TParams>,
      JsonRpcResponseItem<TResult>
    >,
  ): JsonRpcDisposable {
    let isDisposed = false;
    const checkResult = getRequestOrDisposableIfError(
      {
        jsonrpc,
        id: requestOriginal.id,
        method: requestOriginal.method || 'getMessagePort',
        params: requestOriginal.params,
      },
      callback,
    );
    const request = checkResult.request as JsonRpcRequestItem<TParams>;

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    if (!request) return checkResult.disposable!;

    const disposable = {
      dispose: () => {
        if (isDisposed) return;

        isDisposed = true;
        window.removeEventListener('message', handlePostMessage);
      },
    };

    const handlePostMessage = (event: MessageEvent | undefined) => {
      const data = event?.data as Partial<JsonRpcResponseItem> | undefined;

      if (
        event?.origin === origin &&
        isFilledString(data?.jsonrpc) &&
        request.id &&
        data?.id === request.id
      ) {
        disposable.dispose();
        const response = getResponse(
          request,
          data,
        ) as JsonRpcResponseItem<TResult>;

        try {
          port = event?.ports?.[0];
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          port!.start();
          callback?.({ disposable, response, request });
        } catch (error: unknown) {
          port = undefined;
          callback?.({
            disposable,
            request,
            response: {
              jsonrpc,
              id: request.id,
              error: {
                code: 1,
                message: (error as Error)?.message || 'Set message port',
                data: response,
              },
            },
          });
        }
      }
    };

    try {
      window.parent.postMessage(request, origin);
      window.addEventListener('message', handlePostMessage);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e: unknown) {
      Promise.resolve().then(() => {
        callback?.({
          disposable,
          request,
          response: {
            jsonrpc,
            id: request.id,
            error: {
              code: 1,
              message: 'Error on window.parent.postMessage',
            },
          },
        });
      });

      return disposable;
    }

    return disposable;
  }

  function getRequestOrDisposableIfError(
    requestOriginal: unknown,
    callback?: Callback,
    checkPort?: boolean,
  ): { request?: JsonRpcRequest; disposable?: JsonRpcDisposable } {
    let isDisposed = false;
    const disposable = {
      dispose: () => {
        isDisposed = true;
      },
    };

    const handleError = (response: JsonRpcResponseItem) => {
      if (isObject(response) && response.id === undefined) {
        delete response['id'];
      }

      if (isFunction(callback)) {
        Promise.resolve().then(() => {
          if (isDisposed) return;

          callback({ request: requestOriginal, response, disposable });
        });
      }

      return { disposable };
    };

    const id = getJsonRpcId(requestOriginal);

    // INVALID ID
    if (isError(id)) {
      return handleError({
        jsonrpc,
        id: null,
        error: { code: -32600, message: 'Request ID is invalid' },
      });
    }

    // PORT IS UNAVAILABLE
    if (checkPort && !port) {
      return handleError({
        jsonrpc,
        id,
        error: { code: 1, message: 'MessagePort is unavailable' },
      });
    }

    const request = cloneJson(requestOriginal) as unknown as JsonRpcRequest;

    // INVALID REQUEST
    if (isError(request)) {
      return handleError({
        jsonrpc,
        id,
        error: { code: -32600, message: 'Invalid Request' },
      });
    }

    addJsonRpcField(request);

    const requestError = getErroredResponseByRequest(request);

    // REQUEST STRUCTURE ERROR
    if (requestError) return handleError(requestError);

    return { request };
  }

  function getResponse(
    request: JsonRpcRequest,
    responseOriginal: unknown,
  ): JsonRpcResponse {
    const getResponseItem = (responseItem: unknown) => {
      const id = getJsonRpcId(responseItem);

      if (isError(id)) {
        return {
          jsonrpc,
          id: null,
          error: { code: 1, message: 'Invalid response ID' },
        };
      }

      const response = cloneJson(responseItem);

      if (isError(response)) {
        const errorResponse: JsonRpcResponseItem = {
          jsonrpc,
          error: { code: 1, message: 'Invalid response' },
        };

        if (id !== undefined) errorResponse.id = id;

        return errorResponse;
      }

      const error = getResponseError(response);

      if (error) {
        const errorResponse: JsonRpcResponse = { jsonrpc, error };

        if (id !== undefined) errorResponse.id = id;

        return errorResponse;
      }

      return response as unknown as JsonRpcResponseItem;
    };

    if (
      (isObject(request) && !isObject(responseOriginal)) ||
      (isArray(request) && !isArray(responseOriginal))
    ) {
      return getResponseItem({
        id: isArray(request) ? undefined : request?.id,
        error: {
          code: 1,
          message: 'Invalid response',
        },
      });
    }

    if (isArray<JsonRpcRequestItem>(responseOriginal)) {
      const requestArray = (
        isArray(request) ? request : []
      ) as JsonRpcRequestList;
      const responseArray = responseOriginal
        .filter(isObject)
        .map(getResponseItem)
        .filter((item) => item.id)
        .filter((resItem) =>
          requestArray.find((reqItem) => reqItem?.id === resItem.id),
        );

      requestArray.forEach((requestItem) => {
        const id = getJsonRpcId(requestItem);

        if (!id || isError(id)) return;

        if (!responseArray.find((item) => item.id === id)) {
          responseArray.push({
            jsonrpc,
            id,
            error: { code: 1, message: 'Response not found' },
          });
        }
      });

      return responseArray;
    }

    return getResponseItem(responseOriginal);
  }

  function listenPortMessage(
    requestOriginal: unknown,
    callback?: Callback,
    isWatched = false,
  ) {
    const checkRequest = getRequestOrDisposableIfError(
      requestOriginal,
      callback,
      true,
    );
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const request = checkRequest.request!;

    if (checkRequest.disposable) {
      return checkRequest.disposable;
    }

    let isDisposed = false;
    const requestTraceId = getTraceId(request);
    const disposable = {
      dispose: () => {
        isDisposed = true;
      },
    };

    // LISTEN TO PORT MESSAGE
    if (requestTraceId && isFunction(callback)) {
      const handlePortMessage = (message: MessageEvent) => {
        if (isDisposed) return;

        const responseId = getTraceId(message?.data);

        if (requestTraceId === responseId) {
          if (!isWatched) disposable.dispose();

          callback({
            request: requestOriginal,
            response: getResponse(request, message?.data),
            disposable,
          });
        }
      };

      disposable.dispose = () => {
        isDisposed = true;
        port?.removeEventListener('message', handlePortMessage);

        if (isWatched) {
          port?.postMessage({
            jsonrpc,
            method: 'cancel',
            params: JSON.parse(requestTraceId),
          });
        }
      };

      port?.addEventListener('message', handlePortMessage);
    }

    port?.postMessage(request);

    return disposable;
  }

  function call<TResult = unknown, TParams = unknown>(
    request: JsonRpcRequestItem<TParams>,
    callback?: Callback<
      JsonRpcRequestItem<TParams>,
      JsonRpcResponseItem<TResult>
    >,
  ): JsonRpcDisposable {
    return listenPortMessage(request, callback, false);
  }

  function batch<TResponse = unknown, TRequest = unknown>(
    request: TRequest,
    callback?: Callback<TRequest, TResponse>,
  ): JsonRpcDisposable {
    return listenPortMessage(request, callback, false);
  }

  function watch<TResult = unknown, TParams = unknown>(
    request: JsonRpcRequestItem<TParams>,
    callback: Callback<
      JsonRpcRequestItem<TParams>,
      JsonRpcResponseItem<TResult>
    >,
  ) {
    return listenPortMessage(request, callback, true);
  }

  return {
    getPort: () => port,
    isReady: () => !!port,
    getMessagePort,
    getUniqId,
    getResponseError,
    call,
    batch,
    watch,
  };
}
