import "./style.css";
import type { Envelope } from "@isochron/protocol";

const WS_URL = "ws://localhost:3001";

const card = document.getElementById("card")!;
const label = document.getElementById("label")!;
const meta = document.getElementById("meta")!;

let resetTimer: number | undefined;

function connect(): void {
  const ws = new WebSocket(WS_URL);

  ws.addEventListener("open", () => {
    card.className = "idle";
    label.textContent = "waiting for event...";
  });

  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data as string) as Envelope<{ text?: string }>;

    card.className = "flip";
    label.textContent = msg.body.text ?? `event #${msg.seq}`;

    const roughDelayMs = Date.now() - msg.ts;
    meta.textContent =
      `seq: ${msg.seq} · ~${roughDelayMs}ms after server send · ` +
      `arrived ${new Date().toISOString().slice(11, 23)}`;

    if (resetTimer) clearTimeout(resetTimer);
    resetTimer = window.setTimeout(() => {
      card.className = "idle";
      label.textContent = "waiting for event...";
    }, 1500);
  });

  ws.addEventListener("close", ()=>{
    card.className = "idle"
    label.textContent = "disconnected, retrying...";
    setTimeout(connect, 1000);
  })

  ws.addEventListener("error", ()=>ws.close());
}

connect();
