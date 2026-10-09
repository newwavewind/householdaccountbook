import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RevenueDashboard } from "./RevenueDashboard";
import { RevenueSummary } from "./RevenueSummary";
import { emptyData } from "./model";
import type { RevenueData, RevenueRow } from "./types";

function row(platform: RevenueRow["platform"], basis: RevenueRow["basis"], gross: number, proceeds: number | null): RevenueRow {
  return { id: `${platform}-${basis}`, reportKey: `${platform}-${basis}`, date: "2026-09-01", period: "2026-09", appId: `${platform}:example`, appName: "Example", platform, country: "KR", currency: "KRW", proceedsCurrency: "KRW", gross, refunds: 0, fee: null, tax: null, proceeds, units: 1, basis, taxClass: "unreviewed" };
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-08T10:00:00Z")); });
afterEach(() => vi.useRealTimers());
const noop = () => {};
const render = (data: RevenueData) => renderToStaticMarkup(createElement(RevenueDashboard, { data, busy: false, onMonth: noop, onPayouts: noop, onReports: noop }));

describe("revenue dashboard amount scope", () => {
  it("does not label a mixed partial subtotal as one store's confirmed income", () => {
    const data = emptyData();
    data.rows = [{ ...row("apple", "estimate", 100, 50), source: "apple-sales" }, { ...row("apple", "estimate", 100, null), id: "unknown" }, row("google", "settled", 100, 60)];
    const html = render(data);
    expect(html).toContain("확인액 ₩110");
    expect(html).not.toContain("Google Play 확정 ₩110");
  });
  it("distinguishes gross customer payments from sales after refunds", () => {
    const data = emptyData(); data.rows = [{ ...row("google", "estimate", 100, null), refunds: 30 }];
    const html = render(data);
    expect(html).toContain("환불 전");
    expect(html).toContain("환불 ₩30 · 차감 후 ₩70");
    expect(html).toContain("환불 차감 후 ₩70");
  });
  it("keeps one store's proceeds out of the combined monthly and cumulative totals", () => {
    const data = emptyData();
    data.rows = [row("apple", "estimate", 399200, null), row("google", "estimate", 140600, null), row("google", "settled", 140600, 94990)];
    const html = render(data);
    const september = html.split('<tr class="').find(part => part.includes('aria-controls="rd-stores-2026-09"'))?.split('</tr>')[0];
    expect(september).toContain("₩539,800");
    expect(september).toContain("집계 자료 확인");
    expect(september).toContain("App Store · 수익 자료 확인 필요");
    expect(september).toContain("Google Play 확정 ₩94,990");
    expect(html).toContain("확인된 수익 소계");
    expect(html).toContain('role="cell">₩140,600</span><span role="cell">₩94,990');
    expect(html).toContain("수익 자료 확인 필요");
    const summary = renderToStaticMarkup(createElement(RevenueSummary, { data, month: "2026-09", rows: data.rows, showPayouts: true, platform: "all", onBasis: noop, onPayouts: noop }));
    expect(summary).toContain("App Store 확정 자료 없음");
    expect(summary).not.toContain("₩94,990");
  });

  it("shows a total when the missing store's report is supplied", () => {
    const data = emptyData();
    data.rows = [row("apple", "estimate", 400, null), row("google", "estimate", 200, null), row("google", "settled", 200, 130), row("apple", "settled", 400, 260)];
    const html = render(data);
    expect(html).toContain('class="rd-total"><span>₩</span>390');
    expect(html).toContain("전체 확정 수익");
  });

  it("shows actual report estimates clearly and replaces them when final income arrives", () => {
    const data = emptyData();
    data.rows = [row("apple", "estimate", 399200, 290356), row("google", "estimate", 140600, null), row("google", "settled", 140600, 94990)];
    const estimate = render(data);
    expect(estimate).toContain('class="rd-total"><span>₩</span>385,346');
    expect(estimate).toContain("수익 합계 · 예상 포함");
    expect(estimate).toContain("스토어 제공 예상");
    data.rows.push(row("apple", "settled", 410000, 300000));
    const final = render(data);
    expect(final).toContain('class="rd-total"><span>₩</span>394,990');
    expect(final).toContain("전체 확정 수익");
    expect(final).not.toContain("스토어 제공 예상");
  });

  it("renders an explicitly reported zero as income for a Google-only account", () => {
    const data = emptyData();
    data.rows = [row("google", "settled", 0, 0)];
    const html = render(data);
    expect(html).toContain('class="rd-total"><span>₩</span>0');
    expect(html).not.toContain("App Store 자료 없음");
  });
});


describe("upcoming Google settlement", () => {
  const october = (proceeds: number | null): RevenueRow => ({ ...row("google", "estimate", 80000, proceeds), source: "google-sales", period: "2026-10", date: "2026-10-04" });
  it("explains the publication window without treating current sales as a collection failure", () => {
    const data = emptyData(); data.rows = [october(null)];
    const html = render(data);
    expect(html).toContain("정산 예정");
    expect(html).toContain("보통 11월 5일까지 공개");
    expect(html).toContain("판매액은 이미 집계됐어요");
    expect(html).not.toContain("Google Play 확인 필요");
    expect(html).not.toContain("집계 자료 확인");
  });
  it("shows real Google order proceeds as an estimate and replaces them with final proceeds", () => {
    const data = emptyData();
    data.rows = [{ ...october(54000), proceedsSource: "google-orders", proceedsFetchedAt: "2026-10-08T10:00:00Z" }];
    const html = render(data);
    expect(html).toContain('class="rd-total"><span>₩</span>54,000');
    expect(html).toContain("Google 주문 기준");
    expect(html).not.toContain("정산 예정");
    data.rows.push({ ...row("google", "settled", 80000, 53000), period: "2026-10", date: "2026-10-04" });
    expect(render(data)).toContain('class="rd-total"><span>₩</span>53,000');
  });
  it("keeps incomplete order lookups out of the full monthly amount", () => {
    const data = emptyData();
    data.rows = [{ ...october(54000), proceedsSource: "google-orders", proceedsFetchedAt: "2026-10-08T10:00:00Z" }, { ...october(null), id: "unresolved" }];
    const html = render(data);
    expect(html).toContain("확인된 수익 소계");
    expect(html).toContain("확인액 ₩54,000");
    expect(html).not.toContain("수익 합계 · 예상 포함");
  });
});
