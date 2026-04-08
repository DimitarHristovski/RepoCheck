import { randomUUID } from "crypto";
import { appendAuditLog } from "@/lib/store/repository";
import { logger } from "@/lib/logger";

export function writeAuditLog(input: {
  actor: string;
  action: string;
  resource?: string;
  detail?: Record<string, unknown>;
}) {
  try {
    appendAuditLog({
      id: randomUUID(),
      actor: input.actor,
      action: input.action,
      resource: input.resource ?? null,
      detailJson: input.detail ?? null,
    });
  } catch (e) {
    logger.error({ err: e }, "audit log write failed");
  }
}
