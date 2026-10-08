import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchMissingRevenueRates, fetchMonthRatesKrw, type FxRateIssue } from "./fxRates";
import type { RevenueData, RevenueRow } from "./types";

const header = "KEY,FREQ,CURRENCY,CURRENCY_DENOM,EXR_TYPE,EXR_SUFFIX,TIME_PERIOD,OBS_VALUE";
const observation = (currency: string, date: string, value: number | string) =>
  ["ignored", "D", currency, "EUR", "SP00", "A", date, value].join(",");
const csvResponse = (body: string) => ({ ok: true, text: async () => body });
const primaryResponse = (base: string, date: string, value: number) =>
  ({ ok: true, json: async () => ({ base, date, amount: 1, rates: { KRW: value } }) });
const csv = (...records: string[]) => [header, ...records].join("\n");
const blocked = { ok: false, status: 403 };
function fallback(body: string) {
  const fetcher = vi.fn(async (url: string) =>
    url.startsWith("https://api.frankfurter.app/") ? blocked : csvResponse(body));
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}
const row = (currency: string): RevenueRow => ({
  id: currency, reportKey: "test", date: "2026-07-01", period: "2026-07",
  platform: "google", appId: "test", appName: "테스트", country: "US",
  currency, gross: 10, refunds: 0, fee: null, tax: null, proceeds: 7,
  proceedsCurrency: currency, units: 1, basis: "settled", taxClass: "unreviewed",
});

describe("official ECB fallback", () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-08T03:00:00Z")); });
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

  it("recovers an inaccessible primary with the same-date KRW/USD cross-rate and source date", async () => {
    const fetcher = fallback(csv(observation("KRW", "2026-07-31", 1500), observation("USD", "2026-07-31", 1.2)));
    const onIssue = vi.fn();
    const result = await fetchMonthRatesKrw("2026-07", ["usd", "USD", "KRW"], onIssue);
    expect(result["2026-07:USD"]).toMatchObject({ value: 1250 });
    expect(result["2026-07:USD"].note).toContain("ECB 직접 2026-07-31");
    expect(result["2026-07:USD"].note).toContain("Frankfurter 조회 보완");
    expect(onIssue).not.toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledTimes(2);
    const url = new URL(fetcher.mock.calls[1][0]);
    expect(url.origin).toBe("https://data-api.ecb.europa.eu");
    expect(url.pathname).toBe("/service/data/EXR/D.KRW+USD.EUR.SP00.A");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      startPeriod: "2026-07-01", endPeriod: "2026-07-31", format: "csvdata", detail: "dataonly",
    });
  });

  it("keeps valid primary rates and only fetches missing currencies, using 1 EUR as the denominator", async () => {
    const fetcher = vi.fn(async (url: string) => {
      if (url.startsWith("https://data-api.ecb.europa.eu/"))
        return csvResponse(csv(observation("KRW", "2026-07-30", 1500)));
      return url.includes("from=USD") ? primaryResponse("USD", "2026-07-31", 1280) : blocked;
    });
    vi.stubGlobal("fetch", fetcher);
    const rates = await fetchMonthRatesKrw("2026-07", ["USD", "EUR"]);
    expect(rates["2026-07:USD"].value).toBe(1280);
    expect(rates["2026-07:EUR"].value).toBe(1500);
    expect(rates["2026-07:EUR"].note).toContain("2026-07-30");
    expect(fetcher.mock.calls.filter(([url]) => url.includes("ecb.europa.eu/")).map(([url]) => new URL(url).pathname))
      .toEqual(["/service/data/EXR/D.KRW.EUR.SP00.A"]);
  });

  it("uses the latest common observation instead of mixing dates", async () => {
    fallback(csv(
      observation("KRW", "2026-07-31", 1700),
      observation("KRW", "2026-07-30", 1500), observation("USD", "2026-07-30", 1.2),
      observation("KRW", "2026-07-29", 1400), observation("USD", "2026-07-29", 1),
    ));
    const rates = await fetchMonthRatesKrw("2026-07", ["USD"]);
    expect(rates["2026-07:USD"].value).toBe(1250);
    expect(rates["2026-07:USD"].note).toContain("2026-07-30");
  });

  it("reports a gap if the two currencies never share an observation date", async () => {
    fallback(csv(observation("KRW", "2026-07-31", 1500), observation("USD", "2026-07-30", 1.2)));
    const issues: FxRateIssue[] = [];
    expect(await fetchMonthRatesKrw("2026-07", ["USD"], (issue) => issues.push(issue))).toEqual({});
    expect(issues).toMatchObject([{ month: "2026-07", currency: "USD", reason: "unavailable" }]);
  });

  it("keeps available pairs but reports optional currencies omitted by ECB", async () => {
    fallback(csv(observation("KRW", "2026-07-31", 1500), observation("USD", "2026-07-31", 1.2)));
    const issues: FxRateIssue[] = [];
    const rates = await fetchMonthRatesKrw("2026-07", ["USD", "GBP"], (issue) => issues.push(issue));
    expect(Object.keys(rates)).toEqual(["2026-07:USD"]);
    expect(issues.map(({ currency, reason }) => ({ currency, reason }))).toEqual([{ currency: "GBP", reason: "unavailable" }]);
  });

  it("caps the open-month request at today and excludes future observations", async () => {
    const fetcher = fallback(csv(
      observation("KRW", "2026-10-09", 1600), observation("USD", "2026-10-09", 1),
      observation("KRW", "2026-10-08", 1500), observation("USD", "2026-10-08", 1.2),
    ));
    const rates = await fetchMonthRatesKrw("2026-10", ["USD"]);
    expect(rates["2026-10:USD"].value).toBe(1250);
    expect(rates["2026-10:USD"].note).toContain("2026-10-08");
    expect(new URL(fetcher.mock.calls[1][0]).searchParams.get("endPeriod")).toBe("2026-10-08");
  });

  it("never requests future months, invalid months, or malformed currency input", async () => {
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    expect(await fetchMonthRatesKrw("2026-11", ["USD"])).toEqual({});
    expect(await fetchMonthRatesKrw("2026-13", ["USD"])).toEqual({});
    expect(await fetchMonthRatesKrw("2026-07", ["https://example.com", "USD+KRW", "../USD", "KRW"])).toEqual({});
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("reports unsupported ISO currencies without sending them to a provider", async () => {
    const fetcher = fallback(csv(observation("KRW", "2026-07-31", 1500), observation("USD", "2026-07-31", 1.2)));
    const issues: FxRateIssue[] = [];
    const rates = await fetchMonthRatesKrw("2026-07", ["AED", "USD", "aed"], (issue) => issues.push(issue));
    expect(Object.keys(rates)).toEqual(["2026-07:USD"]);
    expect(issues).toMatchObject([{ currency: "AED", reason: "unsupported" }]);
    expect(fetcher.mock.calls.every(([url]) => !url.includes("AED"))).toBe(true);
  });

  it.each([
    ["zero", 0], ["negative", -1], ["non-finite", "Infinity"], ["non-numeric", "missing"], ["empty", ""],
  ])("does not fabricate a cross-rate from a %s observation", async (_name, value) => {
    fallback(csv(observation("KRW", "2026-07-31", 1500), observation("USD", "2026-07-31", value)));
    expect(await fetchMonthRatesKrw("2026-07", ["USD"])).toEqual({});
  });

  it.each(["2026-06-30", "2026-08-01", "2026-07-32"])("rejects observations outside the requested valid dates: %s", async (date) => {
    fallback(csv(observation("KRW", date, 1500), observation("USD", date, 1.2)));
    expect(await fetchMonthRatesKrw("2026-07", ["USD"])).toEqual({});
  });

  it.each(["", "TIME_PERIOD,OBS_VALUE\n2026-07-31,1500", header + ",OBS_VALUE\nx,D,KRW,EUR,SP00,A,2026-07-31,1500,1500"])(
    "rejects empty, incomplete, or ambiguous CSV headers",
    async (body) => {
      fallback(body);
      expect(await fetchMonthRatesKrw("2026-07", ["USD"])).toEqual({});
    },
  );

  it("rejects wrong series metadata and conflicting duplicate observations", async () => {
    fallback(csv(
      observation("KRW", "2026-07-31", 1500),
      observation("USD", "2026-07-31", 1.2), observation("USD", "2026-07-31", 1.3),
      observation("USD", "2026-07-30", 1.2).replace(",D,", ",M,"),
      observation("KRW", "2026-07-30", 1500),
      observation("USD", "2026-07-29", 1.2).replace(",EUR,", ",GBP,"),
      observation("KRW", "2026-07-29", 1500),
    ));
    expect(await fetchMonthRatesKrw("2026-07", ["USD"])).toEqual({});
  });

  it.each([
    { date: "2026-08-01", base: "USD" },
    { date: "2026-06-30", base: "USD" },
    { date: "2026-07-31", base: "EUR" },
    { date: undefined, base: "USD" },
  ])("recovers primary responses that cannot prove their date and currency: %j", async (data) => {
    const fetcher = vi.fn(async (url: string) => url.startsWith("https://api.frankfurter.app/")
      ? { ok: true, json: async () => ({ ...data, rates: { KRW: 100 } }) }
      : csvResponse(csv(observation("KRW", "2026-07-31", 1500), observation("USD", "2026-07-31", 1.2))));
    vi.stubGlobal("fetch", fetcher);
    const rates = await fetchMonthRatesKrw("2026-07", ["USD"]);
    expect(rates["2026-07:USD"].value).toBe(1250);
    expect(rates["2026-07:USD"].note).toContain("ECB 직접");
  });

  it("preserves manual rates while recovering another currency from ECB", async () => {
    const fetcher = fallback(csv(observation("KRW", "2026-07-31", 1500)));
    const manual: RevenueData["rates"] = { "2026-07:USD": { value: 1234, note: "검토한 수동 환율" } };
    const original = structuredClone(manual);
    const rates = await fetchMissingRevenueRates([row("USD"), row("EUR")], manual);
    expect(manual).toEqual(original);
    expect(Object.keys(rates)).toEqual(["2026-07:EUR"]);
    expect(fetcher.mock.calls.every(([url]) => !url.includes("USD"))).toBe(true);
  });

  it("does not overwrite a manual rate entered while automatic lookup is running", async () => {
    const rates: RevenueData["rates"] = {};
    vi.stubGlobal("fetch", vi.fn(async () => {
      rates["2026-07:USD"] = { value: 1234, note: "검토한 수동 환율" };
      return primaryResponse("USD", "2026-07-31", 1280);
    }));
    expect(await fetchMissingRevenueRates([row("USD")], rates)).toEqual({});
    expect(rates["2026-07:USD"].value).toBe(1234);
  });

  it("reports both providers failing without inserting a zero rate", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("offline")); vi.stubGlobal("fetch", fetcher);
    const onIssue = vi.fn();
    expect(await fetchMonthRatesKrw("2026-07", ["USD"], onIssue)).toEqual({});
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(onIssue).toHaveBeenCalledWith(expect.objectContaining({ month: "2026-07", currency: "USD", reason: "unavailable" }));
    expect(vi.getTimerCount()).toBe(0);
  });
});
