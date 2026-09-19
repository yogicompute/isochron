import { WebSocket } from "ws";
import { now } from "@isochron/clock";
import type { ConnectionManager } from "./connection-manager.js";
import { openRound, summarize } from "./round.js";
import { planReveal } from "./scheduler.js";
import { spreadHist, droppedCounter, horizonGauge } from "./metrics.js";
import { auditLog } from "./audit.js";

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

    const receipt = {
      roundId: r.roundId,
      mode: round.mode,
      revealAt: round.revealAt,
      horizonMs: plan.horizonMs,
      spreadMs: r.spreadMs,
      count: r.count,
      dropped: r.dropped,
      clients: round.acks.map((a)=>({
        id: a.id, revealedAtServer: a.revealedAtServer
      })),
      issuedAt: now()
    }

    const entry = auditLog.append(receipt);

    console.log(`[server] round ${r.roundId}: spread ${r.spreadMs}ms, signed receipt #${entry.seq}`);
    const out = JSON.stringify({ type: "round-result", mode: round.mode, horizonMs: plan.horizonMs, ...r });
    conns.forEach((c) => { if (c.ws.readyState === WebSocket.OPEN) c.ws.send(out); });
  }, plan.horizonMs + GRACE_MS);

  return { round, plan };
}
