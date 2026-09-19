import { WebSocket } from "ws";
import { encode, type Envelope } from "@isochron/protocol"
import type { ConnectionManager } from "./connection-manager.js";
import { now } from "@isochron/clock";
import { openRound, summarize } from "./round.js"

let seq = 0
const GRACE_MS = 500

export function publishNaive(conns: ConnectionManager, body: unknown) {
    const round = openRound(now(), "naive")

    const msg: Envelope = {
        type: "broadcast", 
        seq: seq++,
        ts: now(), 
        body, 
        roundId: round.roundId
    }

    const raw = encode(msg)

    conns.forEach((c) => {
        if(c.ws.readyState === WebSocket.OPEN){
            c.ws.send(raw)
        }
    })

    setTimeout(() => {
        const r = summarize(round);
        console.log(`[server] round ${r.roundId} (naive): spread ${r.spreadMs}ms`)
        const out = JSON.stringify({
            type: "round-result",
            mode: "naive"
        })
        conns.forEach((c) => {
            if(c.ws.readyState === WebSocket.OPEN){
                c.ws.send(out)
            }
        })
    }, GRACE_MS)

    return {round, msg}
}

export function publish(conns: ConnectionManager, body: unknown): Envelope{
    const msg: Envelope = { type: "broadcast", seq: seq++, ts: Date.now(), body}
    const raw = encode(msg)

    conns.forEach((c) => {
        if(c.ws.readyState === WebSocket.OPEN){
            c.ws.send(raw)
        }
    })
    return msg
}
