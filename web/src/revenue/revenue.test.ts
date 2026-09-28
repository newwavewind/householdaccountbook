import { describe, expect, it } from "vitest";
import {
  amounts,
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
});
