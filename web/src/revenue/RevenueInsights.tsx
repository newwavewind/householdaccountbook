import { money, monthLabel, platformName } from "./model";
import { detectAnomalies, type Anomaly } from "./anomalies";
import {
  buildMonthCloseChecklist,
  monthCloseProgress,
} from "./monthClose";
import {
  buildPayoutCalendar,
  upcomingInDays,
} from "./payoutCalendar";
import type { ConnectorStatus, RevenueData } from "./types";

type Props = {
  data: RevenueData;
  month: string;
  connection: ConnectorStatus | null;
  onDismissAlert: (id: string) => void;
  onToggleCloseItem: (id: string, done: boolean) => void;
  compact?: boolean;
};

export function RevenueInsights({
  data,
  month,
  connection,
  onDismissAlert,
  onToggleCloseItem,
  compact,
}: Props) {
  const dismissed = data.meta?.dismissedAlerts ?? [];
  const anomalies = detectAnomalies(data, month, connection, dismissed);
  const closeItems = buildMonthCloseChecklist(
    data,
    month,
    connection,
    data.logs[0],
  );
  const close = monthCloseProgress(closeItems);
  const from = new Date().toISOString().slice(0, 10);
  const to = new Date(Date.now() + 45 * 86400000).toISOString().slice(0, 10);
  const cal = buildPayoutCalendar(data, from, to);
  const upcoming = upcomingInDays(cal, 14);

  return (
    <div className={`rev-insights ${compact ? "is-compact" : ""}`}>
      {data.meta?.lastCloudAt ? (
        <p className="rev-insights-cloud">
          클라우드 저장 · {new Date(data.meta.lastCloudAt).toLocaleString("ko-KR")}
        </p>
      ) : null}
      {anomalies.length ? (
        <section className="rev-card rev-insights-alerts">
          <h3>이상·누락 알림</h3>
          <ul>
            {anomalies.map((a: Anomaly) => (
              <li key={a.id} className={`sev-${a.severity}`}>
                <div>
                  <b>{a.title}</b>
                  <p>{a.body}</p>
                </div>
                <button type="button" onClick={() => onDismissAlert(a.id)}>
                  닫기
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section className="rev-card rev-insights-close">
        <h3>{monthLabel(month)} 마감 체크</h3>
        <div className="rev-insights-progress">
          <span>{close.done}/{close.total}</span>
          <div className="rev-goal-bar">
            <span style={{ width: `${close.pct}%` }} />
          </div>
        </div>
        <ul className="rev-insights-checklist">
          {closeItems.map((item) => (
            <li key={item.id}>
              <label>
                <input
                  type="checkbox"
                  checked={item.done}
                  disabled={item.auto}
                  onChange={(e) => onToggleCloseItem(item.id, e.target.checked)}
                />
                {item.label}
                {item.hint ? <small>{item.hint}</small> : null}
              </label>
            </li>
          ))}
        </ul>
      </section>
      {!compact && upcoming.length ? (
        <section className="rev-card rev-insights-cal">
          <h3>입금 캘린더 · 14일</h3>
          <ul>
            {upcoming.map((e) => (
              <li key={e.id}>
                <time>{e.date}</time>
                <span>{platformName[e.platform]}</span>
                <b>{e.title}</b>
                <strong>₩{money(e.amount)}</strong>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
