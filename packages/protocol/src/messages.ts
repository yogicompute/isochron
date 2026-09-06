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