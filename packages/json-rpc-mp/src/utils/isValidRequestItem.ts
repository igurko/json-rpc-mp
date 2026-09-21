import { isObject } from './isObject';
import { isFilledString } from './isFilledString';
import { isError } from './isError';
import type { JsonRpcRequestItem } from '../JsonRpc.types';
import { getJsonRpcId } from './getJsonRpcId';
import { isArray } from './isArray';

export function isValidRequestItem(
  request: unknown,
): request is JsonRpcRequestItem {
  return (
    isObject(request) &&
    isFilledString(request.jsonrpc) &&
    isFilledString(request.method) &&
    !isError(getJsonRpcId(request)) &&
    (request.params === undefined ||
      isObject(request.params) ||
      isArray(request.params))
  );
}
