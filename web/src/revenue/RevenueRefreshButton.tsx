import { RevenueIcon } from "./RevenueIcon";
import type { ConnectorHealth } from "./syncHelpers";

export function RevenueRefreshButton({allowed,busy,blocked,health,onRefresh,onRetry}: {
  allowed:boolean; busy:boolean; blocked:boolean; health:ConnectorHealth; onRefresh:()=>void; onRetry:()=>void;
}) {
  if(!allowed) return null;
  return <button type="button" className="rev-button rev-button-primary"
    disabled={busy || blocked || health === "checking"}
    onClick={health === "offline" ? onRetry : onRefresh}>
    <RevenueIcon name="sync" size={17} />
    {busy ? "자료 가져오는 중…" : health === "checking" ? "연결 확인 중…" : health === "offline" ? "연결 다시 확인" : "자료 새로고침"}
  </button>;
}
