import crypto, { type KeyObject } from "node:crypto";

export function canonical(obj: unknown): string {
  if (obj === null || typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) return `[${obj.map(canonical).join(",")}]`;
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical((obj as any)[k])}`).join(",")}}`;
}

export function signReceipt(receipt: unknown, privateKey: KeyObject): string {
  return crypto.sign(null, Buffer.from(canonical(receipt)), privateKey).toString("base64");
}

export function verifyReceipt(receipt: unknown, signatureB64: string, publicKey: KeyObject): boolean {
  return crypto.verify(null, Buffer.from(canonical(receipt)), publicKey, Buffer.from(signatureB64, "base64"));
}

export function sha256Hex(...parts: string[]): string {
  const h = crypto.createHash("sha256");
  for (const p of parts) h.update(p);
  return h.digest("hex");
}
