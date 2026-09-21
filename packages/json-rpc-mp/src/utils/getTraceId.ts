import type { JsonRpcRequest } from '../JsonRpc.types';
import { isArray } from './isArray';
import { isObject } from './isObject';
import { isError } from './isError';
import { getJsonRpcId } from './getJsonRpcId';
import { isFilledString } from './isFilledString';

export function getTraceId(value: JsonRpcRequest): string | undefined {
  const arr = (isArray(value) ? value : [value])
    .filter(
      (item) =>
        isObject(item) &&
        !isError(getJsonRpcId(item)) &&
        isFilledString(item.jsonrpc),
    )
    .map((item) => item.id)
    .sort();

  return arr.length ? JSON.stringify(arr) : undefined;
}
