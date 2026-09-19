import crypto, { type KeyObject } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export interface KeyPair { privateKey: KeyObject; publicKey: KeyObject; }

export function loadOrCreateKeys(privPath: string, pubPath: string): KeyPair {
  if (existsSync(privPath) && existsSync(pubPath)) {
    return {
      privateKey: crypto.createPrivateKey(readFileSync(privPath)),
      publicKey: crypto.createPublicKey(readFileSync(pubPath)),
    };
  }
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
  mkdirSync(dirname(privPath), { recursive: true });
  writeFileSync(privPath, privateKey.export({ type: "pkcs8", format: "pem" }));
  writeFileSync(pubPath, publicKey.export({ type: "spki", format: "pem" }));
  return { privateKey, publicKey };
}
