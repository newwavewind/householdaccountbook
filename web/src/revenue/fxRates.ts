import type { RevenueData, RevenueRow } from "./types";
import { rowCurrenciesNeedingConversion, validDate } from "./model";
import { parseDelimited } from "./imports";

// ECB reference currencies, including legacy codes with historical observations.
const ECB_CURRENCIES = new Set(
  "AUD BGN BRL CAD CHF CNY CZK DKK EUR GBP HKD HRK HUF IDR ILS INR ISK JPY KRW MXN MYR NOK NZD PHP PLN RON RUB SEK SGD THB TRY USD ZAR".split(" "),
);
const ECB_ENDPOINT = "https://data-api.ecb.europa.eu/service/data/EXR";
export interface FxRateIssue {
  month: string;
  currency: string;
  reason: "unsupported" | "unavailable";
  message: string;
}
type Rates = RevenueData["rates"];
const positive = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value > 0;
const observationInPeriod = (date: unknown, month: string, end: string): date is string =>
  typeof date === "string" && validDate(date) && date.startsWith(month) && date <= end;

async function withTimeout<T>(read: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    return await read(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
}

/** Cross only observations from the same date, expressed per one EUR. */
async function fetchEcbRates(month: string, end: string, currencies: string[]): Promise<Rates> {
  if (!currencies.length) return {};
  const quotes = [...new Set(["KRW", ...currencies.filter((code) => code !== "EUR")])].sort();
  const params = new URLSearchParams({
    startPeriod: month + "-01", endPeriod: end, format: "csvdata", detail: "dataonly",
  });
  const csv = await withTimeout(async (signal) => {
    const response = await fetch(ECB_ENDPOINT + "/D." + quotes.join("+") + ".EUR.SP00.A?" + params, { signal });
    if (!response.ok) throw new Error("ECB " + response.status);
    const text = await response.text();
    if (text.length > 2_000_000) throw new Error("ECB response too large");
    return text;
  });
  const [header, ...records] = parseDelimited(csv);
  if (!header) return {};
  const fields = ["FREQ", "CURRENCY", "CURRENCY_DENOM", "EXR_TYPE", "EXR_SUFFIX", "TIME_PERIOD", "OBS_VALUE"];
  if (!fields.every((field) => header.filter((name) => name === field).length === 1)) return {};
  const dates = new Map<string, Map<string, number>>();
  const conflicts = new Set<string>();
  for (const cells of records) {
    const get = (field: string) => cells[header.indexOf(field)] ?? "";
    const date = get("TIME_PERIOD"), currency = get("CURRENCY");
    const value = Number(get("OBS_VALUE"));
    if (get("FREQ") !== "D" || get("CURRENCY_DENOM") !== "EUR" ||
      get("EXR_TYPE") !== "SP00" || get("EXR_SUFFIX") !== "A" ||
      !quotes.includes(currency) || !observationInPeriod(date, month, end) || !positive(value)) continue;
    const daily = dates.get(date) ?? new Map<string, number>();
    const key = date + ":" + currency;
    if (conflicts.has(key)) continue;
    if (daily.has(currency) && daily.get(currency) !== value) {
      daily.delete(currency);
      conflicts.add(key);
      continue;
    }
    daily.set(currency, value);
    dates.set(date, daily);
  }
  const out: Rates = {};
  for (const currency of currencies) {
    for (const date of [...dates.keys()].sort().reverse()) {
      const daily = dates.get(date)!;
      const krw = daily.get("KRW"), base = currency === "EUR" ? 1 : daily.get(currency);
      if (!positive(krw) || !positive(base)) continue;
      const value = krw / base;
      if (!positive(value)) continue;
      out[month + ":" + currency] = {
        value,
        note: "자동 · ECB 직접 " + date + " · 1 " + currency + "당 원화 · Frankfurter 조회 보완",
      };
      break;
    }
  }
  return out;
}

/** Month-end reference FX; incomplete months use only observations through today. */
export async function fetchMonthRatesKrw(
  month: string,
  currencies: string[],
  onIssue?: (issue: FxRateIssue) => void,
): Promise<Rates> {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return {};
  const today = new Date().toISOString().slice(0, 10);
  if (month > today.slice(0, 7)) return {};
  const requested = [...new Set(currencies.map((code) => code.toUpperCase())
    .filter((code) => /^[A-Z]{3}$/.test(code) && code !== "KRW"))];
  const needed = requested.filter((code) => ECB_CURRENCIES.has(code));
  for (const currency of requested.filter((code) => !ECB_CURRENCIES.has(code)))
    onIssue?.({ month, currency, reason: "unsupported", message: month + " " + currency + ": ECB 기준환율 지원 통화가 아닙니다. 정산 명세서 등의 환율을 입력해 주세요." });
  if (!needed.length) return {};
  const [year, m] = month.split("-").map(Number);
  const monthEnd = new Date(Date.UTC(year, m, 0)).toISOString().slice(0, 10);
  const date = monthEnd < today ? monthEnd : today;
  const out: Rates = {};
  await Promise.all(needed.map(async (code) => {
    try {
      const json = await withTimeout(async (signal) => {
        const response = await fetch(
          "https://api.frankfurter.app/" + date + "?from=" + encodeURIComponent(code) + "&to=KRW",
          { signal },
        );
        if (!response.ok) throw new Error("Frankfurter " + response.status);
        return await response.json() as { rates?: { KRW?: number }; date?: string; base?: string; amount?: number };
      });
      const value = json.rates?.KRW;
      if (!positive(value) || !observationInPeriod(json.date, month, date) ||
        (json.base !== undefined && json.base !== code) ||
        (json.amount !== undefined && json.amount !== 1)) return;
      out[month + ":" + code] = { value, note: "자동 · Frankfurter/ECB " + json.date };
    } catch {
      // Recover provider/network failures through the independent official ECB endpoint.
    }
  }));
  const missing = needed.filter((code) => !out[month + ":" + code]);
  if (missing.length) {
    try { Object.assign(out, await fetchEcbRates(month, date, missing)); } catch { /* report remaining gaps below */ }
    for (const currency of missing.filter((code) => !out[month + ":" + code]))
      onIssue?.({ month, currency, reason: "unavailable", message: month + " " + currency + ": 두 환율 조회 경로에서 같은 날짜의 기준환율을 확인하지 못했습니다. 다시 조회하거나 환율 근거를 입력해 주세요." });
  }
  return out;
}

/** Fetch only absent period/currency keys, with at most three months in flight. */
export async function fetchMissingRevenueRates(
  rows: RevenueRow[],
  existingRates: RevenueData["rates"],
  onIssue?: (issue: FxRateIssue) => void,
): Promise<RevenueData["rates"]> {
  const byMonth = new Map<string, Set<string>>();
  for (const row of rows) {
    for (const currency of rowCurrenciesNeedingConversion(row)) {
      const code = currency.toUpperCase();
      if (code === "KRW" || !/^[A-Z]{3}$/.test(code) ||
        Object.hasOwn(existingRates, `${row.period}:${code}`)) continue;
      const currencies = byMonth.get(row.period) || new Set<string>();
      currencies.add(code);
      byMonth.set(row.period, currencies);
    }
  }
  const months = [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b));
  const fresh: RevenueData["rates"] = {};
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(3, months.length) }, async () => {
    while (next < months.length) {
      const [month, currencies] = months[next++];
      const fetched = await fetchMonthRatesKrw(month, [...currencies], onIssue);
      for (const [key, rate] of Object.entries(fetched)) {
        // Recheck in case the caller added a manual rate while requests ran.
        if (!Object.hasOwn(existingRates, key)) fresh[key] = rate;
      }
    }
  }));
  return fresh;
}
