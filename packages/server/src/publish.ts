import { WebSocket } from "ws";
import { encode, type Envelope } from "@isochron/protocol"
import type { ConnectionManager } from "./connection-manager.js";

let seq = 0

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
