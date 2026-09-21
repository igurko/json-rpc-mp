import { isFilledString, isObject, getJsonRpcId, isError } from './utils';

import {
  type JsonRpcRequestItem,
  type JsonRpcResponse,
  type JsonRpcResponseItem,
} from './JsonRpc.types';

const GET_MESSAGE_PORT_METHOD = 'getMessagePort';

function getOrigin(url: string | undefined) {
  if (!url) return '';

  return new URL(url).origin;
}

const MESSAGE_EVENT = 'message';

export function isJsonRpcRequestItem(
  request: unknown,
): request is JsonRpcRequestItem {
  return (
    isObject<JsonRpcRequestItem>(request) &&
    isFilledString(request.method) &&
    request.jsonrpc === '2.0'
  );
}

export function isGetMessagePortRequest(
  request: unknown,
): request is JsonRpcRequestItem {
  return (
    isJsonRpcRequestItem(request) &&
    request.method === GET_MESSAGE_PORT_METHOD &&
    !!request.id &&
    !isError(getJsonRpcId(request)) &&
    request.jsonrpc === '2.0'
  );
}

export function createJsonRpcServer() {
  let messageChannel: MessageChannel | undefined;
  let port1: MessagePort | undefined;
  let port2: MessagePort | undefined;
  let iframe: HTMLIFrameElement | undefined;
  let iframeSrc = '';
  let handlePortMessageOuter: ((event: MessageEvent) => void) | undefined;
  let handlePostMessageOuter: ((event: MessageEvent) => void) | undefined;

  function postMessageChannelPort(response: JsonRpcResponseItem) {
    clearMessageChannel();
    createMessageChannel();

    if (!port2) return;

    iframe?.contentWindow?.postMessage(response, getOrigin(iframeSrc), [port2]);
  }

  function handlePostMessage(event: MessageEvent) {
    if (event.source !== iframe?.contentWindow) return;

    handlePostMessageOuter?.(event);
  }

  function listenPostMessage() {
    window.removeEventListener(MESSAGE_EVENT, handlePostMessage);
    window.addEventListener(MESSAGE_EVENT, handlePostMessage);
  }

  function createMessageChannel() {
    messageChannel = new MessageChannel();
    port1 = messageChannel.port1;
    port2 = messageChannel.port2;
    port1?.addEventListener(MESSAGE_EVENT, handlePortMessage);
    port1?.start();
  }

  function clearMessageChannel() {
    messageChannel = undefined;
    port1?.removeEventListener(MESSAGE_EVENT, handlePortMessage);
    port1?.close();
    port2?.close();
  }

  function setIframe(aIframe: HTMLIFrameElement, aIfameSrc: string) {
    if (iframe === aIframe) return;

    clearMessageChannel();

    iframe = aIframe;
    iframeSrc = aIfameSrc;
  }

  function getValidRequest(request: unknown) {
    if (Array.isArray(request)) {
      const arr = request.filter(isJsonRpcRequestItem);

      return arr.length ? arr : undefined;
    }

    return isJsonRpcRequestItem(request) ? request : undefined;
  }

  function postPortMessage(message: JsonRpcResponse) {
    port1?.postMessage(message);
  }

  function handlePortMessage(event: MessageEvent) {
    handlePortMessageOuter?.(event);
  }

  function setHandlers(params: {
    handlePostMessage?: typeof handlePostMessageOuter;
    handlePortMessage?: typeof handlePortMessageOuter;
  }) {
    handlePostMessageOuter = params?.handlePostMessage;
    handlePortMessageOuter = params?.handlePortMessage;
  }

  function dispose() {
    window.removeEventListener(MESSAGE_EVENT, handlePostMessage);
    clearMessageChannel();
    setHandlers({
      handlePostMessage: undefined,
      handlePortMessage: undefined,
    });
    iframe = undefined;
    iframeSrc = '';
  }

  return {
    clearMessageChannel,
    createMessageChannel,
    setIframe,
    postPortMessage,
    setHandlers,
    postMessageChannelPort,
    dispose,
    listenPostMessage,
    getValidRequest,
  };
}
