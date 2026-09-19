import type { KeyObject } from "node:crypto";
import { verifyReceipt, sha256Hex, canonical } from "./receipt.js";
import type { LogEntry } from "./audit-log.js";

export interface VerifyResult {
  entries: number;
  signaturesValid: boolean;
  chainIntact: boolean;
  worstSpreadMs: number;
  boundMs: number;
  withinBound: boolean;
  problems: string[];
}

export function verifyLog(entries: LogEntry[], publicKey: KeyObject, boundMs: number): VerifyResult {
  const problems: string[] = [];
  let signaturesValid = true, chainIntact = true, worst = 0, prev = "GENESIS";

  for (const e of entries) {
    if (!verifyReceipt(e.receipt, e.signature, publicKey)) {
      signaturesValid = false; problems.push(`bad signature @seq ${e.seq}`);
    }
    if (e.prevHash !== prev) { chainIntact = false; problems.push(`chain break @seq ${e.seq}`); }
    if (sha256Hex(e.prevHash, canonical(e.receipt), e.signature) !== e.hash) {
      chainIntact = false; problems.push(`hash mismatch @seq ${e.seq}`);
    }
    prev = e.hash;
    worst = Math.max(worst, (e.receipt as any).spreadMs ?? 0);
  }

  return { entries: entries.length, signaturesValid, chainIntact, worstSpreadMs: worst, boundMs, withinBound: worst <= boundMs, problems };
}
