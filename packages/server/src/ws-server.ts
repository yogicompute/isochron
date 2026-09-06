import http from "node:http";
import { WebSocketServer } from "ws";

import { DEFAULT_WS_PORT } from "@isochron/protocol";
import { publish } from "./publish.js";
import { ConnectionManager } from "./connection-manager.js";

const conns = new ConnectionManager();

const httpServer = http.createServer((req, res) => {
  res.setHeader("Acess-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Acess-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.writeHead(204).end();
    return;
  }

  if (req.method === "POST" && req.url === "/publish") {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      let body: unknown;
      try {
        body = raw ? JSON.parse(raw) : {};
      } catch {
        body = { text: raw };
      }

      const msg = publish(conns, body);
      console.log(
        `[server] published seq=${msg.seq} -> ${conns.size} client(s)`,
      );
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({ ok: true, seq: msg.seq, recipients: conns.size }),
      );
      return;
    });
    return;
  }
  res.writeHead(404).end();
});

const wss = new WebSocketServer({ server: httpServer });

wss.on("connection", (ws) => {
  conns.add(ws);

  console.log(`[server] client connected, total clients: ${conns.size}`);

  ws.on("close", () => {
    conns.remove(ws);
    console.log(`[server] client disconnected, total clients: ${conns.size}`);
  });

  ws.on("error", (err) => console.log(`[server] client error: ${err}`));
});

httpServer.listen(DEFAULT_WS_PORT, () => {
  console.log(`[server] listening on port ${DEFAULT_WS_PORT}`);

  console.log(`[server] publish with:\n curl -X POST localhost:${DEFAULT_WS_PORT}/publish -H "Content-Type: 
        application/json" -d '{"text":"hello world"}'`);
});
