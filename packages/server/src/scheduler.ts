import type { ConnectionManager } from "./connection-manager.js"

export function pickHorizon(conns: ConnectionManager, marginMs = 50, minMs = 50): number {
    const owds = conns.list().map((c) => c.report?.owd ?? 0)
    const maxOwd = owds.length ? Math.max(...owds) : 0
    return Math.max(minMs, maxOwd + marginMs)
}
