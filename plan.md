# Isochron — Build Plan

> **Codename: Isochron** (*isochronous* = "occurring at equal time"). A realtime delivery
> network that optimizes for **equal** delivery time, not minimum delivery time — and proves it.

---

## Context — why we're building this

Every realtime system minimizes delivery *latency*. Almost nobody minimizes delivery *skew*.
Yet for a large class of apps, **unequal** delivery is the actual bug:

- **Live sports betting** — the stream reaches viewers 5–30s apart; a fast path can bet on a goal others haven't seen.
- **Live auctions** — sniped via the same delivery gap.
- **Game shows / quiz / tap-to-win, esports co-streams, live-commerce drops, regulated trading venues** — all the same shape.

Market-data exchanges already solved this in hardware: they install **equal-length fiber coils** so every
colocated server gets the tick at the same nanosecond. Nobody has shipped it as an **API**.

**The inverted primitive:** instead of *"deliver as fast as possible,"* it's
*"deliver to every subscriber at a common wall-clock deadline, and prove it."*

The hard, interesting engineering:
1. Continuous per-connection **RTT + clock-offset** estimation.
2. A **scheduler** that picks a release horizon covering the p99 of currently-connected subscribers.
3. **Edge nodes** that hold and release on a synchronized clock.
4. A **tail policy** for stragglers (drop the round, or extend the horizon and hurt everyone).
5. **Signed delivery receipts** — cryptographic proof to a regulator that nobody got a head start.

**Intended outcome:** an end-to-end "Simultaneity API" built from a hello-world socket up, where every
step is a runnable, complete product, and simultaneity is something you can *watch* in a browser and
*verify* with a signature.

---

## Tech stack (locked)

| Concern | Choice | Notes |
|---|---|---|
| Runtime | **Node.js v25** (installed) | via `tsx` in dev; `tsc`/esbuild for build |
| Language | **TypeScript** | typed wire protocol, clock math, receipts; zero runtime cost |
| Monorepo | **npm workspaces** | no extra install (pnpm optional; not currently installed) |
| Transport | `net` (TCP) → **`ws`** → **`uWebSockets.js`** | pragmatic first, swap to C++ core at hardening step |
| Wire format | **JSON** → **binary** (MessagePack / fixed layout) | JSON to learn/measure, binary on the hot path later |
| Time | `process.hrtime.bigint()` (monotonic) + `perf_hooks` | NTP-style 4-timestamp sync; wall-clock only for display |
| Crypto | Node built-in **`crypto`** (Ed25519) | signed receipts + hash-chained audit log, no external dep |
| Metrics | **`prom-client`** | spread p50/p99, drop rate, horizon size |
| Frontend | **Vite + vanilla TS** | framework-light so the reveal path stays tight; WebCrypto for in-browser verify |
| Net testing | **in-process network simulator** | macOS has no `tc netem`; inject per-link delay/jitter ourselves |
| Tests | **`node:test`** (built-in) | + simulator-driven integration assertions on reveal spread |

**Headline metric tracked from Step 3 onward:** *reveal spread* = `max(client_reveal) − min(client_reveal)`
in the server time-base, reported as p50 / p99.

---

## Final project structure (the destination)

```
isochron/
  package.json                 # npm workspaces root
  tsconfig.base.json
  README.md
  plan.md                      # this file
  packages/
    protocol/                  # shared wire types, framing, codecs, constants
    clock/                     # RTT/offset estimation + synchronized clock + precise timer
    server/                    # origin: connection mgr, scheduler, tail policy, control plane
    edge/                      # edge relay node (hold & release)
    client-sdk/                # browser + node client library
    receipts/                  # Ed25519 signing, hash-chained audit log, verifier, reports
    sim/                       # network emulator + load & chaos harness
  apps/
    web-client/                # browser visual client (Vite)
    dashboard/                 # ops dashboard (Vite)
    demo/                      # flagship demo (auction / game-show)
  tools/
    verify-cli/                # independent receipt/chain verifier
  scripts/
```

Each step below **adds** to this tree. Every step ends in a **runnable, complete product**.

---

## Step 0 — Foundations & "hello, socket"

**Goal:** the repo, the tooling, and your first two processes talking over a raw TCP socket.

**Substeps**
- 0.1 Init npm-workspaces root, `tsconfig.base.json`, `.gitignore`, `.editorconfig`, `git init`.
- 0.2 `packages/protocol` with a trivial shared constant + a `Frame` type stub.
- 0.3 A `net` TCP server that accepts a connection and echoes what it receives.
- 0.4 A `net` TCP client that connects, sends `"hello"`, prints the reply.
- 0.5 npm scripts `dev:server` / `dev:client` running through `tsx`.

**Adds**
```
isochron/
  package.json                 tsconfig.base.json  .gitignore
  packages/
    protocol/   package.json  src/index.ts          # constants + Frame stub
    server/     package.json  tsconfig.json  src/tcp-hello.ts
    client-sdk/ package.json  tsconfig.json  src/tcp-hello-client.ts
```

**✅ It's a product when:** `npm run dev:server` + `npm run dev:client` → the client prints the server's
echo. Your first socket program works end to end.

---

## Step 1 — Broadcast fan-out over WebSocket (the "many listeners" primitive)

**Goal:** swap TCP for WebSocket (`ws`), go from 1:1 echo to **1:N broadcast**, and add the browser client.

**Substeps**
- 1.1 `ws` server + a `ConnectionManager` tracking every connected socket.
- 1.2 `publish(payload)` that fans out to all clients **as fast as possible** (the naive baseline we later fix).
- 1.3 `protocol`: real message envelope `{type, seq, ts, body}` + JSON codec.
- 1.4 `apps/web-client` (Vite + vanilla TS): a big card that flips when a message arrives, showing its arrival time.
- 1.5 A publish trigger (server keypress or `POST /publish`).

**Adds**
```
  packages/
    protocol/src/messages.ts             # envelope + JSON codec
    server/src/ws-server.ts  connection-manager.ts  publish.ts
    client-sdk/src/ws-client.ts          # node client
  apps/
    web-client/  index.html  vite.config.ts  src/main.ts   # flip card + timestamp
```

**✅ It's a product when:** open 3 browser tabs, hit publish — all three flip, but you **visibly see** them
flip at slightly different times. That visible unfairness is the motivation for everything that follows.
(You've built a working broadcast/notify service.)

---

## Step 2 — Measure the truth: RTT + clock offset per connection

**Goal:** a continuous NTP-style sync handshake; know each client's RTT, offset, and jitter.

**Substeps**
- 2.1 `packages/clock`: NTP 4-timestamp exchange (t1…t4) → `RTT = (t4−t1) − (t3−t2)`, `offset = ((t2−t1)+(t3−t4))/2`.
- 2.2 Min-filter (clean path), EWMA, and variance (jitter) estimators.
- 2.3 Piggyback sync on a ~1s heartbeat per connection; store latest estimates in `ConnectionManager`.
- 2.4 Monotonic time everywhere (`hrtime.bigint()`); event-loop lag via `perf_hooks.monitorEventLoopDelay`.
- 2.5 `/stats` endpoint (+ small table in the client) listing per-connection RTT / offset / jitter.

**Adds**
```
  packages/
    clock/src/timesync.ts  estimator.ts  monotonic.ts
    server/src/heartbeat.ts
    protocol/src/timesync-msgs.ts
  apps/web-client/src/clock.ts
```

**✅ It's a product when:** `/stats` (and the client table) shows live RTT/offset/jitter per client — you can now
**quantify** the unfairness from Step 1. (A working network-telemetry service.)

---

## Step 3 — The synchronized clock (a shared wall-clock for everyone)

**Goal:** every client can compute *server-time*; demonstrate a synchronized action.

**Substeps**
- 3.1 `serverTime()` on client = `localMonotonic + offset`, with drift smoothing.
- 3.2 "Blink test": server says *flip at server-time T*; each client converts T to local and schedules.
- 3.3 **Precise timer**: `setTimeout` to ~2ms before, then spin on `performance.now()`/hrtime for the last bit (Node timers are coarse/late under load).
- 3.4 Measure reveal spread (`max−min` across clients) and render it.

**Adds**
```
  packages/
    clock/src/synchronized-clock.ts  precise-timer.ts
    protocol/src/schedule-msgs.ts       # { revealAt: serverTs }
  apps/web-client/src/reveal.ts
```

**✅ It's a product when:** the "clock party" — trigger a blink and all tabs flip within a few ms, with the
measured spread shown on screen. (A synchronized-action demo.)

---

## Step 4 — Simultaneous delivery: hold & reveal at a common deadline (THE CORE)

**Goal:** deliver a real payload so **every subscriber reveals at one server-time deadline**.

**Substeps**
- 4.1 `scheduler`: release horizon `D = f(OWD of connected clients) + margins`; `T_release = now + D`.
- 4.2 Publisher sends `{roundId, payload, revealAt}` to each client (client-hold model first).
- 4.3 Client **buffers** the payload and reveals exactly at `revealAt` (precise timer from Step 3).
- 4.4 Round accounting: collect each client's actual reveal timestamp → spread, p50/p99.
- 4.5 A/B in the UI: **naive broadcast** (Step 1) vs **scheduled reveal** spread, side by side.

**Adds**
```
  packages/
    server/src/scheduler.ts  round.ts
    protocol/src/reveal-msgs.ts
    client-sdk/src/hold-reveal.ts
  apps/web-client/src/round-view.ts     # A/B: naive vs scheduled
```

**✅ It's a product when:** publish a "GOAL!" event → every tab reveals within single-digit ms, and the UI
proves it (spread readout + A/B toggle vs naive). **This is the headline primitive working.**

---

## Step 5 — The scheduler, for real: horizon policy + the tail

**Goal:** robust horizon selection and an explicit **tail policy** — the genuinely hard part.

**Substeps**
- 5.1 Horizon = **p99 of OWD** among connected clients + jitter margin (from variance) + event-loop-lag budget.
- 5.2 Pluggable tail policies: `drop-slow` (exclude >p99, flag them) · `extend` (raise horizon, hurt all) · `hybrid` (cap + drop). Config-driven.
- 5.3 Late/failed-reveal detection; per-client `included | excluded | late` status in the round record.
- 5.4 Guardrails: min/max horizon, per-client jitter cap, backpressure when too many clients.
- 5.5 Metrics via `prom-client`: spread p50/p99, drop rate, horizon size over time.

**Adds**
```
  packages/
    server/src/horizon.ts  tail-policy.ts  metrics.ts
    protocol/src/round-record.ts
```

**✅ It's a product when:** you can dial the tail policy live and watch **spread vs drop-rate** trade off.
(A tunable fairness scheduler with a real ops story.)

---

## Step 6 — Edge nodes: hold-and-release relays (distribution + trust)

**Goal:** `origin → edge relays → clients`, with edges holding & releasing on the synced clock. Moves the
"hold" onto infra **you** control (regulator-friendlier) and scales fan-out.

**Substeps**
- 6.1 `packages/edge`: an edge process — uplink to origin, downstream `ws` server for clients.
- 6.2 Hierarchical time-sync: `edge↔origin` and `client↔edge`, composed into a single **origin-time** base.
- 6.3 Origin pushes `{payload, revealAt}` to edges early; edges fan out and release to clients at `revealAt`.
- 6.4 Topology config + the in-process **network simulator** to fake multi-region delays on macOS.
- 6.5 Failover: edge-drop handling, client re-home.

**Adds**
```
  packages/
    edge/src/edge-server.ts  edge-uplink.ts  edge-clock.ts
    sim/src/net-emulator.ts  topology.ts
    server/src/edge-registry.ts
```

**✅ It's a product when:** run origin + 2–3 edges (each with simulated region latency) + browser clients
homed to different edges — a reveal still lands within your spread budget across "regions."
(A distributed, simulated multi-region simultaneity network.)

---

## Step 7 — Proof: signed delivery receipts + tamper-evident audit log

**Goal:** the part that sells it — cryptographic proof that **nobody got a head start**.

**Substeps**
- 7.1 Ed25519 keypairs for origin (and each edge); optional client keys for signed ACKs (non-repudiation).
- 7.2 Per round, per client, sign `{roundId, payloadHash, revealAt, sentAt, clientAckAt}`.
- 7.3 Append to a **hash-chained** log (each entry embeds the previous hash → tamper-evident); optional Merkle root per round.
- 7.4 `tools/verify-cli`: independently re-verify signatures + chain + "spread ≤ claimed bound."
- 7.5 Per-round compliance report (JSON + printable HTML).

**Adds**
```
  packages/
    receipts/src/keys.ts  receipt.ts  audit-log.ts  report.ts
  tools/verify-cli/src/index.ts
```

**✅ It's a product when:** after a round, `verify-cli round-123.log` prints
`✓ signatures valid · ✓ chain intact · ✓ spread ≤ Xms · 0 head-starts`. (An auditable fairness ledger.)

---

## Step 8 — Product surface: the API + client SDK + auth + channels

**Goal:** wrap the engine as a developer product.

**Substeps**
- 8.1 Control plane: REST/admin to create channels, publish events, fetch reports; API-key auth.
- 8.2 Polished client SDK (browser + node): `subscribe(channel)`, `on('reveal', cb)`, exposes measured offset & spread.
- 8.3 Multi-channel / rooms; per-channel policy config.
- 8.4 Publisher SDK: `iso.publish(channel, payload, { policy })`.
- 8.5 Quickstart docs.

**Adds**
```
  packages/
    server/src/control-plane.ts  channels.ts
    client-sdk/src/index.ts  publisher.ts
  apps/docs/  (or README quickstart)
```

**✅ It's a product when:** a third party can `npm i` the SDK, subscribe with an API key, and receive fair
reveals. (The "Simultaneity API.")

---

## Step 9 — Harden for latency: uWebSockets.js + binary wire + load & chaos

**Goal:** now that you know where the ms go, cut them — and prove it at scale.

**Substeps**
- 9.1 Swap `ws → uWebSockets.js` on origin/edge behind a `Transport` interface (protocol package unchanged).
- 9.2 Binary framing (MessagePack or fixed layout) on hot-path messages; keep JSON for the control plane.
- 9.3 Load harness in `sim`: thousands of simulated clients via `worker_threads`, each with injected delay/jitter.
- 9.4 Chaos: clock-drift injection, packet loss, edge kills — verify spread/drop stay in budget.
- 9.5 Ops dashboard (`apps/dashboard`): live spread p50/p99, RTT histogram, drop rate, horizon, per-edge health.

**Adds**
```
  packages/
    server/src/transport/transport.ts  uws-transport.ts
    protocol/src/binary-codec.ts
    sim/src/load-harness.ts  chaos.ts
  apps/dashboard/src/main.ts
```

**✅ It's a product when:** the dashboard shows p99 reveal spread staying in budget under ~5–10k simulated
clients, with before/after numbers from the uWS+binary swap. (A load-tested, observable system.)

---

## Step 10 — Flagship demo (make it undeniable)

**Goal:** one polished end-to-end demo where simultaneity is the whole point and it's provable.

**Substeps**
- 10.1 Theme (configurable): **live auction (no sniping)** · **tap-to-win game show** · **live-betting lockout**.
- 10.2 Reveal an event to N players simultaneously; accept responses; resolve fairly (all had equal time).
- 10.3 Show the signed receipt + a **Verify** button (in-browser WebCrypto).
- 10.4 A **"cheater" toggle**: simulate a fast-path client and show the system neutralizes the head start.
- 10.5 One-command runner + README.

**Adds**
```
  apps/demo/src/server-hooks.ts  main.ts  verify-panel.ts
  scripts/demo.ts
```

**✅ It's a product when:** `npm run demo` → open several tabs, run a round, everyone reveals together, a
winner is resolved fairly, click **Verify** → the signed proof checks out. (A shippable showcase.)

---

## Creative extras (build after the core — pick what you like)

1. **Encrypted pre-delivery + delayed key drop** ⭐ — push AES-GCM *ciphertext* to everyone early; at
   `revealAt` broadcast only the tiny symmetric *key*. Equalizes even large payloads, shrinks the reveal-time
   bandwidth burst, and hardens the untrusted-client case. (The cleverest one — strong pairing with edges.)
2. **Software "fiber coil"** — a deliberate *equalization buffer* that delays fast clients to the common
   deadline by design: the exact software analog of exchanges' equal-length fiber.
3. **Fair race resolution** — deterministic tie-breaking / a sequencer for actions submitted *after* reveal, so
   "who was first" is well-defined and provable.
4. **Fairness SLA + score** per round ("99.9% within 5ms"), surfaced inside the signed receipt.
5. **WebTransport / QUIC** transport (unreliable datagrams) as an even-lower-latency path.
6. **Regulator export** — a signed PDF compliance report per event.
7. **GPS / PTP time-source** integration story for production-grade absolute time.
8. **Real multi-cloud edges** (e.g. Fly.io regions) beyond the simulator.
9. **Time-travel debugger** — replay a round from the audit log to inspect exactly when each client revealed.
10. **Public fairness status page** — live spread SLAs, like a trust/status dashboard.

---

## Verification (how you'll know it works, at each step)

- **Every step ships a runnable command + a "definition of done" you can eyeball** (see each ✅ above).
- **Unit tests** (`node:test`): clock math (RTT/offset), horizon selection, receipt sign/verify, chain integrity.
- **Integration**: the in-process network simulator drives N clients with known delays; assert
  `reveal spread ≤ budget` and that each tail policy behaves as configured.
- **Headline metric** — reveal spread p50/p99 — is measured & displayed from Step 3 on, and independently
  **proven** by the audit log + `verify-cli` from Step 7 on.
- **Manual browser demos** at Steps 1, 3, 4, and 10 (multi-tab; watch them flip together).

---

## Build order

Core first: **Steps 0 → 7**. Then productize (**8–9**), then the flagship demo (**10**). The creative
extras come only after the core works. Start at **Step 0** — it's a complete product on its own.
