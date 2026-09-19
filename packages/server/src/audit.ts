import { loadOrCreateKeys, AuditLog } from "@isochron/receipts";

const keys = loadOrCreateKeys("data/origin.key", "data/origin.pub");
export const auditLog = new AuditLog("data/audit.log", keys.privateKey);
