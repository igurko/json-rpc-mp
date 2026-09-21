import { JsonRpcValue } from '../JsonRpc.types';

export function cloneJson(value: unknown): JsonRpcValue | Error {
  try {
    return JSON.parse(JSON.stringify(value));
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (e) {
    return new Error('Error cloning JSON');
  }
}
