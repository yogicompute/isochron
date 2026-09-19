import type { Client, ConnectionManager } from "./connection-manager.js"
import { config } from "./config.js"

export function pickHorizon(conns: ConnectionManager, marginMs = 50, minMs = 50): number {
    const owds = conns.list().map((c) => c.report?.owd ?? 0)
    const maxOwd = owds.length ? Math.max(...owds) : 0
    return Math.max(minMs, maxOwd + marginMs)
}

export function percentile(values: number[], p: number): number {
    if (values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b)
    const ind = Math.max(0, Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1))
    return sorted[ind]
}

export interface Plan{
    horizonMs: number;
    included: Client[]
    excluded: Client[]
}

export function planReveal(conns: ConnectionManager): Plan{
    const clients = conns.list();
    const owd = (c: Client) => c.report?.owd ?? 0
    const owds = clients.map(owd)
    const jitters = clients.map(c => c.report?.jitter ?? 0)
    const maxJitter = jitters.length ? Math.max(...jitters): 0

    const owdP = percentile(owds, config.percentile)
    const owdMax = owds.length ? Math.max(...owds): 0

    let horizonMs: number;
    let included: Client[];
    let excluded: Client[];

    if(config.policy === "extend"){
        horizonMs = owdMax + maxJitter + config.lagBudgetMs
        included = clients
        excluded = []
    } else {
        horizonMs = owdP + maxJitter + config.lagBudgetMs
        
        if(config.policy === "hybrid") horizonMs = Math.min(horizonMs, config.maxHorizonMs)
        const budget = horizonMs - config.lagBudgetMs
        included = clients.filter((c)=>owd(c) <= budget + 1e-9)
        excluded = clients.filter((c)=>owd(c) > budget + 1e-9)
    }
    horizonMs = Math.max(config.minHorizonMs, Math.min(config.maxHorizonMs, horizonMs))
    return {horizonMs, included, excluded};
}