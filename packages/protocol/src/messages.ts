export interface PingMsg {type: "ping"; t1: number}
export interface PongMsg {type: "pong"; t1: number; t2: number; t3: number}

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
}

export function encode(msg: Envelope): string{
    return JSON.stringify(msg);
}

export function decode(raw: string): Envelope{
    return JSON.parse(raw) as Envelope;
}