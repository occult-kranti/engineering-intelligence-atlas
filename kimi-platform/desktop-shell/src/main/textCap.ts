/**
 * UTF-8-safe text capping with explicit truncation metadata.
 *
 * Strings are JS UTF-16; slicing at an arbitrary index can split a surrogate
 * pair, which then produces the U+FFFD replacement character when encoded to
 * UTF-8. `capUtf8` backs the cut point off a dangling lead surrogate so the
 * capped text round-trips cleanly through UTF-8, and reports exactly what was
 * removed.
 */

export interface CappedText {
  text: string;
  truncated: boolean;
  /** Code units of the ORIGINAL string (matches String.length semantics). */
  originalLength: number;
  /** Code units actually kept. */
  keptLength: number;
}

export function capUtf8(input: string, maxChars: number): CappedText {
  if (!Number.isInteger(maxChars) || maxChars < 1) throw new Error('maxChars must be a positive integer');
  if (input.length <= maxChars) {
    return { text: input, truncated: false, originalLength: input.length, keptLength: input.length };
  }
  let cut = maxChars;
  // Never split a surrogate pair: if the last kept code unit is a lead
  // surrogate, drop it (the trail surrogate belongs to the removed part).
  const lastCode = input.charCodeAt(cut - 1);
  if (lastCode >= 0xd800 && lastCode <= 0xdbff) cut -= 1;
  return {
    text: input.slice(0, cut),
    truncated: true,
    originalLength: input.length,
    keptLength: cut,
  };
}

/** Deterministic truncation marker with explicit metadata. */
export function truncationMarker(capped: CappedText): string {
  return `[truncated: showing ${capped.keptLength} of ${capped.originalLength} characters]`;
}
