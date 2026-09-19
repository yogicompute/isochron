import { WebSocket } from "ws";
import { now } from "@isochron/clock";
import type { ConnectionManager } from "./connection-manager.js";
import { openRound, summarize } from "./round.js";
import { planReveal } from "./scheduler.js";
import { spreadHist, droppedCounter, horizonGauge } from "./metrics.js";

const GRACE_MS = 400;

export function revealRound(conns: ConnectionManager, opts: { payload?: unknown; mode?: string } = {}) {
  const plan = planReveal(conns);
  horizonGauge.set(plan.horizonMs);

  const revealAt = now() + plan.horizonMs;
  const round = openRound(revealAt, opts.mode ?? "fair", plan.included.map((c) => c.id));

  const msg = JSON.stringify({ type: "reveal", roundId: round.roundId, revealAt, payload: opts.payload });
  conns.forEach((c) => { if (c.ws.readyState === WebSocket.OPEN) c.ws.send(msg); });

  setTimeout(() => {
    const r = summarize(round);
    spreadHist.observe(r.spreadMs);
    droppedCounter.inc(r.dropped);
    console.log(`[server] round ${r.roundId} (${round.mode}): spread ${r.spreadMs}ms, ` +
      `${r.count} on-time, ${r.dropped} dropped, horizon ${plan.horizonMs}ms`);
    const out = JSON.stringify({ type: "round-result", mode: round.mode, horizonMs: plan.horizonMs, ...r });
    conns.forEach((c) => { if (c.ws.readyState === WebSocket.OPEN) c.ws.send(out); });
  }, plan.horizonMs + GRACE_MS);

  return { round, plan };
}
