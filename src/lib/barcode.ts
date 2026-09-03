// EAN-13 generation and rendering, hand-rolled — no dependency.
//
// EAN-13 rather than Code128 because that is what an off-the-shelf retail
// scanner reads out of the box, and its encoding tables are small enough to be
// verifiable by eye (three tables of ten 7-bit patterns) instead of a 107-entry
// width table transcribed by hand.
//
// Generated codes use the 200–299 prefix range, which GS1 reserves for
// in-store use: they are guaranteed never to collide with a manufacturer's
// real barcode, so the shop can print its own labels safely.

const L = [
  "0001101", "0011001", "0010011", "0111101", "0100011",
  "0110001", "0101111", "0111011", "0110111", "0001011",
];
const G = [
  "0100111", "0110011", "0011011", "0100001", "0011101",
  "0111001", "0000101", "0010001", "0001001", "0010111",
];
const R = [
  "1110010", "1100110", "1101100", "1000010", "1011100",
  "1001110", "1010000", "1000100", "1001000", "1110100",
];

/** Which of the first six digits use the G table, selected by the 13th digit. */
const PARITY = [
  "LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG",
  "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL",
];

/** The check digit for the first 12 digits of an EAN-13. */
export function ean13CheckDigit(twelve: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    // Positions are 1-indexed: even ones weigh 3, odd ones weigh 1.
    sum += Number(twelve[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return (10 - (sum % 10)) % 10;
}

export function isValidEan13(code: string): boolean {
  if (!/^\d{13}$/.test(code)) return false;
  return ean13CheckDigit(code.slice(0, 12)) === Number(code[12]);
}

/** A fresh in-store EAN-13 (prefix 200, so it can never clash with a real one). */
export function generateEan13(): string {
  let body = "200";
  for (let i = 0; i < 9; i++) body += Math.floor(Math.random() * 10);
  return body + ean13CheckDigit(body);
}

/** EAN-13 symbol geometry, in modules. */
export const EAN13_MODULES = 95;
/** GS1 minimum quiet zones for EAN-13: 11 modules left of the symbol, 7 right.
 * The old value (9 each side) was under spec on the left and is a real reason a
 * cheap scanner refuses to read a printed label. */
export const EAN13_QUIET_LEFT = 11;
export const EAN13_QUIET_RIGHT = 7;

/**
 * The 95-module bit string for a valid EAN-13, or null if the code is not one.
 * "1" is a bar, "0" a space.
 */
export function ean13Bits(code: string): string | null {
  if (!isValidEan13(code)) return null;

  const digits = code.split("").map(Number);
  const parity = PARITY[digits[0]];

  let bits = "101"; // start guard
  for (let i = 0; i < 6; i++) {
    const digit = digits[i + 1];
    bits += parity[i] === "L" ? L[digit] : G[digit];
  }
  bits += "01010"; // centre guard
  for (let i = 0; i < 6; i++) bits += R[digits[i + 7]];
  bits += "101"; // end guard

  return bits;
}

/**
 * Merge the bit string into `<rect>`-ready runs, so a 95-module barcode renders
 * as ~30 rects instead of 95. Scanners read contrast edges, and adjacent
 * same-colour rects can hairline-seam when the browser rasterises them at a
 * fractional scale — one rect per run removes the seam entirely.
 */
export function barcodeRuns(bits: string): Array<{ x: number; width: number }> {
  const runs: Array<{ x: number; width: number }> = [];
  let i = 0;
  while (i < bits.length) {
    if (bits[i] === "0") {
      i++;
      continue;
    }
    let width = 0;
    while (i + width < bits.length && bits[i + width] === "1") width++;
    runs.push({ x: i, width });
    i += width;
  }
  return runs;
}
