import { describe, expect, it } from "vitest";
import { emptyData, storeTake, summarize } from "./model";
import type { RevenueRow } from "./types";

const row = (o: Partial<RevenueRow> = {}): RevenueRow => ({
  id: "1",
  reportKey: "a",
  date: "2026-09-01",
  period: "2026-09",
  appId: "apple:1",
  appName: "앱",
  platform: "apple",
  country: "KR",
  currency: "KRW",
  proceedsCurrency: "KRW",
  gross: 11000,
  refunds: 0,
  fee: null,
  tax: null,
  proceeds: 8500,
  units: 1,
  basis: "estimate",
  taxClass: "unreviewed",
  ...o,
});

describe("storeTake", () => {
  it("includes Apple unallocated commission so gross-refund-take=proceeds", () => {
    const totals = summarize([row({})], emptyData());
    const take = storeTake(totals);
    expect(take.total).toBe(2500);
    expect(totals.gross - totals.refunds - take.total).toBe(totals.proceeds);
  });
});
