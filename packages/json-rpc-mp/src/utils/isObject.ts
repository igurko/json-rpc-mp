export function isObject<T = Record<string, unknown>>(
  value: unknown,
): value is T {
  return Object.prototype.toString.call(value) === '[object Object]';
}
