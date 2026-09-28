import { useState } from "react";
import { money, summarize } from "./model";
import type { RevenueData, RevenueRow } from "./types";

export function RevenueChart({
  rows,
  data,
  month,
  mode,
}: {
  rows: RevenueRow[];
  data: RevenueData;
  month: string;
  mode: "day" | "month";
}) {
  const [selected, setSelected] = useState<number | null>(null);
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
    return {
      ...summarize(values, data),
      label: `${i + 1}${mode === "day" ? "일" : "월"}`,
      count: values.length,
    };
  });
  const max = Math.max(
    ...points.flatMap((p) => [p.gross, Math.abs(p.proceeds)]),
    1,
  );
  const active = selected === null ? null : points[selected];
  return (
    <>
      <div className="rev-chart-summary" aria-live="polite">
        {active ? (
          <>
            <b>{active.label}</b>
            <span>매출 ₩{money(active.gross)}</span>
            <span>
              수익{" "}
              {active.unknownProceeds ? "미제공" : `₩${money(active.proceeds)}`}
            </span>
            <small>{active.count ? `${active.count}건` : "보고서 없음"}</small>
          </>
        ) : (
          <span>막대를 선택하면 금액을 확인할 수 있어요.</span>
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
              aria-label={`${p.label}, ${p.count ? `매출 ${money(p.gross)}원, 수익 ${p.unknownProceeds ? "미제공" : money(p.proceeds) + "원"}` : "보고서 없음"}`}
              onClick={() => setSelected(i)}
            >
              <div className="rev-bar-pair">
                <span
                  className="rev-bar-sales"
                  style={{ height: `${(Math.max(0, p.gross) / max) * 100}%` }}
                />
                <span
                  className={`rev-bar-net ${p.proceeds < 0 ? "is-negative" : ""}`}
                  style={{ height: `${(Math.abs(p.proceeds) / max) * 100}%` }}
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
        · 음수 수익은 붉은 막대로 표시
      </p>
    </>
  );
}
