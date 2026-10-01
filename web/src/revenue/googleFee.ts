/** Google Play 서비스 수수료 추정 — 확정 earnings 전 예상 매출용. */

import type { RevenueRow } from "./types";

/** Play 서비스 수수료 기본. 이 계정의 earnings는 매월 30%로 확인됨. */
export const GOOGLE_FEE_RATE_REDUCED = 0.3;
/** 연 100만달러 이하 할인율(해당 시). */
export const GOOGLE_FEE_RATE_STANDARD = 0.15;

export type GoogleShareEstimate = {
  fee: number;
  proceeds: number;
  tax: number | null;
  rate: number;
  estimated: true;
};

/**
 * Charged Amount 기준 개발자 몫 추정.
 * 세금이 없으면 KR/KRW는 부가세 10% 포함으로 가정한 뒤, 세전 금액에 수수료율 적용.
 */
export function estimateGoogleDeveloperShare(input: {
  gross: number;
  refunds: number;
  tax: number | null;
  country?: string;
  currency?: string;
  rate?: number;
}): GoogleShareEstimate {
  const rate = input.rate ?? GOOGLE_FEE_RATE_REDUCED; // 기본 30%
  const net = input.gross - input.refunds;
  let tax = input.tax;
  if (
    tax === null &&
    net !== 0 &&
    (input.country === "KR" || input.currency === "KRW")
  ) {
    tax = Math.round(net - net / 1.1);
  }
  const taxPart = tax ?? 0;
  const base = net - taxPart;
  const fee = Math.round(base * rate);
  return {
    fee,
    proceeds: base - fee,
    tax,
    rate,
    estimated: true,
  };
}

export function isGoogleEstimatedShare(row: {
  platform: string;
  basis: string;
  proceeds: number | null;
}) {
  return (
    row.platform === "google" &&
    row.basis === "estimate" &&
    row.proceeds === null
  );
}

/** 예상 매출 행을 현재 수수료율로 다시 계산해야 하는지. */
export function needsGoogleEstimatedShare(row: RevenueRow) {
  if (row.platform !== "google" || row.basis !== "estimate") return false;
  if (row.proceeds === null || row.fee === null) return true;
  const share = estimateGoogleDeveloperShare({
    gross: row.gross,
    refunds: row.refunds,
    tax: row.tax,
    country: row.country,
    currency: row.currency,
  });
  return row.fee !== share.fee || row.proceeds !== share.proceeds;
}

/** Google 예상 매출에 수수료·수익을 채우거나 최신 요율로 갱신한다. */
export function fillGoogleEstimatedShares(rows: RevenueRow[]): RevenueRow[] {
  let changed = false;
  const next = rows.map((row) => {
    if (!needsGoogleEstimatedShare(row)) return row;
    const share = estimateGoogleDeveloperShare({
      gross: row.gross,
      refunds: row.refunds,
      tax: row.tax,
      country: row.country,
      currency: row.currency,
    });
    changed = true;
    return {
      ...row,
      fee: share.fee,
      tax: share.tax,
      proceeds: share.proceeds,
    };
  });
  return changed ? next : rows;
}
