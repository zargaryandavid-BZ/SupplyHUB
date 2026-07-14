import "server-only";
import { createHash } from "crypto";
import { supabaseAdmin } from "./supabaseServer";
import { getSettings } from "./settings";

export function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "");
  return digits;
}

function isEmail(s: string): boolean {
  return s.includes("@");
}

export type OtpActor =
  | { type: "manager"; phone: string | null; display: string }
  | { type: "partner"; id: number; phone: string | null; display: string };

/** Find who the identifier (phone or email) belongs to. */
export async function lookupActor(identifier: string): Promise<OtpActor | null> {
  const id = identifier.trim();
  const sb = supabaseAdmin();
  const settings = await getSettings();

  if (isEmail(id)) {
    const lc = id.toLowerCase();
    const managerEmails = [settings.manager_email, settings.contact_email]
      .filter(Boolean)
      .map((e) => e!.toLowerCase());

    if (managerEmails.includes(lc)) {
      return {
        type: "manager",
        phone: settings.manager_phone || settings.contact_phone || null,
        display: settings.company_name || "Manager",
      };
    }

    // Partner by portal_email or email
    const { data: p } = await sb
      .from("partners")
      .select("id, company, phone")
      .or(`portal_email.ilike.${lc},email.ilike.${lc}`)
      .maybeSingle();
    if (p) return { type: "partner", id: p.id, phone: p.phone, display: p.company };

    return null;
  }

  // Phone lookup
  const normalized = normalizePhone(id);
  if (normalized.length < 7) return null;

  const managerPhones = [settings.manager_phone, settings.contact_phone]
    .filter(Boolean)
    .map((p) => normalizePhone(p!));

  if (managerPhones.some((mp) => mp === normalized || mp.endsWith(normalized) || normalized.endsWith(mp))) {
    return {
      type: "manager",
      phone: settings.manager_phone || settings.contact_phone || null,
      display: settings.company_name || "Manager",
    };
  }

  // Partner by phone (flexible match — strip country code variants)
  const { data: partners } = await sb
    .from("partners")
    .select("id, company, phone")
    .not("phone", "is", null);

  const match = (partners ?? []).find((p) => {
    if (!p.phone) return false;
    const pp = normalizePhone(p.phone);
    return pp === normalized || pp.endsWith(normalized) || normalized.endsWith(pp);
  });
  if (match) return { type: "partner", id: match.id, phone: match.phone, display: match.company };

  return null;
}

/** Send OTP via SMS using Twilio. Returns true on success or when in dev mode. */
export async function sendOtpSms(
  phone: string,
  code: string,
  companyName: string
): Promise<boolean> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!sid || !token || !from) {
    console.log(`[OTP:dev] Code for ${phone}: ${code}`);
    return true;
  }

  const body = `Your ${companyName} login code is: ${code}. Valid for 10 minutes. Don't share it.`;
  const params = new URLSearchParams({ To: phone, From: from, Body: body });
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
    const txt = await res.text().catch(() => "");
    console.error("[OTP:sms] Twilio error:", res.status, txt);
  }
  return res.ok;
}
