import { useState } from "react";
import { money, summarize } from "./model";
import { summarizePeriodCoverage } from "./completeness";
import type { RevenueData, RevenueRow } from "./types";

export function RevenueChart({
  rows,
  data,
  month,
  mode,
  coverageRows = data.rows,
}: {
  rows: RevenueRow[];
  data: RevenueData;
  month: string;
  mode: "day" | "month";
  coverageRows?: RevenueRow[];
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const bases = new Set(rows.map((row) => row.basis));
  const mixedBasis = bases.size > 1;
  const basis = bases.size === 1 ? rows[0].basis : null;
  const [y, m] = month.split("-").map(Number);
  const count = mode === "day" ? new Date(y, m, 0).getDate() : 12;
  const points = Array.from({ length: count }, (_, i) => {
    const date =
      mode === "day"
        ? `${month}-${String(i + 1).padStart(2, "0")}`
        : `${y}-${String(i + 1).padStart(2, "0")}`;
    const values = rows.filter((r) =>
      mode === "day"
        ? r.date === date && (!r.endDate || r.endDate === r.date)
        : r.period === date,
    );
    const coverage = summarizePeriodCoverage(data, date.slice(0, 7), coverageRows);
    const totals = summarize(mixedBasis ? [] : values, data);
    const monthComplete = basis === "estimate" ? coverage.completeSales
      : basis === "settled" ? coverage.completeSettled : false;
    // Monthly Apple reports have no daily allocation. A day with only Google
    // detail must not become the entire business's daily income.
    const dayComplete = mode !== "day" || coverage.expectedPlatforms.every((platform) =>
      values.some((row) => row.platform === platform),
    );
    const sourceComplete = !mixedBasis && values.length > 0 && monthComplete && dayComplete;
    return {
      ...totals,
      salesKnown: sourceComplete && totals.missingGrossFx === 0,
      proceedsKnown: sourceComplete && totals.completeProceeds,
      label: `${i + 1}${mode === "day" ? "일" : "월"}`,
      count: values.length,
    };
  });
  const max = Math.max(
    ...points.flatMap((p) => [p.salesKnown ? p.gross : 0, p.proceedsKnown ? Math.abs(p.proceeds) : 0]),
    1,
  );
  const active = selected === null ? null : points[selected];
  return (
    <>
      <div className="rev-chart-summary" aria-live="polite">
        {active ? (
          <>
            <b>{active.label}</b>
            <span>매출 {active.salesKnown ? `₩${money(active.gross)}` : "미집계"}</span>
            <span>
              수익{" "}
              {!active.proceedsKnown ? "미집계" : `₩${money(active.proceeds)}`}
            </span>
            <small>{active.count ? `${active.count}건` : "보고서 없음"}</small>
          </>
        ) : (
          <span>{mixedBasis ? "예상·확정 자료가 섞여 있습니다. 하나의 보고서 기준을 선택해 주세요." : "막대를 선택하면 금액을 확인할 수 있어요. 누락 자료가 있는 기간은 미집계로 표시합니다."}</span>
        )}
      </div>
      <div
        className="rev-chart"
        role="group"
        aria-label={`${mode === "day" ? "일별" : "월별"} 매출 및 개발자 수익 차트`}
      >
        <div className="rev-chart-axis">
          <span>{money(max)}</span>
          <span>{money(max / 2)}</span>
          <span>0</span>
        </div>
        <div className="rev-chart-bars">
          {points.map((p, i) => (
            <button
              key={i}
              type="button"
              className={`rev-chart-column ${selected === i ? "is-selected" : ""}`}
              aria-label={`${p.label}, ${mixedBasis ? "보고서 기준 혼합 · 미집계" : p.count ? `매출 ${p.salesKnown ? money(p.gross) + "원" : "미집계"}, 수익 ${p.proceedsKnown ? money(p.proceeds) + "원" : "미집계"}` : "보고서 없음"}`}
              onClick={() => setSelected(i)}
            >
              <div className="rev-bar-pair">
                <span
                  className="rev-bar-sales"
                  style={{ height: `${(p.salesKnown ? Math.max(0, p.gross) / max : 0) * 100}%` }}
                />
                <span
                  className={`rev-bar-net ${p.proceedsKnown && p.proceeds < 0 ? "is-negative" : ""}`}
                  style={{ height: `${(p.proceedsKnown ? Math.abs(p.proceeds) / max : 0) * 100}%` }}
                />
              </div>
              <span className="rev-bar-label">
                {mode === "month" || i % 5 === 0 || i === count - 1
                  ? i + 1
                  : ""}
              </span>
            </button>
          ))}
        </div>
      </div>
      <p className="rev-caption">
        {mode === "day"
          ? "보고서에 기록된 거래일 기준 · 월 단위 Apple 확정 자료는 월별에서 확인"
          : "Apple 확정 보고서는 Apple 회계월 기준"}{" "}
        · 자료가 없는 스토어·기간은 합계를 표시하지 않습니다. 보고서 수익과 실제 입금은 별도입니다. 음수 수익은 붉은 막대로 표시
      </p>
    </>
  );
}
