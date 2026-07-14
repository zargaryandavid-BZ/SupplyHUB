export const DEFAULT_SMS_NEW_REQUEST = [
  "You have a new order request from {{company_name}} (SupplyHUB).",
  "{{title}}",
  "Open: {{link}}",
].join("\n");

export const DEFAULT_SMS_UPDATE = [
  "Hi {{partner_name}}, an order request from {{company_name}} has been updated.",
  "{{title}} · Qty {{quantity}} · Needed by {{needed_by}}",
  "Review the latest details: {{link}}",
].join("\n");

export const DEFAULT_SMS_WON = [
  "Congratulations {{partner_name}}! You won the project from {{company_name}} (SupplyHUB).",
  "{{title}} · Qty {{quantity}} · {{currency}} {{price}} · Lead time {{lead_time_days}} days",
  "Needed by: {{needed_by}}",
  "Open: {{link}}",
].join("\n");

export const DEFAULT_SMS_INVITE = [
  "Hi {{partner_name}}, you've been invited to the {{company_name}} supplier portal.",
  "Use this link to log in — no password needed:",
  "{{link}}",
].join("\n");

export function appBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`;
  return "http://localhost:3000";
}

/** Fill {{placeholders}} in a template. Missing values become empty string. */
export function fillTemplate(
  template: string,
  vars: Record<string, string | number | null | undefined>
): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    const v = vars[key];
    if (v == null || v === "") return "";
    return String(v);
  }).replace(/\n{3,}/g, "\n\n").trim();
}

export function partnerRequestLink(opts: {
  portalToken: string | null | undefined;
  requestId: number;
}): string {
  const base = appBaseUrl();
  const next = `/partner/requests/${opts.requestId}`;
  if (opts.portalToken) {
    return `${base}/api/portal?token=${encodeURIComponent(opts.portalToken)}&next=${encodeURIComponent(next)}`;
  }
  return `${base}${next}`;
}
