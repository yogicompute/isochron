export interface Ack { id: string, revealedAtServer: number;}
export interface Round{
    roundId: string;
    revealAt: number;
    mode: string;
    acks: Ack[];
}

const rounds = new Map<string, Round>();

export function openRound(revealAt: number, mode: string): Round{
    const roundId = `r${Date.now().toString(36)}`
    const round: Round = {roundId, revealAt, mode, acks:[]}
    rounds.set(roundId, round)
    return round;
}

export function recordAck(roundId: string, ack: Ack): void{
    rounds.get(roundId)?.acks.push(ack)
}

export function summarize(round: Round){
    const t = round.acks.map((a)=>a.revealedAtServer);
    const spreadMs = t.length ? Math.max(...t) - Math.min(...t) : 0

    return {
        roundId: round.roundId,
        spreadMs: Number(spreadMs.toFixed(2)),
        count: t.length
    }
}