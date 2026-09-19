export interface PingMsg {type: "ping"; t1: number}
export interface PongMsg {type: "pong"; t1: number; t2: number; t3: number}

export interface RevealMsg {
    type: "reveal";
    roundId: string;
    revealAt: number;
    payload: unknown;
}

export interface RevealAck{
    type: "reveal-ack";
    roundId: string;
    revealedAtServer: number
}

export interface RoundResult{
    type: "round-result";
    roundId: string;
    spreadMs: number;
    count: number;
    dropped?: number;
    horizonMs: number;
    mode: string;
}
export interface ClockReport{
    type: "clock",
    rtt: number;
    offset: number;
    owd: number;
    jitter: number
}

export interface Envelope <T=unknown>{
    type: string; 
    seq: number;
    ts: number;
    body: T;
    roundId?: string;
}

export function encode(msg: Envelope): string{
    return JSON.stringify(msg);
}

export function decode(raw: string): Envelope{
    return JSON.parse(raw) as Envelope;
}