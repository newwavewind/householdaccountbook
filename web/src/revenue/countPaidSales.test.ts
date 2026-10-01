import { describe, expect, it } from "vitest";
import { countPaidSales } from "./model";
import type { RevenueRow } from "./types";

const row = (o: Partial<RevenueRow>): RevenueRow => ({
  id: "1",
  reportKey: "a",
  date: "2026-09-01",
  period: "2026-09",
  appId: "apple:x",
  appName: "앱",
  platform: "apple",
  country: "KR",
  currency: "KRW",
  proceedsCurrency: "KRW",
  gross: 0,
  refunds: 0,
  fee: null,
  tax: null,
  proceeds: null,
  units: 0,
  basis: "estimate",
  taxClass: "unreviewed",
  ...o,
});

describe("countPaidSales", () => {
  it("ignores free download units", () => {
    const c = countPaidSales([
      row({ id: "p", gross: 4900, units: 1 }),
      row({ id: "f", gross: 0, units: 800 }),
      row({ id: "r", gross: 0, refunds: 4900, units: -1 }),
    ]);
    expect(c.sold).toBe(1);
    expect(c.refunded).toBe(1);
    expect(c.net).toBe(0);
  });
});
