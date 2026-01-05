/**
 * Type declarations for ws
 */
declare module "ws" {
  import { EventEmitter } from "events";
  export class WebSocket extends EventEmitter {
    constructor(address: string | URL, protocols?: string | string[]);
    readyState: number;
    send(
      data: string | Buffer | ArrayBuffer | Buffer[],
      cb?: (err?: Error) => void,
    ): void;
    close(code?: number, reason?: string): void;
    terminate(): void;
    ping(
      data?: string | Buffer,
      mask?: boolean,
      cb?: (err?: Error) => void,
    ): void;
    pong(
      data?: string | Buffer,
      mask?: boolean,
      cb?: (err?: Error) => void,
    ): void;
  }

  export const CONNECTING = 0;
  export const OPEN = 1;
  export const CLOSING = 2;
  export const CLOSED = 3;
}





