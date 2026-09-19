import { appendFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { KeyObject } from "node:crypto";
import { canonical, signReceipt, sha256Hex } from "./receipt.js";

export interface LogEntry {
  seq: number;
  prevHash: string;
  hash: string;
  signature: string;
  receipt: unknown;
}

export class AuditLog {
  private lastHash = "GENESIS";
  private seq = 0;

  constructor(private readonly path: string, private readonly privateKey: KeyObject) {
    mkdirSync(dirname(path), { recursive: true });
    if (existsSync(path)) {
      const lines = readFileSync(path, "utf8").trim().split("\n").filter(Boolean);
      if (lines.length) {
        const last = JSON.parse(lines.at(-1)!) as LogEntry;
        this.lastHash = last.hash;
        this.seq = last.seq + 1;
      }
    }
  }

  append(receipt: unknown): LogEntry {
    const payload = canonical(receipt);
    const signature = signReceipt(receipt, this.privateKey);
    const hash = sha256Hex(this.lastHash, payload, signature);
    const entry: LogEntry = { seq: this.seq++, prevHash: this.lastHash, hash, signature, receipt };
    appendFileSync(this.path, JSON.stringify(entry) + "\n");
    this.lastHash = hash;
    return entry;
  }
}
