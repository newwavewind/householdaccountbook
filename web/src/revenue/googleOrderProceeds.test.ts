import { describe, expect, it } from "vitest";
import { parseReport, mergeReports, csvTemplate } from "./imports";
import { emptyData, summarize } from "./model";
import { getStoreIncomeStatus } from "./incomeStatus";
import { summarizeRevenueIncome } from "./revenueIncome";
import type { GoogleOrderProceeds, StoreDocument } from "./types";

const header = "Order Number,Order Charged Date,Financial Status,Package ID,Product Title,Currency of Sale,Charged Amount,Taxes Collected,Country of Buyer\n";
const charged = "GPA.private-order-1,2026-10-01,charged,com.app,테스트,KRW,100,10,KR";
const refund = "GPA.private-order-1,2026-10-01,partial refund,com.app,테스트,KRW,20,2,KR";
const timestamp = "2026-10-08T14:00:00.000Z";
const metadata = (patch: Partial<GoogleOrderProceeds> = {}): GoogleOrderProceeds => ({ rowIndex: 0, proceeds: 63, currency: "KRW", fetchedAt: timestamp, ...patch });
const doc = (text = charged, googleOrderProceeds?: GoogleOrderProceeds[]): StoreDocument => ({
  key: "google:sales/salesreport_202610.zip:salesreport_202610.csv", name: "Google sales", period: "2026-10", text: header + text,
  ...(googleOrderProceeds === undefined ? {} : { googleOrderProceeds }),
});

async function incomeStatus(document: StoreDocument) {
  const data = { ...emptyData(), rows: await parseReport(document) };
  const income = summarizeRevenueIncome(data, "2026-10").perPlatform.google;
  return { data, income, status: getStoreIncomeStatus({ data, month: "2026-10", platform: "google", income, now: new Date(timestamp) }) };
}

describe("Google Orders API proceeds on original sales rows", () => {
  it("keeps the API net amount, payout currency and explicit provenance without storing an order ID", async () => {
    const [row] = await parseReport(doc(charged.replace(",KRW,", ",USD,"), [metadata({ proceeds: 1.25, currency: "USD" })]));
    expect(row).toMatchObject({ gross: 100, currency: "USD", proceeds: 1.25, proceedsCurrency: "USD", proceedsSource: "google-orders", proceedsFetchedAt: timestamp, source: "google-sales", basis: "estimate", fee: null });
    expect(JSON.stringify(row)).not.toContain("GPA.private-order-1");
  });

  it("matches zero-based original data row indices, including rows skipped by the sales parser", async () => {
    const cancelled = charged.replace("charged", "cancelled");
    const rows = await parseReport(doc([cancelled, charged].join("\n"), [metadata({ rowIndex: 1 })]));
    expect(rows).toHaveLength(1);
    expect(rows[0].proceeds).toBe(63);
  });

  it("keeps missing metadata unknown rather than computing a commission", async () => {
    const [row] = await parseReport(doc());
    expect(row.proceeds).toBeNull();
    expect(row.proceedsSource).toBeUndefined();
    expect(row.fee).toBeNull();
    expect(summarize([row], emptyData()).unknownProceeds).toBe(1);
  });

  it("injects only the matched rows and leaves other orders unknown", async () => {
    const rows = await parseReport(doc([charged, charged.replace("order-1", "order-2")].join("\n"), [metadata()]));
    expect(rows[0].proceeds).toBe(63);
    expect(rows[1].proceeds).toBeNull();
    expect(summarize(rows, emptyData())).toMatchObject({ proceeds: 63, unknownProceeds: 1, completeProceeds: false });
  });

  it("does not subtract partial refunds again from the server's current net snapshot", async () => {
    const rows = await parseReport(doc([charged, refund, refund].join("\n"), [metadata({ proceeds: 42 }), metadata({ rowIndex: 1, proceeds: 0 }), metadata({ rowIndex: 2, proceeds: 0 })]));
    expect(rows.map((row) => row.proceeds)).toEqual([42, 0, 0]);
    expect(summarize(rows, emptyData())).toMatchObject({ gross: 100, refunds: 40, proceeds: 42, completeProceeds: true });
  });

  it("preserves signed negative API values on refund rows", async () => {
    const [row] = await parseReport(doc(refund, [metadata({ proceeds: -12 })]));
    expect(row.refunds).toBe(20);
    expect(row.proceeds).toBe(-12);
    expect(summarize([row], emptyData()).proceeds).toBe(-12);
  });

  it("keeps identity and existing review annotations when only fetchedAt changes", async () => {
    const firstDoc = doc(charged, [metadata()]);
    const nextDoc = doc(charged, [metadata({ fetchedAt: "2026-10-08T15:00:00.000Z" })]);
    const firstRows = await parseReport(firstDoc);
    const nextRows = await parseReport(nextDoc);
    expect(nextRows[0].id).toBe(firstRows[0].id);
    let data = mergeReports(emptyData(), [{ document: firstDoc, rows: firstRows }]);
    data.rows[0].taxClass = "excluded"; data.rows[0].evidence = "reviewed";
    data = mergeReports(data, [{ document: nextDoc, rows: nextRows }]);
    expect(data.rows).toHaveLength(1);
    expect(data.rows[0]).toMatchObject({ taxClass: "excluded", evidence: "reviewed", proceedsFetchedAt: "2026-10-08T15:00:00.000Z" });
  });

  it("keeps original sale identity through enrichment and API net changes", async () => {
    const original = await parseReport(doc());
    const first = await parseReport(doc(charged, [metadata()]));
    const revised = await parseReport(doc(charged, [metadata({ proceeds: 42 })]));
    expect(first[0].id).toBe(original[0].id);
    expect(first[0].id).toBe(revised[0].id);
  });

  it("counts a charge repeated across documents once when its API net is allocated to one copy", async () => {
    const firstDoc = doc(charged, [metadata({ proceeds: 67 })]);
    const duplicateDoc = { ...doc(charged, [metadata({ proceeds: 0 })]), key: "google:sales/salesreport_202610_2.zip:salesreport_202610_2.csv" };
    const firstRows = await parseReport(firstDoc);
    const duplicateRows = await parseReport(duplicateDoc);
    expect(firstRows[0].id).toBe(duplicateRows[0].id);
    expect(summarize([...firstRows, ...duplicateRows], emptyData())).toMatchObject({ gross: 100, proceeds: 67 });
    for (const reports of [
      [{ document: firstDoc, rows: firstRows }, { document: duplicateDoc, rows: duplicateRows }],
      [{ document: duplicateDoc, rows: duplicateRows }, { document: firstDoc, rows: firstRows }],
    ]) {
      const merged = mergeReports(emptyData(), reports);
      expect(merged.rows).toHaveLength(1);
      expect(summarize(merged.rows, merged)).toMatchObject({ gross: 100, proceeds: 67 });
    }
  });

  it("preserves a newer actual zero when duplicate documents contain an older positive net", async () => {
    const oldDoc = doc(charged, [metadata({ proceeds: 67 })]);
    const newDoc = { ...doc(charged, [metadata({ proceeds: 0, fetchedAt: "2026-10-08T15:00:00.000Z" })]), key: "google:sales/salesreport_202610_2.zip:salesreport_202610_2.csv" };
    const oldRows = await parseReport(oldDoc), newRows = await parseReport(newDoc);
    for (const reports of [
      [{ document: oldDoc, rows: oldRows }, { document: newDoc, rows: newRows }],
      [{ document: newDoc, rows: newRows }, { document: oldDoc, rows: oldRows }],
    ]) {
      const merged = mergeReports(emptyData(), reports);
      expect(summarize(merged.rows, merged)).toMatchObject({ gross: 100, proceeds: 0 });
    }
  });

  it.each([
    { rowIndex: -1 }, { rowIndex: 0.5 }, { rowIndex: 1 },
    { proceeds: Number.NaN }, { proceeds: Number.POSITIVE_INFINITY }, { proceeds: 1e14 },
    { currency: "krw" }, { currency: "KR" },
    { fetchedAt: "2026-02-30T14:00:00.000Z" }, { fetchedAt: "not-a-date" },
    { fetchedAt: "2026-10-08" }, { fetchedAt: "2026-10-08T25:00:00Z" },
  ])("rejects malformed order metadata without silently losing or converting amounts: %j", async (patch) => {
    await expect(parseReport(doc(charged, [metadata(patch)]))).rejects.toThrow("Google 주문 수익");
  });

  it("rejects API proceeds whose buyer currency differs from the original sales row", async () => {
    await expect(parseReport(doc(charged, [metadata({ currency: "USD" })]))).rejects.toThrow("원본 판매 통화");
  });

  it("rejects duplicate metadata for the same row", async () => {
    await expect(parseReport(doc(charged, [metadata(), metadata()]))).rejects.toThrow("두 번");
  });

  it("rejects metadata aimed at a skipped cancelled row", async () => {
    await expect(parseReport(doc(charged.replace("charged", "cancelled"), [metadata()]))).rejects.toThrow("유효한 판매");
  });

  it("rejects non-array metadata and enrichment on a non-Google-sales report", async () => {
    await expect(parseReport({ ...doc(), googleOrderProceeds: {} as GoogleOrderProceeds[] })).rejects.toThrow("Google 주문 수익");
    await expect(parseReport({ ...doc(), text: csvTemplate, googleOrderProceeds: [metadata()] })).rejects.toThrow("Google 판매 보고서에만");
  });
});

describe("Google order-proceeds availability states", () => {
  it("shows an API-backed nonzero net amount as Google order based", async () => {
    const result = await incomeStatus(doc(charged, [metadata()]));
    expect(result.income.value).toBe(63);
    expect(result.status).toMatchObject({ state: "ready", label: "Google 주문 기준", actionRequired: false });
    expect(result.status.detail).toBe("Google이 제공한 주문별 수익입니다. 월 정산 시 조정될 수 있습니다.");
  });

  it("treats an API-reported zero as ready rather than settlement pending", async () => {
    const result = await incomeStatus(doc(charged, [metadata({ proceeds: 0 })]));
    expect(result.income.value).toBe(0);
    expect(result.status).toMatchObject({ state: "ready", label: "Google 주문 기준" });
  });

  it("keeps an un-enriched current-month Google sales report pending", async () => {
    const result = await incomeStatus(doc());
    expect(result.income.value).toBeNull();
    expect(result.status.state).toBe("settlement-pending");
  });

  it("identifies partially collected orders instead of hiding them as normal settlement waiting", async () => {
    const result = await incomeStatus(doc([charged, charged.replace("order-1", "order-2")].join("\n"), [metadata()]));
    expect(result.income).toMatchObject({ value: null, partialSum: 63, unknownProceeds: 1 });
    expect(result.status).toMatchObject({ state: "report-incomplete", label: "주문 수익 일부 미수집", actionRequired: true });
    expect(result.status.detail).toBe("조회된 주문만 소계에 반영했습니다. 다시 가져오면 누락 주문을 재조회합니다.");
  });

  it("requires FX for actual order net proceeds in another currency", async () => {
    const result = await incomeStatus(doc(charged.replace(",KRW,", ",USD,"), [metadata({ proceeds: 1.25, currency: "USD" })]));
    expect(result.income.value).toBeNull();
    expect(result.status.state).toBe("fx-missing");
  });
});


describe("Google Orders snapshots across UTC month rollover", () => {
  const previousSnapshot = () => ({ ...doc(charged, [metadata({ proceeds: 67, fetchedAt: "2026-10-31T23:00:00Z" })]), source: "api" as const, fetchedAt: "2026-10-31T23:00:00Z" });
  const historicalRefresh = (text = charged) => ({ ...doc(text), source: "api" as const, fetchedAt: "2026-11-01T01:00:00Z" });
  const november = { now: new Date("2026-11-01T00:00:00Z") };
  async function savedSnapshot() {
    const document = previousSnapshot();
    return mergeReports(emptyData(), [{ document, rows: await parseReport(document) }]);
  }
  it("preserves the last verified snapshot when historical sales are fetched without Orders enrichment", async () => {
    const before = await savedSnapshot();
    const document = historicalRefresh();
    const next = mergeReports(before, [{ document, rows: await parseReport(document) }], november);
    expect(next.rows).toHaveLength(1);
    expect(next.rows[0]).toMatchObject({ proceeds: 67, proceedsSource: "google-orders", proceedsFetchedAt: "2026-10-31T23:00:00Z" });
    expect(summarizeRevenueIncome(next, "2026-10").total).toBe(67);
    expect(next.imports[0].fetchedAt).toBe(document.fetchedAt);
  });
  it("keeps a failed current-UTC-month lookup unknown even after Korea reaches the next month", async () => {
    const document = historicalRefresh();
    const next = mergeReports(await savedSnapshot(), [{ document, rows: await parseReport(document) }], { now: new Date("2026-10-31T23:59:59Z") });
    expect(next.rows[0].proceeds).toBeNull();
  });
  it("does not reuse an old snapshot for revised source amounts", async () => {
    const document = historicalRefresh(charged.replace(",100,", ",120,"));
    const next = mergeReports(await savedSnapshot(), [{ document, rows: await parseReport(document) }], november);
    expect(next.rows[0].proceeds).toBeNull();
    expect(summarizeRevenueIncome(next, "2026-10").total).toBeNull();
  });
  it("leaves newly reported refunds incomplete rather than subtracting them from an old snapshot twice", async () => {
    const document = historicalRefresh([charged, refund].join("\n"));
    const next = mergeReports(await savedSnapshot(), [{ document, rows: await parseReport(document) }], november);
    expect(summarize(next.rows, next)).toMatchObject({ gross: 100, refunds: 20, proceeds: 67, unknownProceeds: 1 });
    expect(summarizeRevenueIncome(next, "2026-10")).toMatchObject({ total: null, partialSum: 67 });
  });
  it("accepts an explicitly updated zero instead of restoring the prior nonzero snapshot", async () => {
    const document = { ...historicalRefresh(), googleOrderProceeds: [metadata({ proceeds: 0, fetchedAt: "2026-11-01T01:00:00Z" })] };
    const next = mergeReports(await savedSnapshot(), [{ document, rows: await parseReport(document) }], november);
    expect(next.rows[0].proceeds).toBe(0);
  });
});


it("does not hide a newer current-month Orders failure behind an older duplicate archive", async () => {
  const original = { ...doc(charged, [metadata({ proceeds: 67 })]), source: "api" as const, fetchedAt: timestamp };
  const latest = { ...doc(), key: "google:sales/salesreport_202610_2.zip:salesreport_202610.csv", source: "api" as const, fetchedAt: "2026-10-08T15:00:00Z" };
  const now = { now: new Date("2026-10-08T16:00:00Z") };
  let data = mergeReports(emptyData(), [{ document: original, rows: await parseReport(original) }], now);
  data = mergeReports(data, [{ document: latest, rows: await parseReport(latest) }], now);
  expect(data.rows).toHaveLength(1);
  expect(data.rows[0].proceeds).toBeNull();
  expect(summarizeRevenueIncome(data, "2026-10").total).toBeNull();
});


it("counts an identical charged order repeated within one CSV only once", async () => {
  const document = doc([charged, charged, refund, refund].join("\n"), [
    metadata({ proceeds: 42 }), metadata({ rowIndex: 1, proceeds: 0 }),
    metadata({ rowIndex: 2, proceeds: 0 }), metadata({ rowIndex: 3, proceeds: 0 }),
  ]);
  const rows = await parseReport(document);
  expect(rows[0].id).toBe(rows[1].id);
  expect(rows[2].id).not.toBe(rows[3].id);
  const data = mergeReports(emptyData(), [{ document, rows }]);
  expect(summarize(data.rows, data)).toMatchObject({ gross: 100, refunds: 40, proceeds: 42, units: 1 });
});
