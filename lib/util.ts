/** Returns current UTC time as a "YYYY-MM-DD HH:MM:SS" string (same format as the old JSON store). */
export function now(): string {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}
