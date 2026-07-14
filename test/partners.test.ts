import { describe, it, expect, beforeEach } from "vitest";
import { resetDb } from "./helpers";
import { allPartners, activePartners, partnerRequests, partnerRequestDetail } from "../lib/data";
import {
  addPartner,
  updatePartner,
  deletePartner,
  setPartnerActive,
  partnerHasHistory,
  inviteMessageFor,
} from "../lib/partners";

// Seed reference (from supabase/migrations/0003_test_helpers.sql reset_and_reseed()):
//  Partner 1 (PrintPro)   → dispatch 1 (request 1)
//  Partner 2 (ColorMax)   → dispatches 2, 3 (requests 1, 2)
//  Partner 3 (BigFormat)  → dispatches 4, 5 (requests 2, 3)
//  Partner 4 (EcoPack)    → no dispatches (safe to delete)

beforeEach(async () => {
  await resetDb();
});

describe("addPartner", () => {
  it("creates a partner with all new fields and correct defaults", async () => {
    const p = await addPartner({
      company: "Test Print Co",
      contact: "Jane Doe",
      email: "jane@testprint.com",
      phone: "+1 800 555 0100",
      categories: "flyers,posters",
      location: "Portland, US",
      preferred_channels: "email,sms",
      avg_delivery_days: 10,
      website: "https://testprint.example.com",
      bank_name: "Test Bank",
      bank_account: "US00 1234 5678",
      portal_contact_name: "Jane Doe",
      portal_email: "jane@testprint.com",
      logo_path: null,
    });

    expect(p.company).toBe("Test Print Co");
    expect(p.location).toBe("Portland, US");
    expect(p.preferred_channels).toBe("email,sms");
    expect(p.avg_delivery_days).toBe(10);
    expect(p.website).toBe("https://testprint.example.com");
    expect(p.bank_name).toBe("Test Bank");
    expect(p.bank_account).toBe("US00 1234 5678");
    expect(p.portal_contact_name).toBe("Jane Doe");
    expect(p.portal_email).toBe("jane@testprint.com");
    expect(p.logo_path).toBeNull();
    expect(p.active).toBe(1);
    expect(p.rating).toBe(0);

    // persisted in the store
    const found = (await allPartners()).find((x) => x.id === p.id);
    expect(found).toBeDefined();
    expect(found!.bank_account).toBe("US00 1234 5678");
    expect(found!.location).toBe("Portland, US");
  });

  it("sets null for omitted optional fields", async () => {
    const p = await addPartner({ company: "Minimal Co" });
    expect(p.location).toBeNull();
    expect(p.preferred_channels).toBeNull();
    expect(p.avg_delivery_days).toBeNull();
    expect(p.website).toBeNull();
    expect(p.logo_path).toBeNull();
    expect(p.bank_name).toBeNull();
    expect(p.bank_account).toBeNull();
    expect(p.portal_contact_name).toBeNull();
    expect(p.portal_email).toBeNull();
  });
});

describe("updatePartner", () => {
  it("changes specified fields and leaves others intact", async () => {
    const updated = await updatePartner(1, { location: "New York, US", avg_delivery_days: 20 });
    expect(updated).toBeDefined();
    expect(updated!.location).toBe("New York, US");
    expect(updated!.avg_delivery_days).toBe(20);
    // unchanged fields must still be there
    expect(updated!.company).toBe("PrintPro Bindery");
    expect(updated!.email).toBe("alex@printpro.com");
    expect(updated!.rating).toBe(4.6);
  });

  it("persists the change to the store", async () => {
    await updatePartner(1, { website: "https://new.example.com" });
    expect((await allPartners()).find((p) => p.id === 1)!.website).toBe("https://new.example.com");
  });

  it("returns undefined for an unknown id", async () => {
    expect(await updatePartner(9999, { location: "Nowhere" })).toBeUndefined();
  });
});

describe("deletePartner", () => {
  it("hard-deletes a partner with no dispatch history", async () => {
    // EcoPack (id 4) has no dispatches in seed
    const result = await deletePartner(4);
    expect(result).toEqual({ ok: true });
    expect((await allPartners()).find((p) => p.id === 4)).toBeUndefined();
  });

  it("refuses to delete a partner that has dispatch history", async () => {
    // PrintPro (id 1) has dispatches in seed
    const result = await deletePartner(1);
    expect(result).toEqual({ ok: false, reason: "has_history" });
    // partner must still exist
    expect((await allPartners()).find((p) => p.id === 1)).toBeDefined();
  });

  it("returns ok:true for a non-existent id with no history", async () => {
    // Id 9999 doesn't exist — no history so ok:true (idempotent)
    const result = await deletePartner(9999);
    expect(result.ok).toBe(true);
  });
});

describe("setPartnerActive", () => {
  it("deactivated partner is hidden from activePartners but kept in allPartners", async () => {
    await setPartnerActive(4, false);
    expect((await allPartners()).find((p) => p.id === 4)).toBeDefined();
    expect((await activePartners()).find((p) => p.id === 4)).toBeUndefined();
  });

  it("reactivating a partner restores them in activePartners", async () => {
    await setPartnerActive(4, false);
    await setPartnerActive(4, true);
    expect((await activePartners()).find((p) => p.id === 4)).toBeDefined();
  });

  it("persists the active flag to the store", async () => {
    await setPartnerActive(1, false);
    expect((await allPartners()).find((p) => p.id === 1)!.active).toBe(0);
    await setPartnerActive(1, true);
    expect((await allPartners()).find((p) => p.id === 1)!.active).toBe(1);
  });
});

describe("partnerHasHistory", () => {
  it("returns true when partner has dispatches", async () => {
    expect(await partnerHasHistory(1)).toBe(true); // PrintPro has dispatch
    expect(await partnerHasHistory(3)).toBe(true); // BigFormat has dispatches
  });

  it("returns false when partner has no dispatches", async () => {
    expect(await partnerHasHistory(4)).toBe(false); // EcoPack has none
  });
});

describe("inviteMessageFor", () => {
  it("uses preferred_channels when set", async () => {
    const p = await addPartner({
      company: "Channel Test Co",
      preferred_channels: "sms,whatsapp",
      email: "contact@channeltest.com",
      portal_email: "portal@channeltest.com",
    });
    const msg = inviteMessageFor(p);
    expect(msg.channels).toEqual(["sms", "whatsapp"]);
    expect(msg.to).toBe("portal@channeltest.com"); // portal_email takes priority
    expect(msg.subject).toContain("SupplyHUB");
    expect(msg.body).toContain("Channel Test Co");
  });

  it("falls back to email channel when preferred_channels is null or empty", async () => {
    const p = await addPartner({ company: "No Channel Co", email: "contact@nochannel.com" });
    const msg = inviteMessageFor(p);
    expect(msg.channels).toEqual(["email"]);
  });

  it("addresses portal_email over email when both are set", async () => {
    const p = await addPartner({
      company: "Both Emails Co",
      email: "general@both.com",
      portal_email: "portal@both.com",
    });
    expect(inviteMessageFor(p).to).toBe("portal@both.com");
  });

  it("falls back to email when portal_email is null", async () => {
    const p = await addPartner({ company: "Fallback Co", email: "fallback@example.com" });
    expect(inviteMessageFor(p).to).toBe("fallback@example.com");
  });

  it("mentions the portal contact name in the body when set", async () => {
    const p = await addPartner({
      company: "Named Portal Co",
      portal_contact_name: "Bob Smith",
      portal_email: "bob@namedportal.com",
    });
    const msg = inviteMessageFor(p);
    expect(msg.body).toContain("Bob Smith");
  });
});

describe("partner data isolation regression (new fields must not leak)", () => {
  it("partnerRequests rows do not expose sensitive fields", async () => {
    const rows = await partnerRequests(1); // PrintPro
    for (const row of rows) {
      const r = row as Record<string, unknown>;
      expect(r.bank_account).toBeUndefined();
      expect(r.bank_name).toBeUndefined();
      expect(r.portal_email).toBeUndefined();
      expect(r.portal_contact_name).toBeUndefined();
    }
  });

  it("partnerRequestDetail row does not expose sensitive fields", async () => {
    const detail = (await partnerRequestDetail(1, 1))!;
    const row = detail.row as Record<string, unknown>;
    expect(row.bank_account).toBeUndefined();
    expect(row.bank_name).toBeUndefined();
    expect(row.portal_email).toBeUndefined();
    expect(row.portal_contact_name).toBeUndefined();
  });

  it("partnerRequestDetail does not include client_name (existing rule)", async () => {
    const detail = (await partnerRequestDetail(1, 1))!;
    expect((detail.row as Record<string, unknown>).client_name).toBeUndefined();
  });
});
