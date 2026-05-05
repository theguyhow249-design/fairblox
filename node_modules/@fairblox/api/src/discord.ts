import { request as httpsRequest } from "node:https";
import { request as httpRequest } from "node:http";
import { URL } from "node:url";

const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL?.trim() || "";

const SEVERITY_COLOR: Record<"error" | "warn" | "info", number> = {
  error: 0xff4444,
  warn: 0xf59e0b,
  info: 0x60a5fa,
};

export type AlertSeverity = "error" | "warn" | "info";

export interface AlertOptions {
  severity?: AlertSeverity;
  title: string;
  description?: string;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  actor?: string;
}

export function sendAlert(opts: AlertOptions): void {
  if (!WEBHOOK_URL) {
    return;
  }
  const severity = opts.severity ?? "error";
  const timestamp = new Date().toISOString();
  const embed = {
    title: opts.title,
    description: opts.description ?? "",
    color: SEVERITY_COLOR[severity],
    timestamp,
    fields: [
      ...(opts.actor ? [{ name: "Actor", value: opts.actor, inline: true }] : []),
      ...(opts.fields ?? []),
    ],
    footer: { text: "fairblox-api" },
  };
  const payload = JSON.stringify({ embeds: [embed] });
  dispatchWebhook(WEBHOOK_URL, payload);
}

function dispatchWebhook(url: string, payload: string): void {
  try {
    const parsed = new URL(url);
    const isHttps = parsed.protocol === "https:";
    const requester = isHttps ? httpsRequest : httpRequest;
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + (parsed.search || ""),
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
      },
    };
    const req = requester(options, (res) => {
      res.resume();
    });
    req.on("error", () => {
      // Swallow network errors silently — alerts must never crash the API.
    });
    req.write(payload);
    req.end();
  } catch {
    // Swallow all errors to avoid crashing the server.
  }
}
