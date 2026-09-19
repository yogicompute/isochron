import type { WebSocket } from "ws";

export function delayedSend(ws: WebSocket, data: string, delayMs: number): void {
  if (delayMs <= 0) {
    if (ws.readyState === ws.OPEN) ws.send(data);
    return;
  }
  setTimeout(() => { if (ws.readyState === ws.OPEN) ws.send(data); }, delayMs);
}
