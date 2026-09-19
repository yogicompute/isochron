import http from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { now, computeSync, ClockEstimator } from "@isochron/clock";
import { delayedSend } from "@isochron/sim";

const ORIGIN_URL = process.env.ORIGIN_URL ?? "ws://localhost:3001";
const EDGE_PORT = Number(process.env.EDGE_PORT ?? 3101);
const REGION = process.env.REGION ?? "edge";
const DOWN_DELAY_MS = Number(process.env.DOWN_DELAY_MS ?? 0); // simulated edge<->client latency

// downstream clients this edge serves
interface Down { id: string; ws: WebSocket; owd: number; }
const downs = new Map<WebSocket, Down>();
let downSeq = 0;

// uplink clock: edge is a time-client of origin
const upEstimator = new ClockEstimator();
let up: WebSocket;
const originNow = () => now() + upEstimator.offset;

function percentile(vals: number[], p: number): number {
  if (!vals.length) return 0;
  const s = [...vals].sort((a, b) => a - b);
  return s[Math.max(0, Math.min(s.length - 1, Math.ceil(p * s.length) - 1))];
}

function connectUplink(): void {
  up = new WebSocket(ORIGIN_URL);

  up.on("open", () => {
    console.log(`[edge ${REGION}] uplink -> ${ORIGIN_URL}`);
    up.send(JSON.stringify({ type: "edge-hello", region: REGION }));

    setInterval(() => {
      if (up.readyState === WebSocket.OPEN) up.send(JSON.stringify({ type: "ping", t1: now() }));
    }, 1000);

    setInterval(() => {
      if (up.readyState !== WebSocket.OPEN) return;
      const clientOwdP99 = percentile([...downs.values()].map((d) => d.owd), 0.99);
      const pathOwd = upEstimator.owd + DOWN_DELAY_MS; // origin->edge + edge->client
      up.send(JSON.stringify({ type: "edge-report", owd: pathOwd + clientOwdP99, clients: downs.size }));
    }, 1000);
  });

  up.on("message", (data) => {
    const t4 = now();
    let msg: any; try { msg = JSON.parse(data.toString()); } catch { return; }
    if (msg.type === "pong") { upEstimator.add(computeSync(msg.t1, msg.t2, msg.t3, t4)); return; }
    if (msg.type === "reveal" || msg.type === "broadcast" || msg.type === "round-result") {
      const raw = JSON.stringify(msg);
      downs.forEach((d) => delayedSend(d.ws, raw, DOWN_DELAY_MS)); // fan out with sim latency
    }
  });

  up.on("close", () => { console.log(`[edge ${REGION}] uplink closed, retrying…`); setTimeout(connectUplink, 1000); });
  up.on("error", () => up.close());
}
connectUplink();

// downstream server for browser clients
const httpServer = http.createServer((_req, res) => res.writeHead(404).end());
const wss = new WebSocketServer({ server: httpServer });

wss.on("connection", (ws) => {
  const down: Down = { id: `${REGION}:c${++downSeq}`, ws, owd: 0 };
  downs.set(ws, down);
  console.log(`[edge ${REGION}] client ${down.id} connected (${downs.size})`);

  ws.on("message", (data) => {
    const t2 = originNow(); // stamp in ORIGIN time -> clients sync to origin transparently
    let msg: any; try { msg = JSON.parse(data.toString()); } catch { return; }

    if (msg.type === "ping") {
      delayedSend(ws, JSON.stringify({ type: "pong", t1: msg.t1, t2, t3: originNow() }), DOWN_DELAY_MS);
    } else if (msg.type === "clock") {
      down.owd = msg.owd;
    } else if (msg.type === "reveal-ack") {
      if (up?.readyState === WebSocket.OPEN) up.send(JSON.stringify({ ...msg, id: down.id }));
    }
  });

  ws.on("close", () => downs.delete(ws));
  ws.on("error", () => ws.close());
});

httpServer.listen(EDGE_PORT, () => {
  console.log(`[edge ${REGION}] clients on ws://localhost:${EDGE_PORT} (down-delay ${DOWN_DELAY_MS}ms)`);
});
