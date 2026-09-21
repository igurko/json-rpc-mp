type Nil = null | undefined;

export type JsonRpcValue =
  | string
  | number
  | boolean
  | null
  | JsonRpcObject
  | JsonRpcArray;

export interface JsonRpcObject {
  [key: string]: JsonRpcValue | undefined;
}

export type JsonRpcArray = Array<JsonRpcValue>;

export type JsonRpcParams = JsonRpcObject | JsonRpcArray;

export interface JsonRpcDisposable {
  dispose(): void;
}

export interface JsonRpcRequestItem<T = unknown> {
  // The protocol version will be added automatically
  jsonrpc?: string;
  id?: number | string | Nil;
  method: string;
  params?: T;
}

export interface JsonRpcError<T = unknown> {
  code: number;
  message: string;
  data?: T;
}

export interface JsonRpcResponseItem<T = unknown> {
  jsonrpc: string;
  id?: number | string | Nil;
  method?: string;
  result?: T;
  error?: JsonRpcError;
}

export type JsonRpcRequestList = JsonRpcRequestItem[];

export type JsonRpcRequest = JsonRpcRequestItem | JsonRpcRequestList;

export type JsonRpcResponseList = JsonRpcResponseItem[];

export type JsonRpcResponse = JsonRpcResponseItem | JsonRpcResponseList;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Callback<TRequest = any, TResponse = any> = (data: {
  request: TRequest;
  response: TResponse;
  disposable: JsonRpcDisposable;
}) => void;
