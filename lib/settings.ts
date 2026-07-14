import "server-only";
import { supabaseAdmin } from "./supabaseServer";
import type { CompanySettings } from "./types";

export async function getSettings(): Promise<CompanySettings> {
  const { data } = await supabaseAdmin()
    .from("company_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  return (
    data ?? {
      id: 1,
      company_name: null,
      logo_path: null,
      hq_address: null,
      branches: null,
      ci_number: null,
      ein: null,
      bank_name: null,
      bank_account: null,
      swift: null,
      payment_terms: null,
      manager_name: null,
      manager_phone: null,
      manager_email: null,
      contact_name: null,
      contact_phone: null,
      contact_email: null,
      updated_at: null,
    }
  );
}

export async function upsertSettings(
  values: Partial<Omit<CompanySettings, "id" | "updated_at">>
): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("company_settings")
    .upsert(
      { id: 1, ...values, updated_at: new Date().toISOString() },
      { onConflict: "id" }
    );

  if (error) {
    throw new Error(`Failed to save settings: ${error.message}`);
  }
}
