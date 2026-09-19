import { readFileSync } from "node:fs";
import { createPublicKey } from "node:crypto";
import { verifyLog, type LogEntry } from "@isochron/receipts";

const [, , logPath = "data/audit.log", pubPath = "data/origin.pub", boundArg] = process.argv;
const boundMs = Number(boundArg ?? 25);

const entries = readFileSync(logPath, "utf8").trim().split("\n").filter(Boolean)
  .map((l) => JSON.parse(l) as LogEntry);
const publicKey = createPublicKey(readFileSync(pubPath));
const r = verifyLog(entries, publicKey, boundMs);

console.log(`entries      : ${r.entries}`);
console.log(`signatures   : ${r.signaturesValid ? "✓ valid" : "✗ INVALID"}`);
console.log(`hash chain   : ${r.chainIntact ? "✓ intact" : "✗ BROKEN"}`);
console.log(`worst spread : ${r.worstSpreadMs}ms (bound ${r.boundMs}ms) ${r.withinBound ? "✓" : "✗ EXCEEDED"}`);
if (r.problems.length) { console.log("problems:"); r.problems.forEach((p) => console.log("  - " + p)); }

const ok = r.signaturesValid && r.chainIntact && r.withinBound;
console.log(ok ? "\n✓ VERIFIED — no head starts detected" : "\n✗ VERIFICATION FAILED");
process.exit(ok ? 0 : 1);
