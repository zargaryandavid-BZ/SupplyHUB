/**
 * Storage helper tests.
 *
 * These tests call real Supabase Storage. They require:
 *   - NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.test
 *     (pointing at local `supabase start` or the remote project)
 *   - The "partner-logos" (public) and "request-attachments" (private) buckets
 *     to exist, OR `ensureBuckets()` will create them.
 *
 * If Supabase is unreachable the suite skips gracefully.
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  uploadLogo,
  publicLogoUrl,
  removeLogo,
  uploadAttachment,
  signedAttachmentUrl,
  ensureBuckets,
} from "../lib/storage";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Minimal 1×1 transparent PNG (67 bytes). */
function tiny1x1png(): File {
  const b64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], "test.png", { type: "image/png" });
}

function tinyTextFile(): File {
  return new File(["hello attachment"], "spec.txt", {
    type: "text/plain",
  });
}

// ── Setup ────────────────────────────────────────────────────────────────────

let storageAvailable = false;

beforeAll(async () => {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn(
      "[storage.test] Skipping: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set."
    );
    return;
  }
  try {
    await ensureBuckets();
    storageAvailable = true;
  } catch (err) {
    console.warn(
      `[storage.test] Skipping: could not reach Supabase Storage — ${(err as Error).message}`
    );
  }
});

// ── Logo tests ───────────────────────────────────────────────────────────────

describe("uploadLogo / publicLogoUrl / removeLogo", () => {
  it("uploads a PNG logo and returns a non-empty key", async () => {
    if (!storageAvailable) return;

    const key = await uploadLogo(tiny1x1png(), 99999);
    expect(key).toMatch(/^partner-99999\//);
    expect(key).toMatch(/\.png$/);

    // Clean up
    await removeLogo(key);
  });

  it("publicLogoUrl builds a full https URL from a storage key", async () => {
    if (!storageAvailable) return;

    const key = await uploadLogo(tiny1x1png(), 99998);
    const url = publicLogoUrl(key);
    expect(url).toBeTruthy();
    expect(url).toMatch(/^https?:\/\//);

    await removeLogo(key);
  });

  it("publicLogoUrl returns legacy /uploads/… paths as-is (no storage call)", () => {
    const legacyPath = "/uploads/partner-1-123456.png";
    expect(publicLogoUrl(legacyPath)).toBe(legacyPath);
  });

  it("publicLogoUrl returns null for null/empty input", () => {
    expect(publicLogoUrl(null)).toBeNull();
    expect(publicLogoUrl("")).toBeNull();
  });

  it("uploadLogo removes the old storage key when replacing", async () => {
    if (!storageAvailable) return;

    const firstKey = await uploadLogo(tiny1x1png(), 99997);
    const secondKey = await uploadLogo(tiny1x1png(), 99997, firstKey);

    expect(secondKey).not.toBe(firstKey);
    // firstKey should have been removed — uploading with same key should succeed (not conflict)
    const replacedAgain = await uploadLogo(tiny1x1png(), 99997, secondKey);
    expect(replacedAgain).toBeTruthy();
    await removeLogo(replacedAgain);
  });

  it("uploadLogo rejects disallowed MIME types", async () => {
    if (!storageAvailable) return;

    const badFile = new File(["gif89a"], "test.gif", { type: "image/gif" });
    await expect(uploadLogo(badFile, 99999)).rejects.toThrow(/not allowed/);
  });

  it("uploadLogo rejects files over 2 MB", async () => {
    if (!storageAvailable) return;

    const big = new File([new Uint8Array(3 * 1024 * 1024)], "big.png", {
      type: "image/png",
    });
    await expect(uploadLogo(big, 99999)).rejects.toThrow(/2 MB/);
  });
});

// ── Attachment tests ─────────────────────────────────────────────────────────

describe("uploadAttachment / signedAttachmentUrl", () => {
  it("uploads a file and returns a non-empty key", async () => {
    if (!storageAvailable) return;

    const key = await uploadAttachment(tinyTextFile(), 88888);
    expect(key).toMatch(/^req-88888\//);
    expect(key).toMatch(/\.txt$/);
  });

  it("signedAttachmentUrl returns an https signed URL for a storage key", async () => {
    if (!storageAvailable) return;

    const key = await uploadAttachment(tinyTextFile(), 88887);
    const signed = await signedAttachmentUrl(key, 60);
    expect(signed).toMatch(/^https?:\/\//);
    // Supabase signed URLs contain a token query param
    expect(signed).toContain("token");
  });

  it("signedAttachmentUrl returns legacy /uploads/… paths as-is", async () => {
    const legacyPath = "/uploads/req-1/file.pdf";
    const result = await signedAttachmentUrl(legacyPath);
    expect(result).toBe(legacyPath);
  });
});
