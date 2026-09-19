import { now, computeSync, ClockEstimator } from "@isochron/clock";
import type { PongMsg } from "@isochron/protocol";

export class ClientClock {
  readonly estimator = new ClockEstimator();
  private timer: number | undefined;

  constructor(private readonly ws: WebSocket, private readonly intervalMs = 1000) {}

  start(): void {
    const ping = () => {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "ping", t1: now() }));
      }
    };
    ping();
    this.timer = window.setInterval(ping, this.intervalMs);
  }

  stop(): void { if (this.timer) clearInterval(this.timer); }

  // Call when a pong arrives. Computes the sample, feeds the estimator, and
  // reports the smoothed numbers back so the server can display/schedule.
  onPong(msg: PongMsg): void {
    const t4 = now();
    this.estimator.add(computeSync(msg.t1, msg.t2, msg.t3, t4));
    if (this.ws.readyState === WebSocket.OPEN) {
      const s = this.estimator.snapshot();
      this.ws.send(JSON.stringify({
        type: "clock", rtt: s.rtt, offset: s.offset, owd: s.owd, jitter: s.jitter,
      }));
    }
  }

  /** Server-time now, using the estimated offset. */
  serverNow(): number { return now() + this.estimator.offset; }
}
