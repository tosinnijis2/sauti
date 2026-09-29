import "server-only";

export type EmailMessage = { to: string; subject: string; text: string; idempotencyKey?: string };
export type EmailTransport = { send(message: EmailMessage): Promise<void> };

export class EmailDeliveryError extends Error {
  constructor(public readonly code: string, public readonly transient: boolean) {
    super(code);
  }
}

function configuredTransport(): EmailTransport | null {
  const { RESEND_API_KEY, EMAIL_FROM } = process.env;
  if (!RESEND_API_KEY || !EMAIL_FROM) return null;
  return {
    async send(message) {
      let response: Response;
      try {
        response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json", ...(message.idempotencyKey ? { "Idempotency-Key": message.idempotencyKey } : {}) },
          body: JSON.stringify({ from: EMAIL_FROM, to: [message.to], subject: message.subject, text: message.text }),
          signal: AbortSignal.timeout(10_000),
        });
      } catch {
        throw new EmailDeliveryError("network", true);
      }
      if (!response.ok) throw new EmailDeliveryError(response.status >= 500 || response.status === 429 ? `resend-${response.status}` : "resend-rejected", response.status >= 500 || response.status === 429);
    },
  };
}

let transportOverride: EmailTransport | null | undefined;

export function emailIsConfigured() {
  return Boolean(transportOverride === undefined ? configuredTransport() : transportOverride);
}

export async function sendEmail(message: EmailMessage) {
  const transport = transportOverride === undefined ? configuredTransport() : transportOverride;
  if (!transport) throw new EmailDeliveryError("provider-unconfigured", false);
  await transport.send(message);
}

export function setEmailTransportForTests(transport: EmailTransport | null | undefined) {
  transportOverride = transport;
}
