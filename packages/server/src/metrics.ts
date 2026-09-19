import client from "prom-client";

export const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry });

export const spreadHist = new client.Histogram({
  name: "isochron_reveal_spread_ms",
  help: "reveal spread per round (ms)",
  buckets: [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000],
  registers: [registry],
});
export const horizonGauge = new client.Gauge({
  name: "isochron_horizon_ms", help: "chosen horizon (ms)", registers: [registry],
});
export const droppedCounter = new client.Counter({
  name: "isochron_dropped_total", help: "clients dropped from rounds", registers: [registry],
});
export const clientsGauge = new client.Gauge({
  name: "isochron_clients", help: "connected clients", registers: [registry],
});
