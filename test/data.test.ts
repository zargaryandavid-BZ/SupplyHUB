import { describe, it, expect, beforeEach } from "vitest";
import { resetDb } from "./helpers";
import {
  partnerRequests,
  partnerRequestDetail,
  requestDetail,
  managerRequests,
  partnerStats,
} from "../lib/data";

// Seed reference (from supabase/migrations/0003_test_helpers.sql reset_and_reseed()):
//  Request 1 "Hardcover Books"  -> dispatched to Partner 1 (PrintPro) + Partner 2 (ColorMax), AWARDED to PrintPro
//  Request 2 "Tri-fold Brochures" -> Partner 2 (ColorMax) + Partner 3 (BigFormat)
//  Request 3 "Roll-up Banners"  -> Partner 3 (BigFormat) only

beforeEach(async () => {
  await resetDb(); // fresh seeded database for each test
});

describe("partner data isolation (the critical rule)", () => {
  it("a partner only sees requests dispatched to them", async () => {
    const printProIds = (await partnerRequests(1)).map((r) => r.id).sort();
    expect(printProIds).toEqual([1]); // PrintPro only got request 1

    const bigFormatIds = (await partnerRequests(3)).map((r) => r.id).sort();
    expect(bigFormatIds).toEqual([2, 3]); // BigFormat got 2 and 3, never 1
  });

  it("a partner cannot open a request that was not sent to them", async () => {
    // Request 1 was NOT dispatched to Partner 3 (BigFormat)
    expect(await partnerRequestDetail(3, 1)).toBeUndefined();
    // But Partner 1 (PrintPro) can open request 1
    expect((await partnerRequestDetail(1, 1))?.row.id).toBe(1);
  });

  it("the partner view never carries the client's identity", async () => {
    const detail = (await partnerRequestDetail(1, 1))!;
    // The row is a ProductRequest — it must not expose a client name field
    expect((detail.row as Record<string, unknown>).client_name).toBeUndefined();
  });
});

describe("manager view", () => {
  it("exposes client and aggregate quote info to the manager", async () => {
    const detail = (await requestDetail(1))!;
    expect(detail.request.client_name).toBe("Acme Publishing");
    // Request 1 has two quotes (PrintPro won, ColorMax lost)
    expect(detail.offers.length).toBe(2);
  });

  it("board rows summarise partner and quote counts", async () => {
    const rows = await managerRequests();
    const r1 = rows.find((r) => r.id === 1)!;
    expect(r1.partner_count).toBe(2);
    expect(r1.quote_count).toBe(2);
    expect(r1.best_price).toBe(12000); // lowest of 12000 / 13500
  });
});

describe("partner stats", () => {
  it("computes win rate from awarded quotes", async () => {
    // PrintPro (id 1): 1 dispatch, 1 win -> 100%
    expect(await partnerStats(1)).toMatchObject({ sent: 1, won: 1, winRate: 100 });
    // ColorMax (id 2): 2 dispatches, 0 wins -> 0%
    expect(await partnerStats(2)).toMatchObject({ sent: 2, won: 0, winRate: 0 });
  });
});
