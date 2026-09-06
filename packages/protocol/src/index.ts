export * from "./messages.js"

export const PROTOCOL_VERSION = 1

export const DEFAULT_TCP_PORT = 3000
export const DEFAULT_WS_PORT = 3001

export interface Frame{
    type: string;
    body: unknown;
}