import http from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import { DEFAULT_WS_PORT, type PingMsg } from "@isochron/protocol";
import { now } from "@isochron/clock";
import { ConnectionManager } from "./connection-manager.js";
import { publish } from "./publish.js";
import { revealRound } from "./reveal.js";
import { recordAck } from "./round.js";


const conns = new ConnectionManager();

const httpServer = http.createServer((req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") { res.writeHead(204).end(); return; }

  if (req.method === "GET" && req.url === "/stats") {
    const rows = conns.list().map((c) => ({ id: c.id, ...(c.report ?? {}) }));
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ clients: conns.size, rows }, null, 2));
    return;
  }

  if (req.method === "POST" && req.url === "/publish") {
    let raw = ""; req.on("data", (c) => (raw += c));
    req.on("end", () => {
      let body: unknown;
      try { body = raw ? JSON.parse(raw) : {}; } catch { body = { text: raw }; }
      const msg = publish(conns, body);
      console.log(`[server] published seq=${msg.seq} -> ${conns.size} client(s)`);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, seq: msg.seq, recipients: conns.size }));
    });
    return;
  }

  if(req.method === "POST" && req.url === "/blink") {
    const round = revealRound(conns, {mode: "blink"})
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok:true, roundId: round.roundId, revealAt: round.revealAt }));
    return;
  }

  res.writeHead(404).end("not found");
});

const wss = new WebSocketServer({ server: httpServer });

wss.on("connection", (ws) => {
  const client = conns.add(ws);
  console.log(`[server] ${client.id} connected (${conns.size} total)`);

  ws.on("message", (data) => {
    const t2 = now(); // stamp receive time immediately
    let msg: any;
    try { msg = JSON.parse(data.toString()); } catch { return; }

    if (msg.type === "ping") {
      const reply = { type: "pong", t1: (msg as PingMsg).t1, t2, t3: now() };
      ws.send(JSON.stringify(reply));
    } else if (msg.type === "clock") {
      client.report = { rtt: msg.rtt, offset: msg.offset, owd: msg.owd, jitter: msg.jitter };
    }else if (msg.type === "reveal-ack") {
      recordAck(msg.roundId, {id: client.id, revealedAtServer: msg.revealedAtServer});
    }
  });

  ws.on("close", () => {
    conns.remove(ws);
    console.log(`[server] ${client.id} disconnected (${conns.size} total)`);
  });
  ws.on("error", (err) => console.error(`[server] ws error: ${err.message}`));
});

httpServer.listen(DEFAULT_WS_PORT, () => {
  console.log(`[server] isochron WS listening on ws://localhost:${DEFAULT_WS_PORT}`);
  console.log(`[server] stats:   curl localhost:${DEFAULT_WS_PORT}/stats`);
});
