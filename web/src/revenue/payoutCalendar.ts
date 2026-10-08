import { summarize, validDate } from "./model";
import type { Platform, RevenueData } from "./types";

export type PayoutCalendarEvent = {
  id: string;
  date: string;
  title: string;
  platform: Platform;
  amount: number | null;
  note: string;
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
    const received = validDate(p.receivedDate);
    const date = received ? p.receivedDate : p.dueDate;
    if (date < from || date > to) continue;
    events.push({
      id: `payout:${p.id}`,
      date,
      title: `${p.month} ${received ? "실제 입금" : "등록한 입금 예정"}`,
      platform: p.platform,
      amount: received ? p.received : p.expected,
      note: received ? "기록한 실제 입금액" : "등록한 지급 예정일·예정액",
      kind: received ? "received" : "expected",
      month: p.month,
    });
  }
  const months = new Set(data.rows.map((r) => r.period));
  for (const salesMonth of months) {
    for (const platform of ["apple", "google"] as const) {
      const rows = data.rows.filter((r) => r.period === salesMonth && r.platform === platform);
      if (!rows.length) continue;
      const settled = rows.filter((row) => row.basis === "settled");
      const total = summarize(settled, data);
      const amount = settled.length > 0 && total.completeProceeds ? total.proceeds : null;
      const date = estimatePayoutDate(platform, salesMonth);
      if (date < from || date > to) continue;
      // A recorded payout owns this period even when its actual date is
      // outside the requested calendar range. Never invent a second payment.
      if (data.payouts.some((p) => p.platform === platform && p.month === salesMonth)) continue;
      events.push({
        id: `est:${platform}:${salesMonth}`,
        date,
        title: `${salesMonth} ${amount === null ? "확정 수익 미집계" : "보고서 기준 참고 금액"}`,
        platform,
        amount,
        note: amount === null
          ? "확정 보고서·수익 환율 확인 필요 · 참고 일정"
          : "참고 일정 · 지급 조건·환전·조정에 따라 실제 입금일과 금액이 달라집니다.",
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
