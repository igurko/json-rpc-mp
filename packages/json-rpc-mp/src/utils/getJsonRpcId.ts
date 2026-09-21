import { isArray } from './isArray';
import { isObject } from './isObject';

type Nil = null | undefined;

export function getJsonRpcId(request: unknown): number | string | Nil | Error {
  if (isArray(request)) return undefined;
  if (!isObject(request)) return new Error('ID');

  const id = request.id;

  if (id === undefined || id === null) return id as Nil;

  if (typeof id === 'string') return id ? id : new Error('ID');
  if (typeof id !== 'number') return new Error('ID');

  return !id || isNaN(id) || id === Infinity || id === -Infinity
    ? new Error('ID')
    : id;
}
