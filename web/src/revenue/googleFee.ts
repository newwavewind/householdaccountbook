/** Optional what-if calculation. Imported reports never call this helper. */
import type { RevenueRow } from "./types";

export const GOOGLE_FEE_RATE_REDUCED = 0.15;
export const GOOGLE_FEE_RATE_STANDARD = 0.3;

export type GoogleShareEstimate = {
  fee: number | null;
  proceeds: number | null;
  tax: number | null;
  rate: number;
  estimated: true;
};

/** Both the fee rate and report tax must be provided; never infer tax by currency. */
export function estimateGoogleDeveloperShare(input: {
  gross: number;
  refunds: number;
  tax: number | null;
  country?: string;
  currency?: string;
  rate: number;
}): GoogleShareEstimate {
  if (!Number.isFinite(input.rate) || input.rate < 0 || input.rate > 1)
    throw new Error("수수료율은 0과 1 사이여야 합니다.");
  const base = input.tax === null ? null : input.gross - input.refunds - input.tax;
  const fee = base === null ? null : base * input.rate;
  return {
    fee,
    proceeds: base === null || fee === null ? null : base - fee,
    tax: input.tax,
    rate: input.rate,
    estimated: true,
  };
}

/** Kept for older callers: missing provider proceeds remain unknown. */
export function isGoogleEstimatedShare(row: {
  platform: string;
  basis: string;
  proceeds: number | null;
}) {
  return row.platform === "google" && row.basis === "estimate" && row.proceeds === null;
}

/** Import/loading must not rewrite accounting records with an assumed fee rate. */
export function fillGoogleEstimatedShares(rows: RevenueRow[]): RevenueRow[] {
  return rows;
}
