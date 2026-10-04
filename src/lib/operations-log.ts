import "server-only";
import { randomUUID } from "node:crypto";

type Context = Record<string, string | number | boolean | null | undefined>;

export function operationalError(event: string, context: Context = {}) {
  const correlationId = randomUUID();
  console.error(`[sauti:${event}]`, JSON.stringify({ correlationId, ...context, timestamp: new Date().toISOString() }));
  return correlationId;
}
