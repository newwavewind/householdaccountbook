import { hasVerifiedGoogleOrderProceeds, reportSource } from "./reportSelection";
import type { StoreRevenueIncome } from "./revenueIncome";
import type { Platform, RevenueData } from "./types";

export type StoreIncomeState =
  | "ready"
  | "settlement-pending"
  | "fx-missing"
  | "report-missing"
  | "report-incomplete";

export interface StoreIncomeStatus {
  state: StoreIncomeState;
  label: string;
  detail: string;
  actionRequired: boolean;
  /** Expected publication date, not a guarantee or the bank payout date. */
  expectedBy?: string;
}

function dateInSeoul(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function googlePublicationDate(month: string): string | undefined {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return undefined;
  const [year, monthNumber] = month.split("-").map(Number);
  return `${monthNumber === 12 ? year + 1 : year}-${String(monthNumber === 12 ? 1 : monthNumber + 1).padStart(2, "0")}-05`;
}

/**
 * Explain availability without altering income. Google earnings are normally
 * published by the fifth of the following month; sales reports do not provide
 * developer proceeds. This publishing state never claims that a connector is
 * healthy. Unscoped sync error strings are deliberately not interpreted here.
 */
export function getStoreIncomeStatus({ data, month, platform, income, now = new Date() }: {
  data: RevenueData;
  month: string;
  platform: Platform;
  income: StoreRevenueIncome;
  now?: Date;
}): StoreIncomeStatus {
  const keys = new Set(income.rows.map((row) => row.reportKey));
  const cached = data.imports.some((entry) => keys.has(entry.key) && entry.source === "cache");
  const cacheNote = cached ? " 현재 자료는 보관본 기준이며 최신 수집 여부는 동기화 상태에서 확인할 수 있습니다." : "";
  const status = (value: StoreIncomeStatus): StoreIncomeStatus => ({ ...value, detail: value.detail + cacheNote });

  // Missing payout FX is actionable even during the normal publication window.
  if (income.missingFx > 0) return status({
    state: "fx-missing", label: "환율 확인 필요", actionRequired: true,
    detail: `수익 ${income.missingFx}건의 원화 환산에 필요한 환율이 없습니다. 환율을 가져오거나 입력해 주세요.`,
  });
  if (income.value !== null) {
    const googleOrders = income.rows.length > 0 && income.rows.every(hasVerifiedGoogleOrderProceeds);
    return status({
      state: "ready", label: income.basis === "settled" ? "확정" : googleOrders ? "Google 주문 기준" : "스토어 제공 예상", actionRequired: false,
      detail: income.basis === "settled" ? "확정 보고서에 기재된 수익입니다." : googleOrders ?
        "Google이 제공한 주문별 수익입니다. 월 정산 시 조정될 수 있습니다." :
        "판매 보고서에 기재된 예상 수익이며 확정 시 달라질 수 있습니다.",
    });
  }

  if (income.unknownProceeds > 0 && income.rows.some(hasVerifiedGoogleOrderProceeds)) return status({
    state: "report-incomplete", label: "주문 수익 일부 미수집", actionRequired: true,
    detail: "조회된 주문만 소계에 반영했습니다. 다시 가져오면 누락 주문을 재조회합니다.",
  });

  const googleSales = platform === "google" && income.rows.some((row) =>
    row.platform === "google" && row.basis === "estimate" && reportSource(row) === "google-sales",
  );
  const hasFinalReport = income.basis === "settled" || data.rows.some((row) =>
    row.platform === platform && row.period === month && row.basis === "settled",
  );
  const expectedBy = googleSales && !hasFinalReport ? googlePublicationDate(month) : undefined;
  if (expectedBy) {
    const today = dateInSeoul(now);
    const publicationMonth = Number(expectedBy.slice(5, 7));
    if (today >= `${month}-01` && today <= expectedBy) return status({
      state: "settlement-pending", label: "정산 예정", actionRequired: false, expectedBy,
      detail: `판매액은 집계되었습니다. 수익 보고서는 보통 ${publicationMonth}월 5일까지 공개됩니다. 실제 입금일은 별도입니다.`,
    });
    return status({
      state: "report-missing", label: "확정 보고서 미수집", actionRequired: true, expectedBy,
      detail: `${Number(month.slice(5, 7))}월 확정 수익 보고서가 아직 수집되지 않았습니다. 다시 동기화하거나 보고서를 가져와 주세요.`,
    });
  }

  if (hasFinalReport || income.rows.length > 0) return status({
    state: "report-incomplete", label: "수익 자료 확인 필요", actionRequired: true,
    detail: hasFinalReport ? "확정 보고서가 있지만 선택한 범위의 수익 값을 확인할 수 없습니다. 보고서 원본을 확인해 주세요." :
      "현재 보고서에는 확인할 수 있는 개발자 수익 값이 없습니다. 수익이 기재된 보고서를 가져와 주세요.",
  });
  return status({
    state: "report-missing", label: "보고서 미수집", actionRequired: true,
    detail: "선택한 달의 수익 보고서가 없습니다. 동기화하거나 보고서를 가져와 주세요.",
  });
}
