import { now } from "@isochron/clock"
import type { ConnectionManager } from "./connection-manager.js"
import { openRound, summarize, type Round } from "./round.js"

const HORIZON_MS = 800
const GRACE_MS = 400

export function revealRound(
    conns: ConnectionManager,
    opts: {payload?: unknown, mode?: string} = {},
): Round{
    const revealAt = now() + HORIZON_MS
    const round = openRound(revealAt, opts.mode ?? "blink")

    const msg = JSON.stringify({
        type: "reveal",
        roundId: round.roundId,
        revealAt,
        payload: opts.payload
    })

    conns.forEach((c) => { if (c.ws.readyState === WebSocket.OPEN) { c.ws.send(msg) } })

    setTimeout(()=>{
        const result = summarize(round)
        console.log(`[server] round ${round.roundId} ${round.mode}: ` + 
            `${result.count} acks, spread ${result.spreadMs}ms`)
        const out = JSON.stringify({type: "round-result", mode: round.mode, ...result})
        conns.forEach((c) => { if (c.ws.readyState === WebSocket.OPEN) c.ws.send(out)})
    }, HORIZON_MS + GRACE_MS)
    return round;
}