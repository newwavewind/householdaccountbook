import { afterEach, describe, expect, it, vi } from "vitest";
import {
  amounts,
  appProfit,
  countPaidSales,
  neededCurrencies,
  storeTake,
  yearOverYear,
  csvString,
  emptyData,
  shiftMonth,
  summarize,
  taxWorksheet,
  validDate,
} from "./model";
import {
  csvTemplate,
  mergeReports,
  parseDelimited,
  parseReport,
  reportDate,
} from "./imports";
import { estimateGoogleDeveloperShare, fillGoogleEstimatedShares } from "./googleFee";
import { selectRevenueRows } from "./reportSelection";
import { syncLogStatus, formatSyncToast } from "./syncHelpers";
import { fetchMonthRatesKrw } from "./fxRates";
import { detectAnomalies } from "./anomalies";
import { buildMonthCloseChecklist } from "./monthClose";
import { validateBackup } from "./storage";
import type { RevenueRow, StoreDocument } from "./types";
const doc = (text: string, key = "test"): StoreDocument => ({
  key,
  name: "report.csv",
  text,
  period: "",
});
const row = (override: Partial<RevenueRow> = {}): RevenueRow => ({
  id: "one",
  reportKey: "a",
  date: "2026-07-01",
  period: "2026-07",
  appId: "apple:app",
  appName: "앱",
  platform: "apple",
  country: "KR",
  currency: "KRW",
  proceedsCurrency: "KRW",
  gross: 11000,
  refunds: 0,
  fee: 1500,
  tax: 1000,
  proceeds: 8500,
  units: 1,
  basis: "settled",
  taxClass: "unreviewed",
  ...override,
});
describe("revenue accounting", () => {
  it("reconciles sale, refund, fee refund, tax, and adjustment to proceeds", () => {
    const rows = [
      row(),
      row({
        id: "refund",
        gross: 0,
        refunds: 1100,
        fee: -150,
        tax: -100,
        proceeds: -850,
        units: -1,
      }),
    ];
    const sum = summarize(rows, emptyData());
    expect(sum.proceeds).toBe(7650);
    expect(sum.gross - sum.refunds - sum.fee - sum.tax - sum.unallocated).toBe(
      sum.proceeds,
    );
  });
  it("never uses a rate from another month or treats missing FX as zero sales", () => {
    const d = emptyData();
    d.rates["2026-06:USD"] = { value: 1400, note: "June" };
    const r = row({ currency: "USD", proceedsCurrency: "USD" });
    expect(amounts(r, d)).toBeNull();
    expect(summarize([r], d).missing).toBe(1);
    d.rates["2026-07:USD"] = { value: 1350, note: "July" };
    expect(amounts(r, d)?.proceeds).toBe(8500 * 1350);
  });
  it("converts customer and proceeds currencies independently", () => {
    const d = emptyData();
    d.rates["2026-07:USD"] = { value: 1000, note: "fixture" };
    expect(
      amounts(
        row({
          gross: 11,
          currency: "USD",
          fee: null,
          tax: null,
          proceeds: 8000,
        }),
        d,
      ),
    ).toMatchObject({ gross: 11000, proceeds: 8000, unallocated: 3000 });
  });
  it("does not manufacture net revenue for Google sales estimates", () => {
    expect(
      summarize([row({ proceeds: null, fee: null, tax: null })], emptyData()),
    ).toMatchObject({
      unknownProceeds: 1,
      unallocated: 0,
      proceeds: 0,
      gross: 11000,
    });
  });
  it("excludes estimated and unreviewed proceeds from VAT and isolates each half", () => {
    const d = emptyData();
    d.business.prepaid = { "2026-1": 100, "2026-2": 200 };
    d.rows = [
      row({
        taxClass: "taxable",
        supplyAmount: 10000,
        outputVat: 1000,
        taxDate: "2026-07-01",
        evidence: "verified",
      }),
      row({ id: "estimate", basis: "estimate" }),
      row({ id: "unreviewed" }),
    ];
    d.expenses = [
      {
        id: "exp",
        date: "2026-07-03",
        name: "host",
        category: "server",
        amount: 1100,
        inputVat: 100,
        deductible: true,
        evidence: "invoice",
      },
      {
        id: "missing",
        date: "2026-07-04",
        name: "ad",
        category: "ad",
        amount: 1100,
        inputVat: 100,
        deductible: true,
        evidence: "",
      },
    ];
    expect(taxWorksheet(d, "2026", "2")).toMatchObject({
      taxable: 10000,
      output: 1000,
      input: 100,
      prepaid: 200,
      payable: 700,
      missingEvidence: 1,
    });
    expect(taxWorksheet(d, "2026", "2").pending).toHaveLength(1);
    expect(taxWorksheet(d, "2026", "1")).toMatchObject({
      output: 0,
      prepaid: 100,
    });
  });
  it("respects reviewed attribution date instead of Apple fiscal period", () => {
    const d = emptyData();
    d.rows = [
      row({
        date: "2026-06-28",
        period: "2026-07",
        taxDate: "2026-06-30",
        taxClass: "zero",
        supplyAmount: 5000,
        outputVat: 0,
        evidence: "contract",
      }),
    ];
    expect(taxWorksheet(d, "2026", "1").zero).toBe(5000);
    expect(taxWorksheet(d, "2026", "2").rows).toHaveLength(0);
  });
  it("retains negative refund VAT rather than clamping it", () => {
    const d = emptyData();
    d.rows = [
      row({
        taxClass: "taxable",
        supplyAmount: -1000,
        outputVat: -100,
        taxDate: "2026-07-01",
        evidence: "refund",
      }),
    ];
    expect(taxWorksheet(d, "2026", "2").payable).toBe(-100);
  });
  it("rejects invalid dates and handles leap years and month rollover", () => {
    expect(validDate("2026-02-30")).toBe(false);
    expect(validDate("2024-02-29")).toBe(true);
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(reportDate("Sep 09, 2026")).toBe("2026-09-09");
  });
  it("escapes multiline CSV and spreadsheet formula injection", () => {
    expect(csvString([['=HYPERLINK("bad")', "a\nb", -5]])).toContain(
      '"\'=HYPERLINK(""bad"")"',
    );
    expect(parseDelimited('name,value\n"a,b","line 1\nline 2"')).toEqual([
      ["name", "value"],
      ["a,b", "line 1\nline 2"],
    ]);
  });
});
describe("official report import", () => {
  it("reads a standard report and validates amounts", async () => {
    expect(await parseReport(doc(csvTemplate))).toHaveLength(1);
    await expect(
      parseReport(doc(csvTemplate.replace("11000", "not-a-number"))),
    ).rejects.toThrow("2행");
  });
  it("handles negative Apple units without turning refunds into income", async () => {
    const text =
      "Title\tApple Identifier\tUnits\tCustomer Price\tDeveloper Proceeds\tBegin Date\tEnd Date\tCountry Code\tCustomer Currency\tCurrency of Proceeds\n앱\t123\t-2\t1100\t850\t09/01/2026\t09/01/2026\tKR\tKRW\tKRW";
    const [r] = await parseReport(doc(text));
    expect(r).toMatchObject({
      gross: 0,
      refunds: 2200,
      proceeds: -1700,
      fee: null,
      tax: null,
      basis: "estimate",
    });
  });
  it("does not infer commission alone from Apple price minus partner share", async () => {
    const text =
      "Title\tApple Identifier\tQuantity\tCustomer Price\tPartner Share\tExtended Partner Share\tStart Date\tEnd Date\tCountry of Sale\tCustomer Currency\tPartner Share Currency\n앱\t123\t2\t1100\t850\t1700\t08/30/2026\t09/26/2026\tKR\tKRW\tKRW";
    const [r] = await parseReport({ ...doc(text), period: "2026-09" });
    expect(r).toMatchObject({
      gross: 2200,
      proceeds: 1700,
      fee: null,
      tax: null,
      basis: "settled",
      date: "2026-08-30",
      period: "2026-09",
    });
  });
  it("keeps each Google fee and tax reversal signed", async () => {
    const header =
      "Description,Transaction Date,Transaction Type,Package ID,Product Title,Merchant Currency,Amount (Merchant Currency),Buyer Country\n";
    const body = [
      'GPA.1,"Sep 01, 2026",Charge,com.app,앱,KRW,11000,KR',
      'GPA.1,"Sep 01, 2026",Google fee,com.app,앱,KRW,-1500,KR',
      'GPA.1,"Sep 01, 2026",Tax,com.app,앱,KRW,-1000,KR',
      'GPA.1,"Sep 02, 2026",Charge refund,com.app,앱,KRW,-11000,KR',
      'GPA.1,"Sep 02, 2026",Google fee refund,com.app,앱,KRW,1500,KR',
      'GPA.1,"Sep 02, 2026",Tax refund,com.app,앱,KRW,1000,KR',
    ].join("\n");
    const rows = await parseReport(doc(header + body));
    expect(summarize(rows, emptyData())).toMatchObject({
      gross: 11000,
      refunds: 11000,
      fee: 0,
      tax: 0,
      proceeds: 0,
      unallocated: 0,
    });
  });
  it("does not deduplicate distinct Google order IDs with identical prices", async () => {
    const header =
      "Description,Transaction Date,Transaction Type,Package ID,Product Title,Merchant Currency,Amount (Merchant Currency)\n";
    const a = await parseReport(
      doc(header + 'GPA.1,"Sep 01, 2026",Charge,com.app,앱,KRW,1100', "a"),
    );
    const b = await parseReport(
      doc(header + 'GPA.2,"Sep 01, 2026",Charge,com.app,앱,KRW,1100', "b"),
    );
    expect(a[0].id).not.toBe(b[0].id);
  });
  it("reimporting identical rows under another filename does not duplicate revenue", async () => {
    const a = doc(csvTemplate, "a"),
      b = doc(csvTemplate, "renamed");
    const first = mergeReports(emptyData(), [
      { document: a, rows: await parseReport(a) },
    ]);
    const next = mergeReports(first, [
      { document: b, rows: await parseReport(b) },
    ]);
    expect(next.rows).toHaveLength(1);
  });
  it("replaces a revised report and invalidates tax approval if its amount changes", async () => {
    const a = doc(csvTemplate),
      b = doc(csvTemplate.replace("8500", "8000"));
    const first = mergeReports(emptyData(), [
      { document: a, rows: await parseReport(a) },
    ]);
    first.rows[0].taxClass = "taxable";
    const next = mergeReports(first, [
      { document: b, rows: await parseReport(b) },
    ]);
    expect(next.rows).toHaveLength(1);
    expect(next.rows[0].taxClass).toBe("unreviewed");
    expect(next.rows[0].proceeds).toBe(8000);
  });
  it("rejects corrupt financial backups without trusting schema alone", () => {
    const d = emptyData();
    d.rows = [row()];
    expect(validateBackup(d)).toEqual(d);
    expect(() =>
      validateBackup({ ...d, rows: [row({ gross: NaN })] }),
    ).toThrow();
    expect(() => validateBackup({ ...d, rows: [row(), row()] })).toThrow(
      "중복",
    );
  });
  it("preserves Google sales without inventing developer proceeds or a fee", async () => {
    const header =
      "Order Number,Order Charged Date,Financial Status,Package ID,Product Title,Currency of Sale,Charged Amount,Taxes Collected,Country of Buyer\n";
    const body =
      'GPA.1,2026-09-01,Charged,com.app,앱,KRW,11000,1000,KR';
    const [r] = await parseReport(doc(header + body, "sales-kr"));
    expect(r).toMatchObject({
      platform: "google",
      basis: "estimate",
      gross: 11000,
      tax: 1000,
      fee: null,
      proceeds: null,
    });
    expect(summarize([r], emptyData())).toMatchObject({ proceeds: 0, unknownProceeds: 1, completeProceeds: false });
  });
  it("keeps legacy Google rows unknown instead of recalculating assumed fees", () => {
    const r = row({
      platform: "google",
      basis: "estimate",
      gross: 11000,
      refunds: 0,
      fee: null,
      tax: 1000,
      proceeds: null,
      currency: "KRW",
      proceedsCurrency: "KRW",
      country: "KR",
    });
    expect(amounts(r, emptyData())).toMatchObject({
      fee: 0,
      tax: 1000,
      proceeds: 0,
      proceedsAvailable: false,
    });
    expect(summarize([r], emptyData()).unknownProceeds).toBe(1);
  });
  it("requires known tax and an explicit fee rate for a what-if estimate", () => {
    const share = estimateGoogleDeveloperShare({
      gross: 11000,
      refunds: 0,
      tax: null,
      country: "KR",
      currency: "KRW",
      rate: 0.3,
    });
    expect(share.tax).toBeNull();
    expect(share.fee).toBeNull();
    expect(share.proceeds).toBeNull();
  });

});


const googleSalesHeader = "Order Number,Order Charged Date,Financial Status,Package ID,Product Title,Currency of Sale,Charged Amount,Taxes Collected,Country of Buyer\n";
const googleEarningsHeader = "Description,Transaction Date,Transaction Type,Package ID,Product Title,Merchant Currency,Amount (Merchant Currency),Refund Type\n";
const appleSalesHeader = "Title\tApple Identifier\tUnits\tCustomer Price\tDeveloper Proceeds\tBegin Date\tEnd Date\tCountry Code\tCustomer Currency\tCurrency of Proceeds\n";

describe("accounting regression: report coverage, unknowns and revisions", () => {
  it("counts monthly Apple sales once while retaining the daily source records", async () => {
    const dailyDoc = { ...doc(appleSalesHeader + "앱\t123\t1\t1100\t850\t09/02/2026\t09/02/2026\tKR\tKRW\tKRW", "apple-sales:2026-09-02"), period: "2026-09" };
    const monthDoc = { ...doc(appleSalesHeader + "앱\t123\t2\t1100\t850\t09/01/2026\t09/30/2026\tKR\tKRW\tKRW", "apple-sales-month:2026-09"), period: "2026-09" };
    const d = mergeReports(emptyData(), [
      { document: dailyDoc, rows: await parseReport(dailyDoc) },
      { document: monthDoc, rows: await parseReport(monthDoc) },
    ]);
    expect(d.rows).toHaveLength(2);
    expect(selectRevenueRows(d.rows, "estimate").excludedOverlapRows).toBe(1);
    expect(summarize(d.rows, d)).toMatchObject({ gross: 2200, proceeds: 1700, units: 2, excludedOverlapRows: 1 });
    expect(countPaidSales(d.rows).sold).toBe(2);
  });
  it("never replaces Apple calendar sales with a same-label fiscal report", () => {
    const sales = row({ id: "calendar", basis: "estimate", source: "apple-sales", periodKind: "calendar" });
    const final = row({ id: "fiscal", source: "apple-finance", periodKind: "fiscal" });
    expect(selectRevenueRows([sales, final], "estimate").rows).toEqual([sales]);
    expect(selectRevenueRows([sales, final], "settled").rows).toEqual([final]);
  });
  it("does not lose known KRW proceeds when the buyer-currency FX is missing", () => {
    const r = row({ currency: "USD", proceedsCurrency: "KRW", gross: 11 });
    expect(amounts(r, emptyData())).toMatchObject({ proceeds: 8500, gross: 0, missingGrossFx: true, proceedsAvailable: true });
    expect(summarize([r], emptyData())).toMatchObject({ proceeds: 8500, missing: 1, missingGrossFx: 1, missingProceedsFx: 0, completeProceeds: true, units: 1 });
  });
  it("does not lose known sales when the payout-currency FX is missing", () => {
    const r = row({ proceedsCurrency: "USD", proceeds: 8.5 });
    expect(summarize([r], emptyData())).toMatchObject({ gross: 11000, proceeds: 0, missingProceedsFx: 1, unknownProceeds: 0, completeProceeds: false });
  });
  it("invalidates known legacy auto-estimates in calculations without rewriting storage", () => {
    const r = row({ platform: "google", basis: "estimate", reportKey: "google:sales/salesreport_202607.zip:salesreport_202607.csv", fee: 3000, proceeds: 7000 });
    expect(summarize([r], emptyData())).toMatchObject({ proceeds: 0, fee: 0, tax: 0, unknownProceeds: 1 });
    expect(fillGoogleEstimatedShares([r])[0]).toBe(r);
    expect(r.proceeds).toBe(7000);
  });
  it("preserves explicit manual Google estimates", () => {
    const r = row({ platform: "google", basis: "estimate", source: "standard", reportKey: "file:manual.csv", proceeds: 8200 });
    expect(amounts(r, emptyData())?.proceeds).toBe(8200);
    expect(fillGoogleEstimatedShares([r])[0]).toBe(r);
  });
  it("never reports gross sales as profit or compares unknown net proceeds", () => {
    const d = emptyData();
    d.rows = [row({ proceeds: null }), row({ id: "prev", period: "2025-07" })];
    expect(appProfit([d.rows[0]], d, 100)).toMatchObject({ displayProceeds: 0, completeProceeds: false });
    expect(yearOverYear(d, "2026-07", () => true).growth).toBeNull();
  });
  it("retains signed negative deductions for a refund-only month", () => {
    const r = row({ gross: 0, refunds: 1100, proceeds: -850, fee: -150, tax: -100, units: -1 });
    expect(storeTake(summarize([r], emptyData())).total).toBe(-250);
  });
  it("keeps fractional currency precision in explicitly requested what-if estimates", () => {
    const value = estimateGoogleDeveloperShare({ gross: 1.99, refunds: 0, tax: 0, currency: "USD", rate: 0.15 });
    expect(value.fee).toBeCloseTo(0.2985);
    expect(value.proceeds).toBeCloseTo(1.6915);
  });
  it("preserves account-wide Google adjustments that have no app or title", async () => {
    const [r] = await parseReport(doc(googleEarningsHeader + 'adjustment,"Sep 01, 2026",Adjustment,,,KRW,-200,', "earnings"));
    expect(r).toMatchObject({ appId: "google:__account_adjustments__", appName: "계정 조정", proceeds: -200, units: 0 });
    expect(summarize([r], emptyData()).proceeds).toBe(-200);
  });
  it("does not count each partial Google sales refund as a whole refunded unit", async () => {
    const rows = await parseReport(doc(googleSalesHeader + [
      "GPA.1,2026-09-01,charged,com.app,앱,KRW,11000,1000,KR",
      "GPA.1,2026-09-01,partial refund,com.app,앱,KRW,1100,100,KR",
      "GPA.1,2026-09-01,partial refund,com.app,앱,KRW,1100,100,KR",
    ].join("\n")));
    expect(countPaidSales(rows)).toMatchObject({ sold: 1, refunded: 0, net: 1 });
    expect(summarize(rows, emptyData()).refunds).toBe(2200);
  });
  it("honors Google earnings Refund Type for partial refunds", async () => {
    const [r] = await parseReport(doc(googleEarningsHeader + 'GPA.1,"Sep 01, 2026",Charge refund,com.app,앱,KRW,-1100,Partial'));
    expect(r.units).toBe(0);
    expect(r.refunds).toBe(1100);
  });
  it("replaces a Google revision across transport keys and preserves adjustment files", async () => {
    const old = doc(googleEarningsHeader + 'GPA.1,"Sep 01, 2026",Charge,com.app,앱,KRW,1100,', "google:local:earnings_202609.zip:earnings_202609.csv");
    const updated = doc(googleEarningsHeader + 'GPA.1,"Sep 01, 2026",Charge,com.app,앱,KRW,2200,', "google:earnings/earnings_202609.zip:earnings_202609.csv");
    const adjustment = doc(googleEarningsHeader + 'adjustment,"Sep 01, 2026",Adjustment,,,KRW,-100,', "google:earnings/earnings_202609_adjustment.zip:earnings_202609_adjustment.csv");
    let d = mergeReports(emptyData(), [{ document: old, rows: await parseReport(old) }, { document: adjustment, rows: await parseReport(adjustment) }]);
    d = mergeReports(d, [{ document: updated, rows: await parseReport(updated) }]);
    expect(d.rows).toHaveLength(2);
    expect(d.imports).toHaveLength(2);
    expect(summarize(d.rows, d).proceeds).toBe(2100);
  });
  it("infers Google report month from filename rather than an adjacent transaction date", async () => {
    const report = doc(googleEarningsHeader + 'GPA.1,"Aug 31, 2026",Charge,com.app,앱,KRW,1100,', "file:earnings_202609.csv");
    const [r] = await parseReport(report);
    expect(r.period).toBe("2026-09");
    expect(r.date).toBe("2026-08-31");
  });
  it("preserves source timestamps in import provenance", async () => {
    const report = { ...doc(csvTemplate), source: "cache" as const, fetchedAt: "2026-10-08T01:00:00Z", sourceUpdatedAt: "2026-10-01T01:00:00Z" };
    const d = mergeReports(emptyData(), [{ document: report, rows: await parseReport(report) }]);
    expect(d.imports[0]).toMatchObject({ source: "cache", fetchedAt: report.fetchedAt, sourceUpdatedAt: report.sourceUpdatedAt, period: "2026-09" });
  });
  it("cannot report revenue sync success when no revenue documents were collected", () => {
    expect(syncLogStatus(0, 3, 0)).toBe("partial");
    expect(syncLogStatus(0, 0, 0)).toBe("partial");
    expect(formatSyncToast({ apps: 3, documents: [], errors: [] })).toContain("수익 확인 필요");
  });
});

describe("FX report dates", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
  it("requests today's reference FX during an open month instead of a future month-end", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-08T03:00:00Z"));
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ date: "2026-10-08", rates: { KRW: 1300 } }) });
    vi.stubGlobal("fetch", fetcher);
    expect(await fetchMonthRatesKrw("2026-10", ["USD"])).toHaveProperty("2026-10:USD");
    expect(fetcher).toHaveBeenCalledWith("https://api.frankfurter.app/2026-10-08?from=USD&to=KRW", { signal: expect.any(AbortSignal) });
  });
  it("does not invent rates for a future period", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-08T03:00:00Z"));
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    expect(await fetchMonthRatesKrw("2026-11", ["USD"])).toEqual({});
    expect(fetcher).not.toHaveBeenCalled();
  });
});


describe("separate earnings shards", () => {
  it("retains additional adjustment archives even when entry filename and amount match", async () => {
    const text = googleEarningsHeader + 'adjustment,"Sep 01, 2026",Adjustment,,,KRW,-100,';
    const first = doc(text, "google:earnings/earnings_202609.zip:earnings_202609.csv");
    const adjustment = doc(text, "google:earnings/earnings_202609_adjustment.zip:earnings_202609.csv");
    let d = mergeReports(emptyData(), [{ document: first, rows: await parseReport(first) }, { document: adjustment, rows: await parseReport(adjustment) }]);
    expect(d.rows).toHaveLength(2);
    expect(summarize(d.rows, d).proceeds).toBe(-200);
    d = mergeReports(d, [{ document: adjustment, rows: await parseReport(adjustment) }]);
    expect(d.rows).toHaveLength(2);
    expect(summarize(d.rows, d).proceeds).toBe(-200);
  });
  it("retains nested CSV entries with matching basenames", async () => {
    const text = googleEarningsHeader + 'adjustment,"Sep 01, 2026",Adjustment,,,KRW,-100,';
    const a = doc(text, "google:earnings/earnings_202609.zip:first/report.csv");
    const b = doc(text, "google:earnings/earnings_202609.zip:second/report.csv");
    const d = mergeReports(emptyData(), [{ document: a, rows: await parseReport(a) }, { document: b, rows: await parseReport(b) }]);
    expect(d.rows).toHaveLength(2);
    expect(summarize(d.rows, d).proceeds).toBe(-200);
  });
});


describe("conservative source coverage", () => {
  it("does not suppress another app when a manual monthly file only covers one app", () => {
    const monthly = row({ id: "month", basis: "estimate", source: "apple-sales", reportKey: "file:subset.txt", date: "2026-07-01", endDate: "2026-07-31", appId: "apple:first" });
    const daily = row({ id: "day", basis: "estimate", source: "apple-sales", reportKey: "apple-sales:2026-07-01", appId: "apple:second" });
    expect(selectRevenueRows([monthly, daily]).rows).toHaveLength(2);
  });
  it("does not replace a verified API report with an undated cached copy", async () => {
    const fresh = { ...doc(googleEarningsHeader + 'GPA.1,"Sep 01, 2026",Charge,com.app,앱,KRW,2200,', "google:earnings/earnings_202609.zip:earnings_202609.csv"), source: "api" as const, fetchedAt: "2026-10-08T00:00:00Z" };
    const stale = { ...fresh, text: fresh.text.replace("2200", "1100"), source: "cache" as const, fetchedAt: undefined };
    const d = mergeReports(emptyData(), [{ document: fresh, rows: await parseReport(fresh) }]);
    const next = mergeReports(d, [{ document: stale, rows: await parseReport(stale) }]);
    expect(next.rows).toEqual(d.rows);
    expect(next.imports).toEqual(d.imports);
  });
});


describe("data quality indicators", () => {
  it("does not use a prior month's extra settled reports to create a false sales-drop alert", () => {
    const d = emptyData();
    d.rows = [row({ id: "current-sales", basis: "estimate" }), row({ id: "previous-sales", basis: "estimate", period: "2026-06" }), row({ id: "previous-final", basis: "settled", period: "2026-06", gross: 99000, proceeds: 90000 })];
    expect(detectAnomalies(d, "2026-07", null).some((a) => a.id === "revenue-drop-50")).toBe(false);
  });
  it("does not mark month-close revenue and FX complete using estimates or a partial sync log", () => {
    const d = emptyData(); d.rows = [row({ basis: "estimate" })];
    const items = buildMonthCloseChecklist(d, "2026-07", null, { id: "partial", at: new Date().toISOString(), status: "partial", message: "apps only" });
    for (const id of ["sync", "apple-sales", "fx"])
      expect(items.find((item) => item.id === id)?.done).toBe(false);
    expect(items.some((item) => item.id === "google-sales")).toBe(false);
  });
});


it("keeps adjustment tax review stable when the base report is revised before reimport", async () => {
  const base = doc(googleEarningsHeader + 'adjustment,"Sep 01, 2026",Adjustment,,,KRW,-100,', "google:earnings/earnings_202609.zip:earnings_202609.csv");
  const adjustment = { ...base, key: "google:earnings/earnings_202609_adjustment.zip:earnings_202609.csv" };
  let d = mergeReports(emptyData(), [{ document: base, rows: await parseReport(base) }, { document: adjustment, rows: await parseReport(adjustment) }]);
  const reviewed = d.rows.find((row) => row.reportKey === adjustment.key)!;
  reviewed.taxClass = "excluded"; reviewed.evidence = "reviewed adjustment";
  const revision = { ...base, text: base.text.replace("-100", "-200") };
  d = mergeReports(d, [{ document: revision, rows: await parseReport(revision) }]);
  d = mergeReports(d, [{ document: adjustment, rows: await parseReport(adjustment) }]);
  expect(d.rows.find((row) => row.reportKey === adjustment.key)).toMatchObject({ id: reviewed.id, taxClass: "excluded", evidence: "reviewed adjustment" });
});


describe("native zero amounts do not require FX", () => {
  it("treats free Apple downloads in an unsupported currency as a known zero", () => {
    const r = row({ source: "apple-sales", basis: "estimate", gross: 0, refunds: 0, fee: null, tax: null, proceeds: 0, units: 100, currency: "AED", proceedsCurrency: "AED" });
    expect(amounts(r, emptyData())).toMatchObject({ gross: 0, refunds: 0, fee: 0, tax: 0, proceeds: 0, grossAvailable: true, proceedsAvailable: true, missingGrossFx: false, missingProceedsFx: false });
    expect(summarize([r], emptyData())).toMatchObject({ missing: 0, missingGrossFx: 0, missingProceedsFx: 0, completeProceeds: true, units: 100 });
    expect(neededCurrencies([r], "2026-07")).toEqual([]);
  });
  it("keeps an unreported zero-sale net amount unknown without requesting a payout FX rate", () => {
    const r = row({ gross: 0, refunds: 0, fee: null, tax: null, proceeds: null, currency: "AED", proceedsCurrency: "AED" });
    expect(summarize([r], emptyData())).toMatchObject({ missing: 0, unknownProceeds: 1, completeProceeds: false });
    expect(neededCurrencies([r], "2026-07")).toEqual([]);
  });
  it.each([{ fee: 2, tax: 0 }, { fee: 0, tax: -2 }, { fee: null, tax: 2 }])("requires FX for a nonzero fee or tax even when gross and proceeds are zero: %j", (deductions) => {
    const r = row({ gross: 0, refunds: 0, proceeds: 0, currency: "AED", proceedsCurrency: "EUR", ...deductions });
    expect(amounts(r, emptyData())).toMatchObject({ grossAvailable: false, proceedsAvailable: true, missingGrossFx: true, missingProceedsFx: false, proceeds: 0 });
    expect(neededCurrencies([r], "2026-07")).toEqual(["AED"]);
  });
  it("requires FX for a nonzero refund even with zero gross", () => {
    const r = row({ gross: 0, refunds: 1, fee: 0, tax: 0, proceeds: 0, currency: "AED", proceedsCurrency: "AED" });
    expect(summarize([r], emptyData())).toMatchObject({ missingGrossFx: 1, missingProceedsFx: 0 });
    expect(neededCurrencies([r], "2026-07")).toEqual(["AED"]);
  });
  it("only requests the nonzero payout currency when all buyer-currency amounts are zero", () => {
    const r = row({ gross: 0, refunds: 0, fee: 0, tax: 0, proceeds: 5, currency: "AED", proceedsCurrency: "USD" });
    expect(summarize([r], emptyData())).toMatchObject({ missingGrossFx: 0, missingProceedsFx: 1, completeProceeds: false });
    expect(neededCurrencies([r], "2026-07")).toEqual(["USD"]);
  });
});
