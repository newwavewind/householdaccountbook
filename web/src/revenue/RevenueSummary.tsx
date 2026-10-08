import { money, monthLabel, platformName } from "./model";
import { summarizePeriodCoverage } from "./completeness";
import { selectRevenueRows } from "./reportSelection";
import { summarizeRevenueIncome } from "./revenueIncome";
import { getStoreIncomeStatus } from "./incomeStatus";
import type { Basis, Platform, RevenueData, RevenueRow } from "./types";

export function RevenueSummary({ data, month, rows, showPayouts, platform, onBasis, onPayouts }: {
  data: RevenueData; month: string; rows: RevenueRow[]; showPayouts: boolean;
  platform: Platform | "all"; onBasis: (basis: Basis) => void; onPayouts: () => void;
}) {
  const coverage = summarizePeriodCoverage(data, month, rows, platform === "all" ? undefined : [platform]);
  const { salesRows, settledRows, sales, settled } = coverage;
  const payouts = data.payouts.filter(p => p.receivedDate.startsWith(month) && (platform === "all" || p.platform === platform));
  const cards = [
    { label: "예상 판매액", number: "01", value: salesRows.length ? `₩${money(sales.gross)}` : "—",
      state: !salesRows.length ? "보고서 없음" : sales.missingGrossFx ? "일부 환율 확인 필요" : "수집된 판매 보고서 기준",
      note: "고객 결제액 · 수수료 공제 전 · 달력월", action: () => onBasis("estimate"), actionText: "판매 내역 보기", tone: "sales" },
    { label: "확정 수익", number: "02", value: coverage.completeSettled ? `₩${money(settled.proceeds)}` : "—",
      state: coverage.missingSettledPlatforms.length ? `${coverage.missingSettledPlatforms.map(p => platformName[p]).join(" · ")} 확정 자료 없음` : !settledRows.length ? "확정 보고서 없음" : !coverage.completeSettled ? "수익·환율 확인 필요" : "선택 범위의 확정 보고서 합계",
      note: "스토어 공제 후 · Apple 회계월 / Google 보고서월", action: () => onBasis("settled"), actionText: "수익 내역 보기", tone: "settled" },
    { label: "실제 입금", number: "03", value: showPayouts && payouts.length ? `₩${money(payouts.reduce((n,p) => n + p.received, 0))}` : "—",
      state: !showPayouts ? "전체 앱 선택 시 확인" : payouts.length ? "직접 기록한 입금액" : "입금 기록 없음",
      note: "선택한 달에 실제로 받은 금액 · 입금일 기준", action: onPayouts, actionText: "입금 기록하기", tone: "payout" },
  ];
  return <section className="rev-money-overview" aria-label={`${monthLabel(month)} 수익 요약`}>
    {cards.map(card => <article key={card.number} className={`rev-money-card ${card.tone}`}>
      <div className="rev-money-title"><h2>{card.label}</h2><span>{card.number}</span></div>
      <strong className="rev-money-value">{card.value}</strong>
      <span className="rev-money-state">{card.state}</span>
      <p>{card.note}</p>
      <button onClick={card.action}>{card.actionText}<span aria-hidden>↗</span></button>
    </article>)}
  </section>;
}

export function ReportCoverage({ data, month, onReports }: { data: RevenueData; month: string; onReports?: () => void }) {
  const income = summarizeRevenueIncome(data, month);
  return <section className="rev-coverage" aria-label="보고서 수집 현황">
    <div className="rev-coverage-heading"><div><h2>보고서 수집 현황</h2><p>연결 상태와 수집 결과는 다릅니다. 빈칸은 0원으로 계산하지 않습니다.</p></div>
      {onReports && <button onClick={onReports}>보고서 관리 ↗</button>}
    </div>
    <div className="rev-coverage-table" role="table" aria-label={`${monthLabel(month)} 스토어별 보고서`}>
      <div className="rev-coverage-row is-head" role="row"><span role="columnheader">스토어</span><span role="columnheader">예상 판매</span><span role="columnheader">확정 수익</span></div>
      {(["apple", "google"] as const).map(platform => <div className="rev-coverage-row" role="row" key={platform}>
        <strong role="rowheader">{platformName[platform]}</strong>
        {(["estimate", "settled"] as const).map(basis => {
          const selected = selectRevenueRows(data.rows.filter(r => r.platform === platform && r.period === month), basis);
          const rows = selected.rows;
          const keys = new Set(rows.map(r => r.reportKey));
          const imports = data.imports.filter(i => keys.has(i.key));
          const cached = imports.some(i => i.source === "cache");
          const dated = imports.filter(i => i.sourceUpdatedAt || i.fetchedAt).map(i => i.sourceUpdatedAt || i.fetchedAt || "").sort().at(-1);
          const status = getStoreIncomeStatus({ data, month, platform, income: income.perPlatform[platform] });
          const awaiting = !rows.length && basis === "settled" && (status.state === "settlement-pending" || (income.perPlatform[platform].basis === "estimate" && status.state === "ready"));
          return <div role="cell" key={basis}>
            <span className={`rev-coverage-state ${rows.length ? cached ? "cached" : "received" : awaiting ? "pending" : "missing"}`}>
              <i aria-hidden />{rows.length ? cached ? "보관본 반영" : "자료 있음" : awaiting ? "월 정산 전" : "보고서 없음"}
            </span>
            <small>{rows.length ? `${keys.size}개 보고서 · ${rows.length.toLocaleString()}행` : awaiting ? status.state === "ready" ? "스토어 제공 예상 수익은 대시보드에 반영했어요." : status.detail : "미수집 또는 미발행"}</small>
            {dated && <small>원본 확인 {new Date(dated).toLocaleDateString("ko-KR")}</small>}
            {platform === "apple" && basis === "settled" && rows.length > 0 && <small>{[...new Set(rows.map(r => `${r.date} ~ ${r.endDate || r.date}`))].sort().slice(0, 2).join(" · ")}</small>}
            {selected.excludedOverlapRows > 0 && <small>일별 중복 {selected.excludedOverlapRows}행 제외</small>}
          </div>;
        })}
      </div>)}
    </div>
    <p className="rev-coverage-note">예상 판매와 확정 수익은 서로 합산하지 않습니다. Apple 확정 보고서는 달력월과 다른 회계기간을 사용합니다.</p>
  </section>;
}
