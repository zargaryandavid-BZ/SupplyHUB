// Notification stub for local development.
// In production this is where Resend (email) and Twilio (SMS) calls go.
// For now it logs to the server console so you can see the flow working.

type Channel = "email" | "sms" | "whatsapp" | "phone";

export function notify(opts: {
  to: string;
  channels: Channel[];
  subject: string;
  body: string;
}) {
  const { to, channels, subject, body } = opts;
  for (const ch of channels) {
    console.log(
      `\n[NOTIFY:${ch.toUpperCase()}] -> ${to}\n  ${subject}\n  ${body}\n`
    );
  }
}
