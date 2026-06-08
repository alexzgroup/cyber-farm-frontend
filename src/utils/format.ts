/**
 * Format a gold balance: up to 3 decimal places, trailing zeros stripped.
 *   403.700  → "403.7"
 *   403.010  → "403.01"
 *   403.001  → "403.001"
 *   403.000  → "403"
 *   0.010    → "0.01"
 */
export function fmtGold(n: number): string {
  return parseFloat(n.toFixed(3)).toString()
}
