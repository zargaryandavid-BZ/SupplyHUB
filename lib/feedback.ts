import "server-only";
import type { Actor } from "./session";

export const TENANT_ID = 1;
export const MAX_IMAGES = 5;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB

export function actorUserId(actor: Actor): number {
  if (actor.role === "manager") return 0;
  if (actor.role === "partner") return actor.partnerId;
  return -1;
}

export function actorDisplayName(actor: Actor): string {
  if (actor.role === "manager") return "Distribution Manager";
  if (actor.role === "partner") {
    return actor.partner.company ?? actor.partner.contact ?? "Partner";
  }
  return "Unknown";
}

export function isAdmin(actor: Actor): boolean {
  return actor.role === "manager";
}
