export const PROTOCOL_VERSION = 1

export const DEFAULT_TCP_PORT = 3000

export interface Frame{
    type: string;
    body: unknown;
}