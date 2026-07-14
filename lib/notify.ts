// Sends notifications. SMS uses Twilio when env vars are set; otherwise logs.

type Channel = "email" | "sms" | "whatsapp" | "phone";

function extractPhone(to: string, phone?: string | null): string | null {
  const raw = (phone || "").trim() || to.split("/").map((s) => s.trim()).find((s) => /\d{7,}/.test(s)) || "";
  const digits = raw.replace(/[^\d+]/g, "");
  if (digits.replace(/\D/g, "").length < 8) return null;
  return digits.startsWith("+") ? digits : digits;
}

async function sendSms(to: string, body: string): Promise<void> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!sid || !token || !from) {
    console.log(`[NOTIFY:SMS:skip] Twilio not configured → ${to}\n  ${body}\n`);
    return;
  }

  const params = new URLSearchParams({ To: to, From: from, Body: body });
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    }
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`[NOTIFY:SMS:error] ${res.status} → ${to}`, text);
  } else {
    console.log(`[NOTIFY:SMS:sent] → ${to}`);
  }
}

export async function notify(opts: {
  to: string;
  phone?: string | null;
  channels: Channel[];
  subject: string;
  body: string;
}) {
  const { to, phone, channels, subject, body } = opts;
  for (const ch of channels) {
    if (ch === "sms") {
      const dest = extractPhone(to, phone);
      if (dest) {
        await sendSms(dest, body);
      } else {
        console.log(`[NOTIFY:SMS:skip] no phone on ${to}\n  ${body}\n`);
      }
      continue;
    }
    console.log(
      `\n[NOTIFY:${ch.toUpperCase()}] -> ${to}\n  ${subject}\n  ${body}\n`
    );
  }
}
