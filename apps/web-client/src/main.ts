import "./style.css";
import type { Envelope, PongMsg } from "@isochron/protocol";
import { ClientClock } from "./clock.js";

const WS_URL = "ws://localhost:3001";
const card = document.getElementById("card")!;
const label = document.getElementById("label")!;
const meta = document.getElementById("meta")!;
const stats = document.getElementById("stats")!;

let resetTimer: number | undefined;

function connect(): void {
  const ws = new WebSocket(WS_URL);
  const clock = new ClientClock(ws);

  ws.addEventListener("open", () => {
    card.className = "idle";
    label.textContent = "waiting for event…";
    clock.start();
  });

  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data as string) as { type: string } & Record<string, unknown>;

    if (msg.type === "pong") {
      clock.onPong(msg as unknown as PongMsg);
      const s = clock.estimator.snapshot();
      stats.textContent =
        `offset ${s.offset} ms · rtt ${s.rtt} ms · owd ${s.owd} ms · jitter ${s.jitter} ms`;
      return;
    }

    if (msg.type === "broadcast") {
      const b = msg as unknown as Envelope<{ text?: string }>;
      card.className = "flip";
      label.textContent = b.body?.text ?? `event #${b.seq}`;
      const trueDelay = clock.serverNow() - b.ts; // clock-corrected — trustworthy now
      meta.textContent = `seq ${b.seq} · ${trueDelay.toFixed(1)}ms after server send`;
      if (resetTimer) clearTimeout(resetTimer);
      resetTimer = window.setTimeout(() => {
        card.className = "idle";
        label.textContent = "waiting for event…";
      }, 1500);
      return;
    }
  });

  ws.addEventListener("close", () => {
    clock.stop();
    card.className = "idle";
    label.textContent = "disconnected — retrying…";
    setTimeout(connect, 1000);
  });
  ws.addEventListener("error", () => ws.close());
}

connect();
