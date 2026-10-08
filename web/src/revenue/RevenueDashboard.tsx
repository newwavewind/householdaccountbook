import { Fragment, useState } from "react";
import { currentMonth, money, monthLabel, platformName } from "./model";
import { summarizePeriodCoverage, summarizeRangeCoverage } from "./completeness";
import { summarizeRevenueIncome, summarizeRevenueIncomeRange } from "./revenueIncome";
import { getStoreIncomeStatus } from "./incomeStatus";
import type { Basis, RevenueData } from "./types";

const cash = (value: number) => `₩${money(value)}`;
export function RevenueDashboard({ data, busy, onMonth, onPayouts, onReports }: {
  data: RevenueData; busy: boolean; onMonth: (month: string, basis: Basis) => void;
  onPayouts: () => void; onReports: () => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const [expandedMonth, setExpandedMonth] = useState<string | null | undefined>();
  const received = data.payouts.filter(p => p.receivedDate);
  const months = [...new Set(data.rows.map(r => r.period))].sort().reverse();
  const coverage = summarizeRangeCoverage(data, months);
  const { sales, salesRows } = coverage;
  const incomeRange = summarizeRevenueIncomeRange(data, months);
  const incomeAmount = incomeRange.total ?? incomeRange.partialSum;
  const confirmedMonths = coverage.months.filter(p => p.completeSettled).length;
  const incomeStatuses = new Map(incomeRange.months.map(period => [period.month,
    period.unknownPlatforms.map(platform => ({ platform, ...getStoreIncomeStatus({ data, month: period.month, platform, income: period.perPlatform[platform] }) })),
  ]));
  const waitingMonths = incomeRange.months.filter(period => {
    const statuses = incomeStatuses.get(period.month) || [];
    return statuses.length > 0 && statuses.every(status => status.state === "settlement-pending");
  });
  const issueMonths = incomeRange.months.filter(period => (incomeStatuses.get(period.month) || []).some(status => status.actionRequired));
  const latestWaiting = waitingMonths[0];
  const allMonths = [...new Set([currentMonth(), ...months, ...received.map(p => p.receivedDate.slice(0, 7))])].sort().reverse();
  const periods = allMonths.map(month => summarizePeriodCoverage(data, month));
  const detailMonth = expandedMonth === undefined
    ? periods.find(p => p.month < currentMonth() && p.salesRows.length)?.month
    : expandedMonth;
  const series = periods.slice(0, 8).reverse().map(p => ({ month: p.month, value: p.sales.gross, known: p.completeSales }));
  const max = Math.max(...series.filter(p => p.known).map(p => Math.abs(p.value)), 1);
  const imported = data.imports.filter(i => i.source === "cache").length;
  const lastSuccess = data.logs.find(l => l.status === "success" && (l.detail?.documents ?? 0) > 0);
  return <div className="rd-dashboard">
    <section className="rd-hero" aria-label="전체 기간 수익">
      <div className="rd-hero-copy">
        <div className="rd-hero-eyebrow"><i />수익 개요 <span>전체 기간</span></div>
        <h2>{incomeRange.total === null ? "확인된 수익 소계" : incomeRange.hasEstimates ? "수익 합계 · 예상 포함" : "전체 확정 수익"}</h2>
        <div className="rd-total">{data.rows.length && incomeAmount !== null ? <><span>₩</span>{money(incomeAmount)}</> : <span className="rd-pending">{incomeRange.hasOverlappingPeriods ? "보고서 기간 확인 필요" : "첫 수익을 확인해 보세요"}</span>}</div>
        <p>{data.rows.length ? `${confirmedMonths}개월 확정${incomeRange.hasEstimates ? " · 스토어 제공 예상 수익 포함" : ""}${waitingMonths.length ? ` · ${waitingMonths.length}개월 정산 예정` : ""}${issueMonths.length ? ` · ${issueMonths.length}개월 자료 확인` : ""}` : "한 번 연결하고, 버튼 한 번으로 모든 월을 모으세요."}</p>
        {data.rows.length > 0 && <div className="rd-income-status">
          <span className="rd-income-badge">{incomeRange.hasEstimates ? "예상 포함" : "확정 보고서"}</span>
          <span>{incomeRange.hasOverlappingPeriods ? "회계월과 달력월이 겹쳐 누적 합산을 보류했어요." : incomeRange.total === null ? waitingMonths.length && !issueMonths.length ? "정산 전인 Google Play 수익은 다음 달 보고서를 가져오면 더해져요." : "아직 수익을 확인하지 못한 스토어 금액은 이 소계에서 제외했어요." : "확정 보고서가 들어오면 예상 금액을 자동으로 대체해요."}</span>
        </div>}
        <div className="rd-hero-foot"><span>실제 입금액은 별도로 확인하세요.</span><button onClick={onReports}>수집 현황 ↗</button></div>
      </div>
      <div className="rd-mini-chart" aria-label="최근 월별 판매액 흐름">
        <div className="rd-chart-caption"><span>월별 판매액</span><span>수수료 공제 전</span></div>
        <div className="rd-mini-bars">{series.map(p => <button key={p.month} onClick={() => onMonth(p.month, "estimate")} aria-label={`${monthLabel(p.month)}, ${p.known ? cash(p.value) : "판매액 미집계"}`}><div><i className={!p.known ? "is-empty" : p.value < 0 ? "is-negative" : ""} style={{ height: p.known ? `${Math.max(3, Math.abs(p.value) / max * 100)}%` : "3px" }} /></div><span>{Number(p.month.slice(5))}월</span></button>)}</div>
        <p className="rd-chart-note">자료·환율이 확인된 월만 표시합니다.</p>
      </div>
    </section>
    <section className="rd-metrics" aria-label="전체 기간 금액 구분">
      <article><div><span className="rd-metric-icon">↗</span><span>{coverage.completeSales ? "전체 판매액" : "확인된 판매액"}</span><span className="rd-mini-tag">예상</span></div><strong>{salesRows.length ? cash(sales.gross) : "—"}</strong><p>{!coverage.completeSales ? "수집 자료 중 환산 가능한 판매액 소계" : "고객 결제액 · 수수료 공제 전"}</p></article>
      <article><div><span className="rd-metric-icon">↙</span><span>실제로 받은 금액</span></div><strong>{received.length ? cash(received.reduce((n,p) => n + p.received, 0)) : "—"}</strong><button onClick={onPayouts}>{received.length ? "입금 내역 확인" : "입금 기록 추가"} <span>→</span></button></article>
      <article><div><span className="rd-metric-icon">▤</span><span>모아 둔 보고서</span></div><strong>{data.imports.length}<small>개</small></strong><p>{imported ? `보관본 ${imported}개 포함 · 최신 여부 확인 필요` : lastSuccess ? `최근 완료 ${new Date(lastSuccess.at).toLocaleDateString("ko-KR")}` : busy ? "스토어에서 가져오는 중" : "아래에서 월별로 확인하세요"}</p></article>
    </section>
    <section className="rd-months" aria-label="월별 실적">
      <div className="rd-section-title"><div><span>YOUR PERFORMANCE</span><h2>월별 실적</h2></div><span className="rd-count">{months.length}개월 수집</span></div>
      <p className="rd-coverage-explainer">확정 수익을 우선 표시하고, 정산 전에는 스토어가 제공한 예상 수익을 보여드려요. 스토어별로 금액과 보고서 기간을 확인할 수 있습니다.</p>
      {latestWaiting && <div className="rd-settlement-note" role="note">
        <span className="rd-settlement-mark" aria-hidden>◷</span>
        <div><strong>{Number(latestWaiting.month.slice(5))}월은 정산 전이에요</strong>
          <p>{summarizePeriodCoverage(data, latestWaiting.month).completeSales ? "판매액은 이미 집계됐어요. " : "판매 보고서에 있는 금액부터 반영하고 있어요. "}{(incomeStatuses.get(latestWaiting.month) || []).map(status => `${platformName[status.platform]}: ${status.detail}`).join(" ")}</p>
          <small>공개 후 ‘전체 수익 가져오기’를 누르면 확정 수익에 반영됩니다.</small></div>
      </div>}
      <div className="rd-table-wrap"><table><thead><tr><th>기간</th><th>판매액 <small>예상</small></th><th>보고서 기준 수익</th><th>실제 입금</th><th><span className="rev-sr-only">스토어별 내역</span></th></tr></thead><tbody>
        {(showAll ? periods : periods.slice(0, 6)).map(p => {
          const { month, sales: s, salesRows: sRows, settledRows: fRows } = p;
          const income = summarizeRevenueIncome(data, month);
          const paid = received.filter(item => item.receivedDate.startsWith(month));
          const keys = new Set([...sRows, ...fRows].map(r => r.reportKey));
          const cached = data.imports.some(i => keys.has(i.key) && i.source === "cache");
          const open = detailMonth === month;
          const statuses = income.unknownPlatforms.map(platform => ({ platform, ...getStoreIncomeStatus({ data, month, platform, income: income.perPlatform[platform] }) }));
          const waiting = statuses.length > 0 && statuses.every(status => status.state === "settlement-pending");
          const known = income.expectedPlatforms.filter(platform => income.perPlatform[platform].value !== null);
          const knownLabel = known.length === 1 ? `${platformName[known[0]]} ${income.perPlatform[known[0]].basis === "estimate" ? "예상" : "확정"}` : "확인액";
          return <Fragment key={month}>
            <tr className={open ? "rd-month-open" : ""}><th><button onClick={() => setExpandedMonth(open ? null : month)} aria-expanded={open} aria-controls={`rd-stores-${month}`}><b>{Number(month.slice(5))}월</b><span>{month.slice(0,4)}</span></button></th>
              <td><button onClick={() => onMonth(month, "estimate")}>{sRows.length ? cash(s.gross) : "—"}{!p.completeSales && sRows.length > 0 && <small>일부 판매액</small>}</button></td>
              <td className="rd-net"><button onClick={() => setExpandedMonth(open ? null : month)} aria-expanded={open} aria-controls={`rd-stores-${month}`}>{income.total !== null ? cash(income.total) : <span className={waiting ? "rd-pending-label" : ""}>{waiting ? "정산 예정" : "집계 자료 확인"}</span>}<small>{income.total !== null ? <span className="rd-income-badge">{income.hasEstimates ? "예상 포함" : "확정"}</span> : statuses.map(status => <span className="rd-income-reason" key={status.platform}>{platformName[status.platform]} · {status.state === "settlement-pending" ? `보통 ${Number(status.expectedBy?.slice(5, 7))}월 5일까지 공개` : status.label}</span>)}</small>{income.total === null && income.partialSum !== 0 && <small>{knownLabel} {cash(income.partialSum)}</small>}</button></td>
              <td>{paid.length ? cash(paid.reduce((n,item) => n + item.received, 0)) : "—"}</td>
              <td><button className="rd-store-toggle" onClick={() => setExpandedMonth(open ? null : month)} aria-label={`${monthLabel(month)} 스토어별 내역 ${open ? "닫기" : "보기"}`} aria-expanded={open} aria-controls={`rd-stores-${month}`}>스토어별 <span aria-hidden>{open ? "−" : "+"}</span></button></td>
            </tr>
            <tr id={`rd-stores-${month}`} className="rd-store-detail" hidden={!open}><td colSpan={5}>
              <div className="rd-store-detail-inner">
                <div className="rd-store-detail-heading"><strong>{monthLabel(month)} 금액 구성</strong>{cached && <span>보관본 포함</span>}</div>
                <div className="rd-store-grid" role="table" aria-label={`${monthLabel(month)} 스토어별 금액`}>
                  <div className="rd-store-grid-row is-head" role="row"><span role="columnheader">스토어</span><span role="columnheader">판매액</span><span role="columnheader">수익</span></div>
                  {p.expectedPlatforms.map(platform => {
                    const store = p.perPlatform[platform], storeIncome = income.perPlatform[platform];
                    const status = getStoreIncomeStatus({ data, month, platform, income: storeIncome });
                    const reportPeriod = storeIncome.periodRanges.map(range => `${range.start.slice(5).replace("-", ".")}–${range.end.slice(5).replace("-", ".")}`).join(", ");
                    return <div className="rd-store-grid-row" role="row" key={platform}><strong role="rowheader">{platformName[platform]}<small>{storeIncome.periodKind === "fiscal" ? "회계기간 " : "판매기간 "}{reportPeriod || "자료 확인 중"}</small></strong><span role="cell">{store.hasSales ? cash(store.sales.gross) : "보고서 대기"}{store.hasSales && !store.completeSales && <small>일부 판매액</small>}</span><span role="cell">{storeIncome.value !== null ? cash(storeIncome.value) : <span className={status.state === "settlement-pending" ? "rd-pending-label" : ""}>{status.label}</span>}<small>{storeIncome.value !== null ? <span className="rd-income-badge">{status.label}</span> : status.detail}</small></span></div>;
                  })}
                </div>
                <p>{income.hasEstimates ? "예상 수익은 Apple 판매 보고서와 Google 주문 조회에서 스토어가 제공한 금액입니다. 월 정산 시 환불·조정에 따라 달라질 수 있습니다. " : ""}{income.total === null ? "확인되지 않은 스토어 금액은 0원으로 합산하지 않습니다. " : ""}Apple 회계기간은 달력월과 달라 판매액과 수익의 집계 기간이 다를 수 있습니다.</p>
                <div className="rd-detail-actions"><button onClick={() => onMonth(month, "estimate")}>판매 원본 내역 ↗</button><button onClick={() => onMonth(month, "settled")}>확정 보고서 내역 ↗</button></div>
              </div>
            </td></tr>
          </Fragment>;
        })}
      </tbody></table></div>
      {allMonths.length > 6 && <button className="rd-show-all" onClick={() => setShowAll(!showAll)}>{showAll ? "최근 6개월만 보기" : `${allMonths.length}개월 모두 보기`} <span>{showAll ? "↑" : "↓"}</span></button>}
      <div className="rd-table-note"><span>— 는 기록 없음입니다. 판매액·확정 수익·입금액은 서로 더하지 않습니다.</span><button onClick={onReports}>보고서 수집 현황 ↗</button></div>
    </section>
    <div className="rd-bottom-note"><span>판매는 달력월, Apple 확정 수익은 회계월, 실제 입금은 입금일을 기준으로 표시합니다.</span><span>판매부터 입금까지, 한눈에.</span></div>
  </div>;
}
