import { describe, expect, it } from "vitest";
import { buildPayoutCalendar } from "./payoutCalendar";
import { emptyData } from "./model";
import type { RevenueRow, Payout } from "./types";

const row = (id: string, overrides: Partial<RevenueRow> = {}): RevenueRow => ({
  id, reportKey: id, date: "2026-09-05", period: "2026-09",
  appId: "google:sample", appName: "Sample", platform: "google", country: "KR",
  currency: "KRW", proceedsCurrency: "KRW", gross: 10000, refunds: 0,
  fee: 3000, tax: 0, proceeds: 7000, units: 1,
  basis: "settled", taxClass: "unreviewed", ...overrides,
});
const payout = (overrides: Partial<Payout> = {}): Payout => ({
  id: "record", platform: "google", month: "2026-09", dueDate: "2026-10-15",
  expected: 7000, received: 0, receivedDate: "", memo: "", ...overrides,
});
const build = (rows: RevenueRow[], payouts: Payout[] = []) =>
  buildPayoutCalendar({ ...emptyData(), rows, payouts }, "2026-10-01", "2026-10-31");

describe("payout calendar evidence", () => {
  it("does not turn sales or a legacy guessed net amount into an expected payment", () => {
    const [event] = build([row("sales", { basis: "estimate", source: "google-sales", proceeds: 7000 })]);
    expect(event.amount).toBeNull();
    expect(event.title).toContain("미집계");
  });
  it("uses only final report proceeds when estimates and final reports coexist", () => {
    const [event] = build([row("sales", { basis: "estimate" }), row("final")]);
    expect(event.amount).toBe(7000);
    expect(event.kind).toBe("estimated");
    expect(event.title).toContain("보고서 기준");
    expect(event.note).toContain("실제 입금일과 금액");
  });
  it("keeps incomplete income uncollected instead of falling back to gross", () => {
    expect(build([row("unknown", { proceeds: null })])[0].amount).toBeNull();
    expect(build([row("foreign", { proceedsCurrency: "USD" })])[0].amount).toBeNull();
  });
  it("does not require the sales exchange rate to show known final KRW income", () => {
    expect(build([row("foreign-sales", { currency: "USD" })])[0].amount).toBe(7000);
  });
  it("retains confirmed zero report proceeds", () => {
    expect(build([row("zero", { proceeds: 0 })])[0].amount).toBe(0);
  });
  it("uses the actual receipt date and accepts a recorded zero receipt", () => {
    const [event] = build([], [payout({ dueDate: "2026-09-20", receivedDate: "2026-10-05", received: 0 })]);
    expect(event).toMatchObject({ date: "2026-10-05", amount: 0, kind: "received" });
  });
  it("does not invent a payment inside the range when the recorded receipt is outside it", () => {
    expect(build([row("final")], [payout({ receivedDate: "2026-11-05", received: 7000 })])).toEqual([]);
  });
});
