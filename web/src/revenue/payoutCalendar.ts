import { summarize } from "./model";
import type { Platform, RevenueData } from "./types";

export type PayoutCalendarEvent = {
  id: string;
  date: string;
  title: string;
  platform: Platform;
  amount: number;
  kind: "expected" | "received" | "estimated";
  month: string;
};

function estimatePayoutDate(platform: Platform, salesMonth: string): string {
  const [y, m] = salesMonth.split("-").map(Number);
  if (platform === "apple") {
    return new Date(Date.UTC(y, m - 1 + 2, 5)).toISOString().slice(0, 10);
  }
  return new Date(Date.UTC(y, m, 15)).toISOString().slice(0, 10);
}

export function buildPayoutCalendar(data: RevenueData, from: string, to: string): PayoutCalendarEvent[] {
  const events: PayoutCalendarEvent[] = [];
  for (const p of data.payouts) {
    if (p.dueDate < from || p.dueDate > to) continue;
    events.push({
      id: `payout:${p.id}`,
      date: p.dueDate,
      title: `${p.month} 정산`,
      platform: p.platform,
      amount: p.received || p.expected,
      kind: p.received ? "received" : "expected",
      month: p.month,
    });
  }
  const months = new Set(data.rows.map((r) => r.period));
  for (const salesMonth of months) {
    for (const platform of ["apple", "google"] as const) {
      const rows = data.rows.filter((r) => r.period === salesMonth && r.platform === platform);
      if (!rows.length) continue;
      const total = summarize(rows, data);
      const amount = total.proceeds || total.gross;
      if (amount <= 0) continue;
      const date = estimatePayoutDate(platform, salesMonth);
      if (date < from || date > to) continue;
      if (events.some((e) => e.platform === platform && e.month === salesMonth)) continue;
      events.push({
        id: `est:${platform}:${salesMonth}`,
        date,
        title: `${salesMonth} 예상 입금`,
        platform,
        amount,
        kind: "estimated",
        month: salesMonth,
      });
    }
  }
  return events.sort((a, b) => a.date.localeCompare(b.date));
}

export function upcomingInDays(events: PayoutCalendarEvent[], days = 14) {
  const start = new Date().toISOString().slice(0, 10);
  const end = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
  return events.filter((e) => e.date >= start && e.date <= end);
}
