import { isAppleMonthly, reportSource, selectRevenueRows } from "./reportSelection";
import type { RevenueData, RevenueRow } from "./types";

const nextDay = (date: string) => new Date(Date.parse(`${date}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);

/** Bridge a closed Apple fiscal period with the next open period's actual
 * sales reports. Keep each row's calendar month for sales totals and FX. Never
 * prorate a monthly report across a fiscal boundary. */
export function selectOpenAppleIncome(data: RevenueData, month: string, rows: RevenueRow[], fallback: RevenueRow[]) {
  const previousMonth = new Date(Date.parse(`${month}-01T00:00:00Z`) - 86400000).toISOString().slice(0, 7);
  const previous = rows.filter(row => row.platform === "apple" && row.basis === "settled" &&
    reportSource(row) === "apple-finance" && row.period === previousMonth && row.endDate);
  const closedThrough = previous.map(row => row.endDate!).sort().at(-1);
  const monthEnd = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 0)).toISOString().slice(0, 10);
  const bridge = !!closedThrough && closedThrough >= `${previousMonth}-01` && closedThrough < monthEnd;
  const start = bridge ? nextDay(closedThrough!) : `${month}-01`;
  const shifted = start !== `${month}-01`;
  if (!bridge && !fallback.some(row => reportSource(row) === "apple-sales"))
    return { rows: fallback, missingDates: [] as string[], shifted: false };
  // Filter before monthly/daily selection: an overlapping prior-month monthly
  // aggregate cannot suppress the daily tail that lies outside the final report.
  const selected = !bridge ? fallback : selectRevenueRows(rows.filter(row => row.platform === "apple" &&
    row.basis === "estimate" && reportSource(row) === "apple-sales" && row.date >= start &&
    (row.endDate || row.date) <= monthEnd), "estimate").rows;
  const covered = new Set<string>();
  for (const row of selected) {
    for (let date = row.date; date <= (row.endDate || row.date); date = nextDay(date)) covered.add(date);
  }
  // Successfully imported empty daily reports also establish coverage; a 404
  // never does. Nothing in this calculation manufactures a zero-revenue day.
  for (const entry of data.imports) {
    const match = /^apple-sales:(\d{4}-\d{2}-\d{2})$/.exec(entry.key);
    if (match && match[1] >= start && match[1] <= monthEnd) covered.add(match[1]);
  }
  const through = [...covered, ...fallback.map(row => row.endDate || row.date)].sort().at(-1);
  const missingDates: string[] = [];
  if (through) for (let date = start; date <= through && date <= monthEnd; date = nextDay(date)) {
    if (!covered.has(date)) missingDates.push(date);
  }
  return { rows: selected, missingDates, shifted, start, through,
    includesPreviousMonth: selected.some(row => row.period < month),
    usesDailyReports: selected.some(row => !isAppleMonthly(row)),
  };
}
