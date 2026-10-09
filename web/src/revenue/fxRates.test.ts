import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchMissingRevenueRates, mergeFetchedRevenueRates } from "./fxRates";
import type { RevenueData, RevenueRow } from "./types";

const row = (period: string, currency = "USD", proceedsCurrency = currency): RevenueRow => ({
  id: `${period}:${currency}:${proceedsCurrency}`, reportKey: "test", date: `${period}-01`, period,
  platform: "apple", appId: "apple:test", appName: "테스트", country: "US",
  currency, proceedsCurrency, gross: 10, refunds: 0, fee: null, tax: null,
  proceeds: 7, units: 1, basis: "settled", taxClass: "unreviewed",
});
const requestedDate = (url: string) => /\d{4}-\d{2}-\d{2}/.exec(url)?.[0] ?? "";
const response = (value = 1300, date = "2025-11-28") => ({ ok: true, json: async () => ({ date, rates: { KRW: value } }) });

describe("missing revenue rates across periods", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

  it("fetches all report periods and both currencies while reusing each period/currency key", async () => {
    const fetcher = vi.fn(async (url: string) => response(1300, requestedDate(url)));
    vi.stubGlobal("fetch", fetcher);
    const rows = [row("2025-11", "USD", "EUR"), row("2025-11", "USD", "EUR"), row("2025-12", "USD"), row("2025-12", "KRW")];
    const fresh = await fetchMissingRevenueRates(rows, {});
    expect(Object.keys(fresh).sort()).toEqual(["2025-11:EUR", "2025-11:USD", "2025-12:USD"]);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("preserves existing rates and returns only newly fetched entries", async () => {
    const fetcher = vi.fn(async (url: string) => response(1250, requestedDate(url)));
    vi.stubGlobal("fetch", fetcher);
    const existing: RevenueData["rates"] = { "2025-11:USD": { value: 1400, note: "reviewed manual rate" } };
    const original = structuredClone(existing);
    const fresh = await fetchMissingRevenueRates([row("2025-11", "USD", "EUR"), row("2025-12", "USD")], existing);
    expect(existing).toEqual(original);
    expect(fresh).not.toHaveProperty("2025-11:USD");
    expect(Object.keys(fresh).sort()).toEqual(["2025-11:EUR", "2025-12:USD"]);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(await fetchMissingRevenueRates([row("2025-11")], existing)).toEqual({});
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("does not request or synthesize future-month rates", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-08T03:00:00Z"));
    const fetcher = vi.fn(async (url: string) => response(1300, requestedDate(url))); vi.stubGlobal("fetch", fetcher);
    const fresh = await fetchMissingRevenueRates([row("2026-11"), row("2026-09")], {});
    expect(Object.keys(fresh)).toEqual(["2026-09:USD"]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("leaves failed and invalid rates missing while retaining successful months", async () => {
    const fetcher = vi.fn(async (url: string) => {
      if (url.includes("2025-09")) throw new Error("offline");
      if (url.includes("2025-10")) return { ok: false, status: 503 };
      if (url.includes("2025-11")) return response(Number.NaN, requestedDate(url));
      return response(1300, requestedDate(url));
    });
    vi.stubGlobal("fetch", fetcher);
    expect(Object.keys(await fetchMissingRevenueRates([row("2025-09"), row("2025-10"), row("2025-11"), row("2025-12")], {}))).toEqual(["2025-12:USD"]);
  });

  it("keeps no more than three months in flight", async () => {
    let running = 0, maximum = 0;
    const release: (() => void)[] = [];
    const fetcher = vi.fn((url: string) => new Promise<ReturnType<typeof response>>((resolve) => {
      running++; maximum = Math.max(maximum, running);
      release.push(() => { running--; resolve(response(1300, requestedDate(url))); });
    }));
    vi.stubGlobal("fetch", fetcher);
    const pending = fetchMissingRevenueRates([row("2025-08"), row("2025-09"), row("2025-10"), row("2025-11")], {});
    expect(fetcher).toHaveBeenCalledTimes(3);
    release.splice(0).forEach(done => done());
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(4));
    release.splice(0).forEach(done => done());
    expect(Object.keys(await pending)).toHaveLength(4);
    expect(maximum).toBe(3);
  });

  it("bounds each provider request to ten seconds and keeps unresolved rates missing", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-08T03:00:00Z"));
    let aborted = false;
    vi.stubGlobal("fetch", vi.fn((_url: string, options: RequestInit) => new Promise((_resolve, reject) => {
      options.signal!.addEventListener("abort", () => { aborted = true; reject(new Error("aborted")); });
    })));
    const pending = fetchMissingRevenueRates([row("2026-09")], {});
    await vi.advanceTimersByTimeAsync(20_000);
    expect(await pending).toEqual({});
    expect(aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("skips all-zero unsupported currencies but fetches nonzero deductions and proceeds", async () => {
    const fetcher = vi.fn(async (url: string) => response(1300, requestedDate(url))); vi.stubGlobal("fetch", fetcher);
    const zero = { ...row("2025-11", "AED"), gross: 0, refunds: 0, fee: null, tax: null, proceeds: 0 };
    const charge = { ...row("2025-11", "USD", "EUR"), proceeds: 0 };
    const fee = { ...zero, id: "fee", currency: "GBP", fee: 2 };
    const proceeds = { ...zero, id: "net", proceedsCurrency: "CAD", proceeds: 3 };
    expect(await fetchMissingRevenueRates([zero], {})).toEqual({});
    expect(fetcher).not.toHaveBeenCalled();
    expect(Object.keys(await fetchMissingRevenueRates([zero, charge, fee, proceeds], {})).sort()).toEqual(["2025-11:CAD", "2025-11:GBP", "2025-11:USD"]);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

});


describe("automatic FX refresh without replacing reviewed rates", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
  const key = "2026-10:USD";
  const oldAuto = () => ({ value: 1300, note: "자동 · Frankfurter/ECB 2026-10-08", source: "frankfurter" as const, observedAt: "2026-10-08", asOf: "2026-10-08" });
  it("refreshes an open-month automatic rate through month-end and records the holiday cutoff", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-01T03:00:00Z"));
    const fetcher = vi.fn(async () => response(1400, "2026-10-30")); vi.stubGlobal("fetch", fetcher);
    const baseline = { [key]: oldAuto() };
    const fresh = await fetchMissingRevenueRates([row("2026-10")], baseline);
    expect(fresh[key]).toMatchObject({ value: 1400, source: "frankfurter", observedAt: "2026-10-30", asOf: "2026-10-31" });
    const merged = mergeFetchedRevenueRates(baseline, fresh, baseline);
    expect(merged[key].value).toBe(1400);
    expect(await fetchMissingRevenueRates([row("2026-10")], merged)).toEqual({});
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("refreshes earlier automatic observations during the current month", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-09T03:00:00Z"));
    vi.stubGlobal("fetch", vi.fn(async () => response(1400, "2026-10-09")));
    expect((await fetchMissingRevenueRates([row("2026-10")], { [key]: oldAuto() }))[key].asOf).toBe("2026-10-09");
  });
  it("migrates only exact legacy auto notes and preserves manual or ambiguous notes", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-01T03:00:00Z"));
    const fetcher = vi.fn(async () => response(1400, "2026-10-30")); vi.stubGlobal("fetch", fetcher);
    for (const rate of [
      { value: 1234, note: "직접 확인한 환율" },
      { value: 1234, note: "자동 · Frankfurter/ECB 2026-10-08 (수정)" },
      { value: 1234, note: "자동 · Frankfurter/ECB 2026-10-08", source: "manual" as const },
      { value: 1234, note: "자동 · Frankfurter/ECB 2026-09-30" },
    ]) expect(await fetchMissingRevenueRates([row("2026-10")], { [key]: rate })).toEqual({});
    expect(fetcher).not.toHaveBeenCalled();
    expect((await fetchMissingRevenueRates([row("2026-10")], { [key]: { value: 1300, note: "자동 · Frankfurter/ECB 2026-10-08" } }))[key].value).toBe(1400);
  });
  it("keeps old rates after lookup failure and leaves the source data untouched", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-01T03:00:00Z"));
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const baseline = { [key]: oldAuto() }, issues: unknown[] = [];
    const fresh = await fetchMissingRevenueRates([row("2026-10")], baseline, issue => issues.push(issue));
    expect(fresh).toEqual({});
    expect(mergeFetchedRevenueRates(baseline, fresh, baseline)).toEqual(baseline);
    expect(issues).toHaveLength(1);
  });
  it("does not overwrite a concurrent immutable manual edit or restore a deleted rate", () => {
    const baseline = { [key]: oldAuto() };
    const fetched = { [key]: { ...oldAuto(), value: 1400, observedAt: "2026-10-30", asOf: "2026-10-31" } };
    const edited = { [key]: { value: 1500, note: "검토함", source: "manual" as const } };
    expect(mergeFetchedRevenueRates(edited, fetched, baseline)).toEqual(edited);
    expect(mergeFetchedRevenueRates({}, fetched, baseline)).toEqual({});
  });
  it("does not overwrite a manual edit made in place while refresh runs", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-01T03:00:00Z"));
    const baseline: RevenueData["rates"] = { [key]: oldAuto() };
    vi.stubGlobal("fetch", vi.fn(async () => { baseline[key].value = 1500; baseline[key].source = "manual"; return response(1400, "2026-10-30"); }));
    expect(await fetchMissingRevenueRates([row("2026-10")], baseline)).toEqual({});
    expect(baseline[key].value).toBe(1500);
  });
});
