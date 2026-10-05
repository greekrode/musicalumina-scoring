/**
 * Average of jury scores (one decimal each), rounded to 2 dp like the prize
 * bands (numeric(5,2)). Summed in tenths so [74.9, 75.1, 75, 75] is exactly
 * 75.00 and lands in the 75+ band, and equal results tie exactly.
 */
export function averageScore(scores: number[]): number {
  if (scores.length === 0) return 0;
  const tenths = scores.reduce((sum, s) => sum + Math.round(Number(s) * 10), 0);
  return Math.round((tenths / scores.length) * 10) / 100;
}
