import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useCommunityAuth } from "../community/CommunityAuthContext";
import { RevenueIcon as Icon } from "../revenue/RevenueIcon";
import { RevenueDialog, DataForm } from "../revenue/RevenueDialog";
import { fieldNumber, fieldText } from "../revenue/formValues";
import { RevenueChart } from "../revenue/RevenueChart";
import {
  amounts,
  appProfit,
  countPaidSales,
  storeTake,
  csvString,
  currentMonth,
  download,
  exportRows,
  localDate,
  money,
  monthLabel,
  neededCurrencies,
  platformName,
  shiftMonth,
  summarize,
  taxLabels,
  taxWorksheet,
  yearOverYear,
} from "../revenue/model";
import { fetchMonthRatesKrw } from "../revenue/fxRates";
import {
  preferNewer,
  pullRevenueSnapshot,
  pushRevenueSnapshot,
} from "../revenue/cloudStore";
import {
  csvTemplate,
  mergeReports,
  parseReport,
  readReportFile,
} from "../revenue/imports";
import { demoData } from "../revenue/demo";
import { useRevenueData, validateBackup } from "../revenue/storage";
import type {
  AppProduct,
  Basis,
  ConnectorStatus,
  Platform,
  RevenueData,
  RevenueRow,
  StoreDocument,
  SyncResult,
  TaxClass,
} from "../revenue/types";
import {
  formatSyncToast,
  markAutoSynced,
  shouldAutoSync,
  syncLogStatus,
  type ConnectorHealth,
} from "../revenue/syncHelpers";
import {
  isRevenueCloudMode,
  revenueFetch,
} from "../revenue/connectorClient";
import { RevenueInsights } from "../revenue/RevenueInsights";
import { rowMatchesGroup, suggestAppGroups } from "../revenue/appGroups";
import { googleSetupSteps } from "../revenue/googleSetup";
import { fillGoogleEstimatedShares } from "../revenue/googleFee";
import {
  enrichRowsWithApps,
  rowsForApp,
} from "../revenue/appMatch";
import {
  looksLikePackageName,
  withResolvedAppNames,
} from "../revenue/appDisplayNames";
import {
  applyTaxSuggestions,
  exportTaxPackCsv,
} from "../revenue/taxEnhance";
import "../revenue/revenue.css";

type Section =
  "overview" | "apps" | "transactions" | "payouts" | "tax" | "connections";
type Dialog =
  "app" | "expense" | "payout" | "goal" | "rates" | "business" | null;
type Connection = ConnectorStatus & {
  settings: { vendor: string; bucket: string; packages: string[] };
};
const sections: { id: Section; label: string; icon: string }[] = [
  { id: "overview", label: "한눈에 보기", icon: "chart" },
  { id: "apps", label: "내 앱", icon: "apps" },
  { id: "transactions", label: "매출 내역", icon: "receipt" },
  { id: "payouts", label: "정산·비용", icon: "wallet" },
  { id: "tax", label: "부가세", icon: "shield" },
  { id: "connections", label: "연결 관리", icon: "link" },
];
const statusNames: Record<string, string> = {
  READY_FOR_SALE: "배포 중",
  READY_FOR_DISTRIBUTION: "배포 중",
  WAITING_FOR_REVIEW: "심사 대기",
  IN_REVIEW: "심사 중",
  PREPARE_FOR_SUBMISSION: "제출 준비",
  REJECTED: "심사 거절",
  PENDING_DEVELOPER_RELEASE: "출시 대기",
  PROCESSING_FOR_APP_STORE: "처리 중",
  DEVELOPER_REMOVED_FROM_SALE: "판매 중지",
};
const appStatus = (value: string) =>
  statusNames[value] ||
  value
    .replace("completed", "배포 완료")
    .replace("inProgress", "단계적 출시")
    .replace("draft", "초안")
    .replace("halted", "중단");

function Action({
  children,
  icon,
  onClick,
  primary,
  disabled,
}: {
  children: ReactNode;
  icon?: string;
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`rev-button ${primary ? "rev-button-primary" : ""}`}
      onClick={onClick}
      disabled={disabled}
    >
      {icon && <Icon name={icon} size={17} />}
      {children}
    </button>
  );
}
function Empty({
  title,
  text,
  children,
}: {
  title: string;
  text: string;
  children?: ReactNode;
}) {
  return (
    <div className="rev-empty">
      <span className="rev-empty-icon">
        <Icon name="chart" size={27} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      {children}
    </div>
  );
}
function PlatformMark({ platform }: { platform: Platform }) {
  return (
    <span
      className={`rev-platform-mark ${platform}`}
      aria-label={platformName[platform]}
    >
      {platform === "apple" ? (
        <svg
          width="18"
          height="19"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden
        >
          <path d="M16.1 2c.1 1.4-.5 2.6-1.3 3.4-.9.8-2 1.3-3.2 1.2-.2-1.3.5-2.6 1.3-3.4.9-.8 2.1-1.3 3.2-1.2ZM19.7 17.1c-.5 1.2-.8 1.8-1.5 2.9-.9 1.3-2.1 2.8-3.6 2.8-1.4 0-1.8-.9-3.7-.9-1.8 0-2.3.9-3.7.9-1.5 0-2.6-1.4-3.5-2.7-2.5-3.7-2.8-8-.9-10.3 1.3-1.6 3.3-2.5 5.2-2.5 1.6 0 2.6.9 3.9.9 1.2 0 2-.9 3.9-.9 1.7 0 3.3.9 4.3 2.2-3.8 2-3.2 7.1-.4 7.6Z" />
        </svg>
      ) : (
        <svg width="18" height="19" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="m5 3 14 9-14 9V3Z" fill="currentColor" />
          <path d="m5 3 9 12M5 21l9-12" stroke="white" strokeWidth="1.3" />
        </svg>
      )}
    </span>
  );
}
const connector = revenueFetch;


function platformProceedsLabel(
  platform: Platform,
  total: ReturnType<typeof summarize>,
  rows: RevenueRow[],
  basis: Basis,
) {
  const platformRows = rows.filter((r) => r.platform === platform);
  if (!platformRows.length) return { value: "—", note: "보고서 없음" };
  if (
    total.unknownProceeds &&
    !platformRows.some((r) => r.proceeds !== null)
  ) {
    if (basis === "estimate" && total.gross > 0) {
      return {
        value: `₩${money(total.gross)}`,
        note: "예상 매출 · Play 수수료 추정 전",
      };
    }
    return {
      value: "수익 미제공",
      note: basis === "estimate" ? "예상 매출 · 확정 시 수익 표시" : "확정 수익 보고서 필요",
    };
  }
  const googleEstimate = platform === "google" && basis === "estimate";
  return {
    value: `₩${money(total.proceeds)}`,
    note: googleEstimate
      ? "추정 · Play 수수료 30%"
      : basis === "estimate"
        ? "추정"
        : "확정",
  };
}

export default function AppRevenuePage() {
  const { user } = useCommunityAuth();
  return (
    <RevenueWorkspace key={user?.id || "device"} owner={user?.id || "device"} />
  );
}

function RevenueWorkspace({ owner }: { owner: string }) {
  const store = useRevenueData(owner);
  const [demo, setDemo] = useState(false),
    [sample, setSample] = useState<RevenueData | null>(null);
  const data = demo && sample ? sample : store.data;
  function update(next: RevenueData | ((prev: RevenueData) => RevenueData)) {
    if (demo)
      setSample((prev) =>
        typeof next === "function"
          ? next(prev || demoData(currentMonth()))
          : next,
      );
    else store.update(next);
  }
  const [section, setSection] = useState<Section>("overview"),
    [month, setMonth] = useState(currentMonth);
  const [platform, setPlatform] = useState<Platform | "all">("all"),
    [appFilter, setAppFilter] = useState("all"),
    [groupFilter, setGroupFilter] = useState("all"),
    [basis, setBasis] = useState<Basis>("estimate");
  const [chartMode, setChartMode] = useState<"day" | "month">("day"),
    [query, setQuery] = useState(""),
    [page, setPage] = useState(0),
    [sort, setSort] = useState("date");
  const [dialog, setDialog] = useState<Dialog>(null),
    [editingApp, setEditingApp] = useState<AppProduct | null>(null),
    [taxRow, setTaxRow] = useState<RevenueRow | null>(null);
  const [toast, setToast] = useState(""),
    [busy, setBusy] = useState(false),
    [progress, setProgress] = useState("");
  const [connection, setConnection] = useState<Connection | null>(null),
    [connectionError, setConnectionError] = useState(""),
    [connectorHealth, setConnectorHealth] =
      useState<ConnectorHealth>("checking"),
    [lastSyncDetail, setLastSyncDetail] = useState<string[]>([]);
  const [cloudNote, setCloudNote] = useState("");
  const [googleSaEmail, setGoogleSaEmail] = useState("");
  const [dropActive, setDropActive] = useState(false);
  const cloudPulled = useRef(false);
  const syncInFlight = useRef(false);
  const autoTried = useRef(false);
  const [importPreview, setImportPreview] = useState<
    { document: StoreDocument; rows: RevenueRow[] }[] | null
  >(null);
  const [restore, setRestore] = useState<RevenueData | null>(null);
  const [undo, setRestoreUndo] = useState<RevenueData | null>(null);
  const [taxYear, setTaxYear] = useState(String(new Date().getFullYear())),
    [taxHalf, setTaxHalf] = useState<"1" | "2">(
      new Date().getMonth() < 6 ? "1" : "2",
    );
  const [compactLayout, setCompactLayout] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null),
    backupInput = useRef<HTMLInputElement>(null),
    mounted = useRef(true);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 720px)");
    const apply = () => setCompactLayout(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (demo) return;
    store.update((d) => {
      const apps = withResolvedAppNames(d.apps);
      const enriched = enrichRowsWithApps(d.rows, apps);
      const filled = fillGoogleEstimatedShares(enriched);
      const appsChanged = apps.some((a, i) => a !== d.apps[i]);
      if (filled === d.rows && !appsChanged) return d;
      return { ...d, apps, rows: filled };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot remap Apple SKU → app id + Google fee
  }, [owner, demo]);
  useEffect(() => {
    let cancelled = false;
    const poll = () => {
      connector<Connection>("/status")
        .then((c) => {
          if (cancelled) return;
          setConnection(c);
          setConnectionError("");
          setConnectorHealth("online");
        })
        .catch((e: unknown) => {
          if (cancelled) return;
          setConnection(null);
          setConnectorHealth("offline");
          setConnectionError(
            (e instanceof Error && e.message) ||
              (isRevenueCloudMode()
                ? "클라우드 동기화에 연결되지 않았습니다. 로그인 후 다시 시도해 주세요."
                : "로컬 수익 커넥터가 꺼져 있습니다. npm run revenue:connector 를 실행하거나, 휴대폰은 배포 사이트에서 로그인하세요."),
          );
        });
    };
    setConnectorHealth("checking");
    poll();
    const id = window.setInterval(poll, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    void connector<{ saEmail?: string }>("/google-setup")
      .then((g) => {
        if (!cancelled && g.saEmail) setGoogleSaEmail(g.saEmail);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  const appChoices = useMemo(() => {
    const map = new Map(data.apps.map((a) => [a.id, a.name]));
    data.rows.forEach((r) => {
      if (!map.has(r.appId)) map.set(r.appId, r.appName);
    });
    return [...map.entries()];
  }, [data.apps, data.rows]);
  const appGroupChoices = useMemo(() => {
    if (data.appGroups?.length) return data.appGroups;
    return suggestAppGroups(data.apps);
  }, [data.appGroups, data.apps]);
  const matches = (r: RevenueRow) =>
    (platform === "all" || r.platform === platform) &&
    (appFilter === "all" || r.appId === appFilter) &&
    (groupFilter === "all" || rowMatchesGroup(data, r, groupFilter)) &&
    r.basis === basis;
  const filtered = data.rows.filter((r) => r.period === month && matches(r));
  const totals = summarize(filtered, data);
  const previous = summarize(
    data.rows.filter((r) => r.period === shiftMonth(month, -1) && matches(r)),
    data,
  );
  const growthBase =
    previous.unknownProceeds &&
    !data.rows.some(
      (r) => r.period === shiftMonth(month, -1) && matches(r) && r.proceeds !== null,
    )
      ? previous.gross
      : previous.proceeds;
  const currentBase =
    totals.unknownProceeds && !filtered.some((r) => r.proceeds !== null)
      ? totals.gross
      : totals.proceeds;
  const growth =
    growthBase > 0 ? ((currentBase - growthBase) / growthBase) * 100 : null;
  const yoy = yearOverYear(data, month, matches);
  const periodExpenses = data.expenses.filter((e) => e.date.startsWith(month));
  const expenses = periodExpenses.reduce((n, e) => n + e.amount, 0);
  const comparable = platform === "all" && appFilter === "all";
  const tax = taxWorksheet(data, taxYear, taxHalf);
  const pendingCurrency = [
    ...new Set(
      data.rows
        .filter((r) => r.period === month)
        .flatMap((r) => [r.currency, r.proceedsCurrency]),
    ),
  ].filter((c) => c !== "KRW");
  const ledgerRows = filtered
    .filter((r) =>
      `${r.appName} ${r.country} ${r.date}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "net"
        ? (amounts(b, data)?.proceeds ?? 0) - (amounts(a, data)?.proceeds ?? 0)
        : b.date.localeCompare(a.date),
    );
  const safePage = Math.min(
    page,
    Math.max(0, Math.ceil(ledgerRows.length / 15) - 1),
  );
  const appRanking = data.apps
    .filter((a) => platform === "all" || a.platform === platform)
    .map((app) => {
      const rows = rowsForApp(app, filtered);
      return { id: app.id, name: app.name, rows, ...summarize(rows, data) };
    })
    .filter((a) => a.rows.length > 0 || a.gross > 0)
    .sort((a, b) => b.proceeds - a.proceeds);
  const storeCut = storeTake(totals);
  const paidSales = countPaidSales(filtered);
  const actualIncome = totals.proceeds - expenses;
  // 검증: 총매출 − 환불 − 스토어공제 ≈ 개발자수익
  const proceedsCheck = totals.gross - totals.refunds - storeCut.total;
  const log = (
    status: "success" | "partial" | "error",
    message: string,
    detail?: {
      completed?: string[];
      errors?: string[];
      apps?: number;
      documents?: number;
      appleMonths?: number;
      googleMonths?: number;
    },
  ) => ({
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    status,
    message,
    detail,
  });
  function toggleDemo() {
    if (!demo) {
      setSample(demoData(month));
      setSampleStatus();
    }
    setDemo(!demo);
    setAppFilter("all");
    setPage(0);
  }
  function setSampleStatus() {
    setToast(
      "샘플 화면입니다. 표시된 금액과 앱 상태는 실제 데이터가 아닙니다.",
    );
  }
  async function sync(opts: { auto?: boolean } = {}) {
    if (demo) {
      if (!opts.auto) setToast("실제 데이터로 전환한 뒤 동기화해 주세요.");
      return;
    }
    if (syncInFlight.current) return;
    syncInFlight.current = true;
    setBusy(true);
    setProgress(
      opts.auto
        ? "자동 동기화 · 전체 연도 Apple·Google 받는 중…"
        : "전체 연도 Apple·Google 동기화 중…",
    );
    setLastSyncDetail([]);
    try {
      const start = await connector<{ id: string }>("/sync", {
        method: "POST",
        body: JSON.stringify({ scope: "all" }),
      });
      setConnectorHealth("online");
      let result: SyncResult;
      do {
        await new Promise((resolve) => setTimeout(resolve, 1200));
        if (!mounted.current) return;
        result = await connector<SyncResult>(`/job?id=${encodeURIComponent(start.id)}`);
        setProgress(result.progress);
      } while (result.state === "running");
      const parsed: { document: StoreDocument; rows: RevenueRow[] }[] = [];
      const errors = [...result.errors];
      for (const document of result.documents) {
        try {
          parsed.push({
            document,
            rows: enrichRowsWithApps(
              await parseReport(document),
              result.apps,
            ),
          });
        } catch (e) {
          errors.push(
            `${document.name}: ${e instanceof Error ? e.message : "형식 확인 필요"}`,
          );
        }
      }
      const toast = formatSyncToast({
        apps: result.apps.length,
        documents: parsed.map((p) => p.document),
        errors,
        completed: result.completed,
        auto: opts.auto,
      });
      const detail = errors.slice(0, 8);
      let saved: RevenueData | null = null;
      store.update((prev) => {
        const next = mergeReports(prev, parsed);
        const apps = new Map(next.apps.map((a) => [a.id, a]));
        result.apps.forEach((a) => {
          const prev = apps.get(a.id);
          const incoming = { ...a, favorite: prev?.favorite };
          if (
            looksLikePackageName(incoming.name) &&
            prev?.name &&
            !looksLikePackageName(prev.name)
          ) {
            incoming.name = prev.name;
          }
          apps.set(a.id, incoming);
        });
        const resolvedApps = withResolvedAppNames([...apps.values()]);
        resolvedApps.forEach((a) => apps.set(a.id, a));
        const enrichedRows = enrichRowsWithApps(next.rows, resolvedApps);
        const appleMonths = new Set(
          enrichedRows.filter((r) => r.platform === "apple").map((r) => r.period),
        ).size;
        const googleMonths = new Set(
          enrichedRows.filter((r) => r.platform === "google").map((r) => r.period),
        ).size;
        const groups =
          next.appGroups?.length
            ? next.appGroups
            : suggestAppGroups([...apps.values()]);
        saved = {
          ...next,
          appGroups: groups,
          apps: [...apps.values()],
          rows: enrichedRows,
          logs: [
            log(
              syncLogStatus(parsed.length, result.apps.length, errors.length),
              toast,
              {
                completed: result.completed,
                errors,
                apps: result.apps.length,
                documents: parsed.length,
                appleMonths,
                googleMonths,
              },
            ),
            ...next.logs,
          ].slice(0, 50),
        };
        return saved;
      });
      if (saved) void saveCloud(saved);
      setToast(toast);
      setLastSyncDetail(detail);
      if (errors.length) setSection("connections");
      if (opts.auto) markAutoSynced(owner, localDate());
      const refreshed = await connector<Connection>("/status").catch(
        () => null,
      );
      if (refreshed) {
        setConnection(refreshed);
        setConnectorHealth("online");
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "동기화 실패";
      setToast(message);
      setLastSyncDetail([message]);
      setConnectorHealth("offline");
      store.update((prev) => ({
        ...prev,
        logs: [log("error", message), ...prev.logs].slice(0, 50),
      }));
      setSection("connections");
    } finally {
      syncInFlight.current = false;
      if (mounted.current) {
        setBusy(false);
        setProgress("");
      }
    }
  }
  useEffect(() => {
    if (demo || autoTried.current || connectorHealth !== "online") return;
    if (!shouldAutoSync(owner, localDate())) {
      autoTried.current = true;
      return;
    }
    autoTried.current = true;
    const t = window.setTimeout(() => {
      void sync({ auto: true });
    }, 900);
    return () => window.clearTimeout(t);
  }, [connectorHealth, demo, owner, month]);

  useEffect(() => {
    if (demo || cloudPulled.current || owner === "device") return;
    cloudPulled.current = true;
    void (async () => {
      setCloudNote("클라우드 자료 확인 중…");
      const remote = await pullRevenueSnapshot(owner);
      if (remote.error) {
        setCloudNote(`클라우드: ${remote.error}`);
        return;
      }
      if (!remote.data) {
        setCloudNote("클라우드 저장본 없음 · 동기화 후 폰에서도 볼 수 있습니다");
        return;
      }
      store.update((local) => preferNewer(local, remote.data));
      setCloudNote(
        remote.updatedAt
          ? `클라우드 동기화됨 · ${new Date(remote.updatedAt).toLocaleString("ko-KR")}`
          : "클라우드 동기화됨",
      );
    })();
  }, [demo, owner]);

  useEffect(() => {
    if (demo) return;
    const missing = neededCurrencies(data.rows, month).filter(
      (c) => !data.rates[`${month}:${c}`],
    );
    if (!missing.length) return;
    let cancelled = false;
    void (async () => {
      const fetched = await fetchMonthRatesKrw(month, missing);
      if (cancelled || !Object.keys(fetched).length) return;
      update((d) => ({ ...d, rates: { ...d.rates, ...fetched } }));
      setToast(`${monthLabel(month)} 환율 ${Object.keys(fetched).length}건 자동 반영`);
    })();
    return () => {
      cancelled = true;
    };
  }, [demo, month, data.rows.length]);

  async function saveCloud(next: RevenueData) {
    if (demo || owner === "device") return;
    const stamped = {
      ...next,
      meta: { ...next.meta, lastCloudAt: new Date().toISOString() },
    };
    const res = await pushRevenueSnapshot(owner, stamped);
    if (res.ok) update((d) => ({ ...d, meta: stamped.meta }));
    setCloudNote(
      res.ok
        ? `클라우드 저장 · ${new Date().toLocaleString("ko-KR")}`
        : `클라우드 저장 실패: ${res.error || ""}`,
    );
  }

  async function importFiles(files: FileList | File[] | null) {
    if (!files?.length) return;
    setBusy(true);
    setProgress("보고서 형식을 확인하고 있습니다…");
    const list = Array.from(files);
    try {
      const reports: { document: StoreDocument; rows: RevenueRow[] }[] = [];
      const failures: string[] = [];
      for (const file of list) {
        setProgress(`${file.name} 확인 중… (${reports.length}건 준비)`);
        try {
          for (const document of await readReportFile(file)) {
            try {
              reports.push({
                document,
                rows: await parseReport(document),
              });
            } catch (e) {
              failures.push(
                `${file.name}: ${e instanceof Error ? e.message : "형식 오류"}`,
              );
            }
          }
        } catch (e) {
          failures.push(
            `${file.name}: ${e instanceof Error ? e.message : "읽기 실패"}`,
          );
        }
      }
      if (reports.length) setImportPreview(reports);
      if (failures.length) {
        setLastSyncDetail(failures.slice(0, 12));
        setToast(
          reports.length
            ? `${reports.length}개 준비 · ${failures.length}개 파일 오류`
            : failures[0],
        );
      } else if (!reports.length) {
        setToast("가져올 보고서가 없습니다.");
      }
    } catch (e) {
      setToast(e instanceof Error ? e.message : "가져오기 실패");
    } finally {
      setBusy(false);
      setProgress("");
      if (fileInput.current) fileInput.current.value = "";
    }
  }
  function downloadTax() {
    const title = demo ? "샘플_신고불가" : "부가세_검토용";
    download(
      `${title}_${taxYear}_${taxHalf}기.csv`,
      csvString([
        [
          "부가가치세 검토용 집계표",
          "홈택스 전자신고 파일 아님 · 실제 제출 전 검토 필요",
        ],
        ["사업자명", data.business.name],
        ["사업자등록번호", data.business.number],
        [
          "과세유형",
          data.business.kind === "general"
            ? "일반과세자"
            : "간이과세자(세액 계산 미지원)",
        ],
        ["기간", `${tax.start} ~ ${tax.end}`],
        ["미검토 거래", tax.pending.length],
        ["매입 증빙 누락", tax.missingEvidence],
        ["과세 공급가액", tax.taxable],
        ["영세율 공급가액", tax.zero],
        ["면세 공급가액", tax.exempt],
        ["검토된 매출세액", tax.output],
        ["공제 검토 매입세액", tax.input],
        ["입력한 기납부세액", tax.prepaid],
        [
          "일반과세 검토 잔액(추가 공제·가산세 미반영)",
          data.business.kind === "general" ? tax.payable : "계산 제외",
        ],
        [],
        [
          "원문기준일",
          "검토 귀속일",
          "회계월",
          "앱",
          "스토어",
          "세무분류",
          "공급가액(원)",
          "매출세액(원)",
          "증빙",
        ],
        ...tax.rows.map((r) => [
          r.date,
          r.taxDate,
          r.period,
          r.appName,
          platformName[r.platform],
          taxLabels[r.taxClass],
          r.supplyAmount,
          r.outputVat,
          r.evidence,
        ]),
        [],
        ["비용일", "비용명", "지출액", "공제검토 세액", "증빙"],
        ...tax.expenses.map((e) => [
          e.date,
          e.name,
          e.amount,
          e.deductible && e.evidence ? e.inputVat : 0,
          e.evidence,
        ]),
      ]),
    );
    setToast(
      "검토용 집계표를 내려받았습니다. 홈택스 제출은 진행되지 않았습니다.",
    );
  }
  const sectionHeader = (
    title: string,
    subtitle: string,
    action?: ReactNode,
  ) => (
    <div className="rev-section-heading">
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      {action}
    </div>
  );
  const saveMessage = () => {
    setDialog(null);
    setEditingApp(null);
    setToast(demo ? "샘플 데이터에 반영했습니다." : "저장했습니다.");
  };
  const closeDialog = () => {
    setDialog(null);
    setEditingApp(null);
  };

  return (
    <main className={`rev-page${compactLayout ? " rev-compact" : ""}`}>
      <header className="rev-page-header">
        <div>
          <div className="rev-eyebrow">APP BUSINESS</div>
          <h1>
            앱 수익
            <span className="rev-title-dot" />
          </h1>
          <p>앱의 성장부터 정산까지, 한곳에서.</p>
        </div>
        <div className="rev-header-actions">
          <Action
            icon="upload"
            onClick={() => fileInput.current?.click()}
            disabled={busy}
          >
            보고서 가져오기
          </Action>
          <Action
            icon="sync"
            primary
            onClick={() => void sync()}
            disabled={busy || demo || connectorHealth === "offline"}
          >
            {busy ? "동기화 중…" : "지금 동기화"}
          </Action>
        </div>
      </header>
      <div className="rev-status-strip">
        <span className="rev-status-left">
          <span
            className={`rev-status-dot ${
              connectorHealth === "online"
                ? "ready"
                : connectorHealth === "checking"
                  ? "checking"
                  : "down"
            }`}
            aria-hidden
          />
          <span className="rev-connector-pill" data-state={connectorHealth}>
            {connectorHealth === "online"
              ? "커넥터 연결됨"
              : connectorHealth === "checking"
                ? "커넥터 확인 중"
                : "커넥터 끊김"}
          </span>
          <span className="rev-status-meta">
            {demo
              ? "샘플 데이터 · 실제 수익 아님"
              : data.logs[0]
                ? `마지막 확인 ${new Date(data.logs[0].at).toLocaleString("ko-KR")}`
                : "첫 보고서를 연결해 보세요"}
          </span>
        </span>
        <button onClick={toggleDemo} disabled={busy}>
          {demo ? "실제 데이터로 돌아가기" : "샘플 둘러보기"}{" "}
          <span aria-hidden>↗</span>
        </button>
      </div>
      {connectorHealth === "offline" && !demo && (
        <div className="rev-notice rev-notice-warn" role="status">
          <span>
            {connectionError ||
              (isRevenueCloudMode()
                ? "클라우드 동기화에 연결되지 않았습니다. 로그인 상태와 네트워크를 확인한 뒤 다시 시도해 주세요."
                : "로컬 수익 커넥터가 꺼져 있습니다. 터미널에서 npm run revenue:connector 실행 후 동기화하세요.")}
          </span>
          <button
            onClick={() => {
              setConnectorHealth("checking");
              void connector<Connection>("/status")
                .then((c) => {
                  setConnection(c);
                  setConnectionError("");
                  setConnectorHealth("online");
                })
                .catch(() => setConnectorHealth("offline"));
            }}
          >
            다시 확인
          </button>
        </div>
      )}
      {!!lastSyncDetail.length && (
        <div className="rev-notice rev-notice-detail" role="status">
          <span>
            {lastSyncDetail.map((line, i) => (
              <span key={i} className="rev-detail-line">
                {line}
              </span>
            ))}
          </span>
          <button onClick={() => setLastSyncDetail([])}>닫기</button>
        </div>
      )}
      {demo && (
        <div className="rev-notice">
          샘플 모드입니다. 모든 금액·빌드·정산 상태는 기능 체험용이며 실제
          데이터와 분리됩니다.
        </div>
      )}
      {store.error && (
        <div className="rev-error" role="alert">
          {store.error}
        </div>
      )}
      {toast && (
        <div className="rev-toast" role="status">
          <Icon name="info" size={18} />
          <span>{toast}</span>
          <button aria-label="알림 닫기" onClick={() => setToast("")}>
            <Icon name="close" size={16} />
          </button>
        </div>
      )}
      {busy && (
        <div className="rev-sync-progress" role="status">
          <span className="rev-spinner" />
          {progress}
        </div>
      )}
      <nav className="rev-tabs" aria-label="앱 수익 메뉴">
        {sections.map((s) => (
          <button
            key={s.id}
            aria-current={section === s.id ? "page" : undefined}
            className={section === s.id ? "active" : ""}
            onClick={() => {
              setSection(s.id);
              setPage(0);
            }}
          >
            <Icon name={s.icon} size={17} />
            {s.label}
          </button>
        ))}
      </nav>

      {!["connections", "tax"].includes(section) && (
        <div className="rev-filters">
          <div className="rev-month">
            <button
              aria-label="이전 달"
              onClick={() => {
                setMonth(shiftMonth(month, -1));
                setPage(0);
              }}
            >
              <Icon
                name="chevron"
                size={17}
                style={{ transform: "rotate(180deg)" }}
              />
            </button>
            <label>
              <span className="rev-sr-only">조회 월</span>
              <input
                type="month"
                min="2000-01"
                max="2099-12"
                value={month}
                onChange={(e) => {
                  if (e.target.value) {
                    setMonth(e.target.value);
                    setPage(0);
                  }
                }}
              />
            </label>
            <button
              aria-label="다음 달"
              onClick={() => {
                setMonth(shiftMonth(month, 1));
                setPage(0);
              }}
            >
              <Icon name="chevron" size={17} />
            </button>
          </div>
          <div className="rev-filter-selects">
            <label>
              <span className="rev-sr-only">스토어 필터</span>
              <select
                value={platform}
                onChange={(e) => {
                  setPlatform(e.target.value as Platform | "all");
                  setPage(0);
                }}
              >
                <option value="all">전체 스토어</option>
                <option value="apple">App Store</option>
                <option value="google">Google Play</option>
              </select>
            </label>
            <label>
              <span className="rev-sr-only">앱 그룹</span>
              <select
                value={groupFilter}
                onChange={(e) => {
                  setGroupFilter(e.target.value);
                  setPage(0);
                }}
              >
                <option value="all">전체 그룹</option>
                {appGroupChoices.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="rev-sr-only">앱 필터</span>
              <select
                value={appFilter}
                onChange={(e) => {
                  setAppFilter(e.target.value);
                  setPage(0);
                }}
              >
                <option value="all">모든 앱</option>
                {appChoices.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name} · {id.startsWith("apple") ? "iOS" : "Android"}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="rev-sr-only">매출 기준</span>
              <select
                value={basis}
                onChange={(e) => {
                  setBasis(e.target.value as Basis);
                  setPage(0);
                }}
              >
                <option value="estimate">추정 매출</option>
                <option value="settled">확정 보고서</option>
              </select>
            </label>
          </div>
        </div>
      )}

      {section === "overview" && (
        <>
          {!filtered.length ? (
            <div className="rev-notice" role="status">
              <span>
                선택한 기간·조건의 매출 보고서가 없습니다. 아래 금액은 실제
                무매출이 아니라 데이터 없음입니다.
              </span>
              <button onClick={() => setSection("connections")}>
                보고서 연결하기
              </button>
            </div>
          ) : filtered.every((r) => r.gross === 0 && r.refunds === 0) ? (
            <div className="rev-notice" role="status">
              <span>
                이 기간 보고서는 있으나 매출·환불이 모두 0원입니다. 실제
                무매출로 확인된 값입니다.
              </span>
            </div>
          ) : null}
          <section className="rev-hero">
            <div className="rev-hero-main">
              <span className="rev-overline">
                {monthLabel(month)} ·{" "}
                {basis === "estimate" ? "추정" : "확정 보고서"} 개발자 수익
              </span>
              <div className="rev-hero-amount">
                <span>₩</span>
                {!filtered.length
                  ? "—"
                  : money(currentBase)}
              </div>
              <div className="rev-hero-context">
                {growth !== null && filtered.length > 0 ? (
                  <span className="rev-growth">
                    {growth >= 0 ? "+" : ""}
                    {growth.toFixed(1)}% <span>전월 대비</span>
                  </span>
                ) : (
                  <span>매출에서 환불·스토어 공제액을 반영한 금액</span>
                )}
                {yoy.growth !== null && filtered.length > 0 ? (
                  <span className="rev-growth rev-growth-yoy">
                    {yoy.growth >= 0 ? "+" : ""}
                    {yoy.growth.toFixed(1)}% <span>전년 동월</span>
                  </span>
                ) : yoy.hasPrev ? (
                  <span className="rev-muted">전년 동월 ₩{money(yoy.prevVal)}</span>
                ) : null}
              </div>
            </div>
            <div className="rev-hero-platforms">
              {(["apple", "google"] as const).map((p) => {
                const platformRows = filtered.filter((r) => r.platform === p);
                const total = summarize(platformRows, data);
                const label = platformProceedsLabel(p, total, filtered, basis);
                return (
                  <div key={p}>
                    <PlatformMark platform={p} />
                    <div>
                      <span>{platformName[p]}</span>
                      <strong>{label.value}</strong>
                    </div>
                    <span className="rev-muted">{label.note}</span>
                  </div>
                );
              })}
            </div>
          </section>
          <div className="rev-kpi-grid">
            {[
              {
                label: "총 매출",
                value: totals.gross,
                note: "고객 결제액 · 보고서 기준",
                icon: "chart",
              },
              {
                label: "환불액",
                value: totals.refunds,
                note: `유료 순판매 ${money(Math.max(0, paidSales.net))}건`,
                icon: "sync",
              },
              {
                label: "스토어 공제",
                value: storeCut.total,
                note: storeCut.unallocated
                  ? `수수료·세금 포함 · Apple 미분리 ₩${money(storeCut.unallocated)}`
                  : "수수료·세금 합계",
                icon: "receipt",
              },
              {
                label: "개발자 수익",
                value: actualIncome,
                note: comparable
                  ? expenses
                    ? `스토어 공제 후 · 운영비 ₩${money(expenses)} 차감`
                    : `총매출−환불−공제 = ₩${money(proceedsCheck)}`
                  : "모든 앱 선택 시 운영비 반영",
                icon: "wallet",
              },
            ].map((k, i) => (
              <section key={k.label} className="rev-kpi">
                <div>
                  <span>{k.label}</span>
                  <Icon name={k.icon} size={18} />
                </div>
                <strong>
                  {i === 3 && (!comparable || totals.unknownProceeds)
                    ? "—"
                    : `₩${money(k.value)}`}
                </strong>
                <small>{k.note}</small>
              </section>
            ))}
          </div>
          <RevenueInsights
            data={data}
            month={month}
            connection={connection}
            compact={compactLayout}
            onDismissAlert={(id) =>
              update((d) => ({
                ...d,
                meta: {
                  ...d.meta,
                  dismissedAlerts: [...(d.meta?.dismissedAlerts ?? []), id],
                },
              }))
            }
            onToggleCloseItem={(id, done) => {
              const key =
                id === "tax-review"
                  ? `${month}:tax-review`
                  : id === "payout-check"
                    ? `${month}:payout-check`
                    : `${month}:${id}`;
              update((d) => ({
                ...d,
                checklist: { ...d.checklist, [key]: done },
              }));
            }}
          />
          {(totals.missing > 0 || totals.unknownProceeds > 0) && (
            <div className="rev-notice">
              {totals.missing > 0 && (
                <span>
                  환율이 없는 {totals.missing}건은 원화 합계에서 제외했습니다.{" "}
                  <button onClick={() => setDialog("rates")}>
                    환율 입력
                  </button>{" "}
                </span>
              )}
              {totals.unknownProceeds > 0 && (
                <span>
                  수익 미기입 {totals.unknownProceeds}건이 있습니다. Google은
                  보통 Play 수수료 30%로 추정 표시되며, 「확정 보고서」나
                  earnings 동기화 시 실제 수익으로 바뀝니다.
                </span>
              )}
            </div>
          )}
          <div className="rev-overview-grid">
            <section className="rev-card rev-trend">
              {sectionHeader(
                "수익의 흐름",
                chartMode === "day"
                  ? `${monthLabel(month)} 일별 추이`
                  : `${month.slice(0, 4)}년 월별 추이`,
                <div className="rev-segment">
                  <button
                    className={chartMode === "day" ? "active" : ""}
                    onClick={() => setChartMode("day")}
                  >
                    일별
                  </button>
                  <button
                    className={chartMode === "month" ? "active" : ""}
                    onClick={() => setChartMode("month")}
                  >
                    월별
                  </button>
                </div>,
              )}
              <div className="rev-legend">
                <span>
                  <i />
                  매출
                </span>
                <span>
                  <i />
                  개발자 수익
                </span>
              </div>
              <RevenueChart
                rows={data.rows.filter(matches)}
                data={data}
                month={month}
                mode={chartMode}
              />
            </section>
            <section className="rev-card rev-breakdown">
              {sectionHeader(
                "매출이 수익이 되기까지",
                "공제 내역을 빠짐없이 확인하세요",
              )}
              <div className="rev-waterfall">
                {[
                  ["총 매출", totals.gross],
                  ["환불", -totals.refunds],
                  ["스토어 수수료", -totals.fee],
                  ["스토어 세금", -totals.tax],
                  ["미분리 공제(Apple 등)", -totals.unallocated],
                ].map(([name, value], i) => (
                  <div key={String(name)}>
                    <span>{name}</span>
                    <b className={i ? "rev-muted" : ""}>
                      {Number(value) < 0 ? "−" : ""}₩
                      {money(Math.abs(Number(value)))}
                    </b>
                  </div>
                ))}
                <div className="rev-waterfall-total">
                  <span>개발자 수익</span>
                  <b>₩{money(totals.proceeds)}</b>
                </div>
              </div>
              <p className="rev-caption">
                스토어가 원천 공제한 세금과 국내 부가세 신고액은 별도로
                관리합니다.
                {totals.unknownProceeds > 0
                  ? " 수익 미제공 거래는 공제 내역이 완성되지 않았습니다."
                  : ""}
              </p>
            </section>
          </div>
          <div className="rev-overview-grid">
            <section className="rev-card">
              {sectionHeader(
                "앱별 성과",
                "선택한 기간의 개발자 수익 순위",
                <button
                  className="rev-text-button"
                  onClick={() => setSection("apps")}
                >
                  전체 보기 <Icon name="chevron" size={15} />
                </button>,
              )}
              {appRanking.length ? (
                <div className="rev-ranking">
                  {appRanking.slice(0, 5).map((app, i) => (
                    <button
                      key={app.id}
                      onClick={() => {
                        setAppFilter(app.id);
                        setSection("transactions");
                      }}
                    >
                      <span className="rev-rank">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className={`rev-app-monogram tone-${i % 4}`}>
                        {app.name.replace("봄기출 ", "").slice(0, 1)}
                      </span>
                      <span className="rev-rank-name">
                        <b>{app.name}</b>
                        <small>
                          {app.id.startsWith("apple")
                            ? "App Store"
                            : "Google Play"}
                        </small>
                      </span>
                      <strong>₩{money(app.proceeds)}</strong>
                    </button>
                  ))}
                </div>
              ) : (
                <Empty
                  title="아직 매출 보고서가 없어요"
                  text="보고서를 연결하면 앱별 성과가 여기에 모입니다."
                />
              )}
            </section>
            <section className="rev-card rev-goal">
              {sectionHeader(
                "이번 달 목표",
                "개발자 수익 기준",
                <button
                  className="rev-text-button"
                  onClick={() => setDialog("goal")}
                >
                  목표 설정
                </button>,
              )}
              <div className="rev-goal-value">
                {data.goal
                  ? Math.min(
                      100,
                      Math.max(0, (totals.proceeds / data.goal) * 100),
                    ).toFixed(0)
                  : "0"}
                <small>%</small>
                <span>달성</span>
              </div>
              <div className="rev-progress-track">
                <span
                  style={{
                    width: `${data.goal ? Math.max(0, Math.min(100, (totals.proceeds / data.goal) * 100)) : 0}%`,
                  }}
                />
              </div>
              <div className="rev-goal-meta">
                <span>현재 ₩{money(totals.proceeds)}</span>
                <b>{data.goal ? `목표 ₩${money(data.goal)}` : "목표 미설정"}</b>
              </div>
              <div className="rev-goal-bottom">
                <Icon name="arrow" />
                <div>
                  <b>
                    {data.goal
                      ? `목표까지 ₩${money(Math.max(0, data.goal - totals.proceeds))}`
                      : "작은 목표부터 시작해 보세요"}
                  </b>
                  <p>
                    {month === currentMonth() &&
                    filtered.length &&
                    !totals.unknownProceeds &&
                    !totals.missing
                      ? `현재까지 수익을 일수로 단순 환산한 월말 예상 ₩${money((totals.proceeds / new Date().getDate()) * new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate())}`
                      : "월 목표를 설정하고 진행 상황을 확인하세요."}
                  </p>
                </div>
              </div>
            </section>
          </div>
          <section className="rev-next-actions">
            <div>
              <Icon name="shield" />
              <span>
                <b>부가세 신고를 위한 준비</b>
                <small>
                  확정 보고서 · 과세 구분 · 매입 증빙을 함께 정리하세요.
                </small>
              </span>
            </div>
            <button
              className="rev-text-button"
              onClick={() => setSection("tax")}
            >
              신고 자료 확인 <Icon name="chevron" size={16} />
            </button>
          </section>
        </>
      )}

      {section === "apps" && (
        <section className="rev-card">
          {sectionHeader(
            "내 앱 포트폴리오",
            `${data.apps.length}개 등록 · 앱과 스토어별 최신 빌드 상태`,
            <Action icon="plus" onClick={() => setDialog("app")}>
              앱 등록
            </Action>,
          )}
          <div className="rev-toolbar rev-app-groups">
            <Action
              icon="apps"
              onClick={() => {
                const suggested = suggestAppGroups(data.apps);
                update((d) => ({ ...d, appGroups: suggested }));
                setToast(`${suggested.length}개 앱 그룹을 저장했습니다.`);
              }}
            >
              앱 그룹 자동 정리
            </Action>
            <span className="rev-muted">
              iOS·Android 같은 브랜드를 묶어 필터에 표시합니다.
            </span>
          </div>
          <div className="rev-search">
            <Icon name="search" size={18} />
            <input
              placeholder="앱 이름 또는 패키지 검색"
              aria-label="앱 검색"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="rev-app-grid">
            {data.apps
              .filter(
                (a) =>
                  (platform === "all" || a.platform === platform) &&
                  (appFilter === "all" || a.id === appFilter) &&
                  `${a.name} ${a.bundleId}`
                    .toLowerCase()
                    .includes(query.toLowerCase()),
              )
              .sort((a, b) => Number(!!b.favorite) - Number(!!a.favorite))
              .map((app, i) => (
                <article className="rev-app-card" key={app.id}>
                  <div className="rev-app-card-top">
                    <span className={`rev-app-monogram tone-${i % 4}`}>
                      {app.name.replace("봄기출 ", "").slice(0, 1)}
                    </span>
                    <button
                      className={`rev-icon-button ${app.favorite ? "is-favorite" : ""}`}
                      aria-label={`${app.name} 즐겨찾기`}
                      aria-pressed={!!app.favorite}
                      onClick={() =>
                        update((d) => ({
                          ...d,
                          apps: d.apps.map((a) =>
                            a.id === app.id
                              ? { ...a, favorite: !a.favorite }
                              : a,
                          ),
                        }))
                      }
                    >
                      <Icon name="star" size={18} />
                    </button>
                  </div>
                  <h3>{app.name}</h3>
                  <p className="rev-package">{app.bundleId || app.id}</p>
                  <div className="rev-app-store">
                    <PlatformMark platform={app.platform} />
                    <span>{platformName[app.platform]}</span>
                    <span className="rev-badge">{appStatus(app.status)}</span>
                  </div>
                  {(() => {
                    const appRows = rowsForApp(app, filtered);
                    const share =
                      data.apps.length > 0
                        ? expenses / Math.max(1, data.apps.filter((a) => platform === "all" || a.platform === platform).length)
                        : 0;
                    const pnl = appProfit(appRows, data, share);
                    const sales = countPaidSales(appRows);
                    return (
                      <>
                        <dl>
                          <div>
                            <dt>버전</dt>
                            <dd>{app.version || "미확인"}</dd>
                          </div>
                          <div>
                            <dt>조회된 빌드</dt>
                            <dd>{app.build || "미확인"}</dd>
                          </div>
                          <div>
                            <dt>기간 매출</dt>
                            <dd>₩{money(pnl.gross)}</dd>
                          </div>
                          <div>
                            <dt>순판매</dt>
                            <dd>
                              {money(Math.max(0, sales.net))}건
                              {sales.refunded > 0
                                ? ` · 환불 ${money(sales.refunded)}건`
                                : ""}
                            </dd>
                          </div>
                        </dl>
                        <div className="rev-app-pnl">
                          <div>
                            <span>판매</span>
                            <b>{money(sales.sold)}건</b>
                          </div>
                          <div>
                            <span>환불</span>
                            <b>
                              {money(sales.refunded)}건 · ₩{money(pnl.refunds)}
                            </b>
                          </div>
                          <div>
                            <span>순판매</span>
                            <b>{money(Math.max(0, sales.net))}건</b>
                          </div>
                          <div>
                            <span>수수료·세금</span>
                            <b>₩{money(pnl.fee + pnl.tax)}</b>
                          </div>
                          <div>
                            <span>수익</span>
                            <b>₩{money(pnl.displayProceeds)}</b>
                          </div>
                          <div>
                            <span>비용배분</span>
                            <b>₩{money(pnl.expenseShare)}</b>
                          </div>
                          <div className="rev-app-pnl-net">
                            <span>추정 손익</span>
                            <b>₩{money(pnl.net)}</b>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                  <div className="rev-app-card-footer">
                    <small>
                      {app.source === "api"
                        ? "API 조회"
                        : app.source === "demo"
                          ? "샘플"
                          : "직접 등록"}{" "}
                      · {app.updatedAt.slice(0, 10)}
                    </small>
                    <button
                      className="rev-text-button"
                      onClick={() => {
                        setEditingApp(app);
                        setDialog("app");
                      }}
                    >
                      편집
                    </button>
                  </div>
                </article>
              ))}
          </div>
          {!data.apps.length && (
            <Empty
              title="내 앱을 연결하세요"
              text="지금 동기화를 누르면 스토어의 앱·버전·빌드와 전체 연도 매출 보고서를 가져옵니다."
            >
              <Action
                primary
                icon="sync"
                onClick={() => void sync()}
                disabled={busy || connectorHealth === "offline"}
              >
                스토어 동기화
              </Action>
            </Empty>
          )}
        </section>
      )}

      {section === "transactions" && (
        <>
        <div className="rev-ledger-summary" aria-label="매출 합계">
          <div className="rev-ledger-summary-head">
            <div>
              <h2>매출 합계</h2>
              <p>
                {monthLabel(month)} ·{" "}
                {basis === "estimate" ? "추정 매출" : "확정 보고서"} ·{" "}
                {platform === "all" ? "전체 스토어" : platformName[platform]}
              </p>
            </div>
            {!filtered.length ? (
              <span className="rev-pill rev-pill-muted">데이터 없음</span>
            ) : filtered.every((r) => r.gross === 0 && !r.refunds) ? (
              <span className="rev-pill">실제 무매출</span>
            ) : (
              <span className="rev-pill rev-pill-ready">보고서 반영</span>
            )}
          </div>
          <div className="rev-ledger-summary-grid">
            {[
              {
                label: "총 매출",
                value: !filtered.length ? "—" : `₩${money(totals.gross)}`,
                note: `고객 결제액 · ${money(ledgerRows.length)}건`,
              },
              {
                label: "환불",
                value: !filtered.length ? "—" : `₩${money(totals.refunds)}`,
                note: `순 판매 ${money(totals.units)}건`,
              },
              {
                label: "스토어 공제",
                value: !filtered.length ? "—" : `₩${money(storeCut.total)}`,
                note: storeCut.unallocated
                  ? `미분리 ₩${money(storeCut.unallocated)} 포함`
                  : "수수료·세금·미분리 합",
              },
              {
                label: "개발자 수익",
                value: !filtered.length
                  ? "—"
                  : totals.unknownProceeds &&
                      !filtered.some((r) => r.proceeds !== null)
                    ? "미제공"
                    : `₩${money(totals.proceeds)}`,
                note:
                  basis === "estimate"
                    ? platform === "google" ||
                      filtered.some((r) => r.platform === "google")
                      ? "추정 · 매출−수수료−세금"
                      : "추정"
                    : "확정 보고서",
              },
            ].map((item) => (
              <div key={item.label} className="rev-ledger-metric">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <small>{item.note}</small>
              </div>
            ))}
          </div>
        </div>
        <section className="rev-card">
          {sectionHeader(
            "매출 상세 내역",
            `${ledgerRows.length}건 · 추정·확정 보고서를 합산하지 않습니다`,
            <Action
              icon="download"
              disabled={!ledgerRows.length}
              onClick={() =>
                download(
                  `${demo ? "샘플_" : ""}앱매출_${month}.csv`,
                  exportRows(ledgerRows, data),
                )
              }
            >
              CSV 내보내기
            </Action>,
          )}
          <div className="rev-table-controls">
            <div className="rev-search">
              <Icon name="search" size={18} />
              <input
                placeholder="앱·날짜·국가 검색"
                aria-label="매출 내역 검색"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(0);
                }}
              />
            </div>
            <select
              aria-label="매출 정렬"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="date">날짜 최신순</option>
              <option value="net">수익 높은순</option>
            </select>
          </div>
          {ledgerRows.length ? (
            <>
              <div className="rev-table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>거래일 / 앱</th>
                      <th>스토어</th>
                      <th className="num">매출</th>
                      <th className="num">수수료</th>
                      <th className="num">개발자 수익</th>
                      <th>세무 분류</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerRows
                      .slice(safePage * 15, safePage * 15 + 15)
                      .map((row) => (
                        <tr key={row.id}>
                          <td>
                            <b>
                              {data.apps.find((a) => a.id === row.appId)
                                ?.name || row.appName}
                            </b>
                            <small>
                              {row.date}
                              {row.endDate && row.endDate !== row.date
                                ? ` ~ ${row.endDate}`
                                : ""}{" "}
                              · {row.country || "국가 미기재"}
                            </small>
                          </td>
                          <td>
                            <span className="rev-table-store">
                              <PlatformMark platform={row.platform} />
                              {row.platform === "apple" ? "Apple" : "Google"}
                            </span>
                          </td>
                          <td className="num">
                            {money(amounts(row, data)?.gross ?? row.gross)}
                            <small>{row.currency}</small>
                          </td>
                          <td className="num">
                            {amounts(row, data)
                              ? money(amounts(row, data)!.fee)
                              : row.fee === null
                                ? "미분리"
                                : money(row.fee)}
                          </td>
                          <td className="num">
                            <b>
                              {amounts(row, data)
                                ? money(amounts(row, data)!.proceeds)
                                : row.proceeds === null
                                  ? "미제공"
                                  : money(row.proceeds)}
                            </b>
                            <small>{row.proceedsCurrency}</small>
                          </td>
                          <td>
                            {row.basis === "settled" ? (
                              <button
                                className={`rev-badge-button ${row.taxClass === "unreviewed" ? "pending" : ""}`}
                                onClick={() => setTaxRow(row)}
                              >
                                {taxLabels[row.taxClass]}{" "}
                                <span aria-hidden>↗</span>
                              </button>
                            ) : (
                              <span className="rev-muted">추정 자료</span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              <div className="rev-pagination">
                <span>
                  {safePage * 15 + 1}–
                  {Math.min((safePage + 1) * 15, ledgerRows.length)} /{" "}
                  {ledgerRows.length}
                </span>
                <button
                  disabled={safePage === 0}
                  onClick={() => setPage(safePage - 1)}
                >
                  이전
                </button>
                <button
                  disabled={(safePage + 1) * 15 >= ledgerRows.length}
                  onClick={() => setPage(safePage + 1)}
                >
                  다음
                </button>
              </div>
            </>
          ) : (
            <Empty
              title="선택한 조건에 매출이 없습니다"
              text="조회 월·앱·추정 또는 확정 기준을 확인하거나 보고서를 가져와 주세요."
            >
              <Action icon="upload" onClick={() => fileInput.current?.click()}>
                보고서 가져오기
              </Action>
            </Empty>
          )}
        </section>
        </>
      )}

      {section === "payouts" && (
        <>
          <section className="rev-card">
            {sectionHeader(
              "입금 대조",
              "선택한 월에 입금 예정인 정산 · 원화 실입금 기준",
              <Action icon="plus" onClick={() => setDialog("payout")}>
                정산 기록
              </Action>,
            )}
            {data.payouts.filter(
              (p) =>
                p.dueDate.startsWith(month) &&
                (platform === "all" || p.platform === platform),
            ).length ? (
              <div className="rev-payout-list">
                {data.payouts
                  .filter(
                    (p) =>
                      p.dueDate.startsWith(month) &&
                      (platform === "all" || p.platform === platform),
                  )
                  .map((p) => (
                    <article key={p.id}>
                      <div className="rev-payout-name">
                        <PlatformMark platform={p.platform} />
                        <div>
                          <h3>{platformName[p.platform]}</h3>
                          <p>
                            {p.month} 매출 · 예정일 {p.dueDate}
                          </p>
                        </div>
                        <span
                          className={`rev-badge ${p.receivedDate ? "positive" : ""}`}
                        >
                          {p.receivedDate ? "입금 기록됨" : "입금 대기"}
                        </span>
                      </div>
                      <div className="rev-payout-amounts">
                        <div>
                          <span>예상 정산액</span>
                          <b>₩{money(p.expected)}</b>
                        </div>
                        <div>
                          <span>실제 입금액</span>
                          <b>₩{money(p.received)}</b>
                        </div>
                        <div>
                          <span>차이</span>
                          <b
                            className={
                              p.received - p.expected ? "rev-amber" : "rev-blue"
                            }
                          >
                            {p.receivedDate
                              ? `₩${money(p.received - p.expected)}`
                              : "미입금"}
                          </b>
                        </div>
                      </div>
                      <p className="rev-caption">
                        {p.receivedDate && `${p.receivedDate} 입금 · `}
                        {p.memo || "입금 메모 없음"}
                      </p>
                      <button
                        className="rev-text-button"
                        onClick={() => {
                          const previous = data;
                          update((d) => ({
                            ...d,
                            payouts: d.payouts.filter((x) => x.id !== p.id),
                          }));
                          setUndo(previous);
                        }}
                      >
                        기록 삭제
                      </button>
                    </article>
                  ))}
              </div>
            ) : (
              <Empty
                title="이번 달 입금 예정 내역이 없습니다"
                text="보고서 수익과 실제 입금액을 기록해 환전·은행 수수료 차이를 확인하세요."
              />
            )}
          </section>
          <section className="rev-card">
            {sectionHeader(
              "운영비와 매입 증빙",
              `전체 앱 공통 비용 · ${monthLabel(month)} ₩${money(expenses)}`,
              <Action icon="plus" onClick={() => setDialog("expense")}>
                비용 추가
              </Action>,
            )}
            {periodExpenses.length ? (
              <div className="rev-table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>비용 / 날짜</th>
                      <th>분류</th>
                      <th className="num">지출액</th>
                      <th className="num">매입세액</th>
                      <th>증빙</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {periodExpenses.map((e) => (
                      <tr key={e.id}>
                        <td>
                          <b>{e.name}</b>
                          <small>{e.date}</small>
                        </td>
                        <td>{e.category}</td>
                        <td className="num">₩{money(e.amount)}</td>
                        <td className="num">
                          {e.deductible ? `₩${money(e.inputVat)}` : "공제 제외"}
                        </td>
                        <td>
                          {e.evidence || (
                            <span className="rev-amber">미등록</span>
                          )}
                        </td>
                        <td>
                          <button
                            className="rev-text-button"
                            onClick={() => {
                              const previous = data;
                              update((d) => ({
                                ...d,
                                expenses: d.expenses.filter(
                                  (x) => x.id !== e.id,
                                ),
                              }));
                              setUndo(previous);
                            }}
                          >
                            삭제
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty
                title="기록된 운영비가 없습니다"
                text="광고비·서버비·구독료 등을 기록하면 비용 차감 수익과 매입세액을 함께 정리합니다."
              />
            )}
          </section>
        </>
      )}

      {section === "tax" && (
        <div className="rev-tax-area">
          <section className="rev-card">
            {sectionHeader(
              "부가세 신고 준비",
              "정산 자료를 검토 가능한 신고 기초자료로",
              <Action
                icon="download"
                primary
                onClick={downloadTax}
                disabled={!tax.rows.length && !tax.expenses.length}
              >
                신고 자료 만들기
              </Action>,
            )}
            <div className="rev-tax-toolbar">
              <select
                aria-label="신고 연도"
                value={taxYear}
                onChange={(e) => {
                  setTaxYear(e.target.value);
                  setPage(0);
                }}
              >
                {Array.from({ length: 8 }, (_, i) =>
                  String(new Date().getFullYear() - 5 + i),
                ).map((y) => (
                  <option key={y}>{y}</option>
                ))}
              </select>
              <div className="rev-segment">
                <button
                  className={taxHalf === "1" ? "active" : ""}
                  onClick={() => {
                    setTaxHalf("1");
                    setPage(0);
                  }}
                >
                  1기 · 1~6월
                </button>
                <button
                  className={taxHalf === "2" ? "active" : ""}
                  onClick={() => {
                    setTaxHalf("2");
                    setPage(0);
                  }}
                >
                  2기 · 7~12월
                </button>
              </div>
              <Action
                icon="shield"
                onClick={() => {
                  update((d) => ({ ...d, rows: applyTaxSuggestions(d.rows) }));
                  setToast("미검토 거래에 과세 분류 제안을 적용했습니다.");
                }}
              >
                분류 자동 제안
              </Action>
              <button
                className="rev-text-button"
                onClick={() => {
                  const pack = exportTaxPackCsv(data, taxYear, taxHalf);
                  download(`${pack.filename}.csv`, pack.summary + "\n\n" + pack.lines);
                  setToast("부가세 검토용 요약+내역 CSV를 내려받았습니다.");
                }}
              >
                검토용 CSV 묶음
              </button>
              <button
                className="rev-text-button"
                onClick={() => setDialog("business")}
              >
                {data.business.name || "사업자 정보 입력"}{" "}
                <Icon name="chevron" size={15} />
              </button>
            </div>
            <div className="rev-tax-banner">
              <Icon name="shield" size={26} />
              <div>
                <b>
                  {tax.pending.length
                    ? `${tax.pending.length}건의 과세 구분을 확인해 주세요`
                    : tax.rows.length
                      ? "분류된 자료를 검토할 수 있습니다"
                      : "확정 보고서를 먼저 가져와 주세요"}
                </b>
                <p>현재 단계: 신고 자료 준비 · 홈택스 제출 전</p>
              </div>
              <span className="rev-badge">
                {data.business.kind === "general" ? "일반과세" : "간이과세"}
              </span>
            </div>
            <div className="rev-tax-stats">
              {[
                ["과세 공급가액", tax.taxable],
                ["영세율 공급가액", tax.zero],
                ["매출세액", tax.output],
                ["공제 검토 매입세액", tax.input],
              ].map(([name, n]) => (
                <div key={String(name)}>
                  <span>{name}</span>
                  <b>₩{money(Number(n))}</b>
                </div>
              ))}
            </div>
            <div className="rev-tax-balance">
              <span>
                검토 잔액 <small>매출세액 − 매입세액 − 입력한 기납부세액</small>
              </span>
              <strong>
                {data.business.kind === "simplified"
                  ? "별도 계산 필요"
                  : `₩${money(tax.payable)}`}
              </strong>
            </div>
            <p className="rev-caption">
              확정 신고세액이 아닙니다. 미분류 {tax.pending.length}건·매입 증빙
              누락 {tax.missingEvidence}건과 추가 공제·가산세는 반영하지
              않습니다. 간이과세자는 이 화면에서 세액을 계산하지 않습니다. 해외
              판매의 과세·영세율 여부는 계약과 증빙을 확인해 직접 분류하세요.
            </p>
          </section>
          <div className="rev-overview-grid">
            <section className="rev-card">
              {sectionHeader(
                "신고 전 확인",
                "해당 반기별로 확인 내역을 저장합니다",
              )}
              <div className="rev-checklist">
                {[
                  "스토어 확정 보고서와 입금 내역을 대조했어요",
                  "Apple 회계기간과 실제 매출 귀속기간을 확인했어요",
                  "과세·영세율·면세 구분과 증빙을 확인했어요",
                  "공제 가능한 매입세액과 기납부세액을 확인했어요",
                ].map((text, i) => (
                  <label key={text}>
                    <input
                      type="checkbox"
                      checked={!!data.checklist[`${taxYear}-${taxHalf}-${i}`]}
                      onChange={(e) =>
                        update((d) => ({
                          ...d,
                          checklist: {
                            ...d.checklist,
                            [`${taxYear}-${taxHalf}-${i}`]: e.target.checked,
                          },
                        }))
                      }
                    />
                    <span>{text}</span>
                  </label>
                ))}
              </div>
              <a
                className="rev-text-button"
                href="https://www.hometax.go.kr/"
                target="_blank"
                rel="noreferrer"
              >
                홈택스에서 검토 후 신고 <span aria-hidden>↗</span>
              </a>
            </section>
            <section className="rev-card">
              {sectionHeader(
                "자료의 기준",
                "원문과 검토용 자료를 함께 보관하세요",
              )}
              <ul className="rev-source-notes">
                <li>추정 판매 보고서는 신고 집계에서 제외합니다.</li>
                <li>
                  수수료를 제외한 입금액이 그대로 부가세 과세표준이 되지는
                  않습니다.
                </li>
                <li>
                  Apple 확정 자료는 회계월 기준이므로 귀속기간 경계 거래를
                  확인해야 합니다.
                </li>
                <li>
                  내려받는 파일은 세무 검토용 CSV이며 홈택스 전자신고 업로드
                  파일이 아닙니다.
                </li>
              </ul>
              <a
                className="rev-text-button"
                href="https://www.nts.go.kr/nts/cm/cntnts/cntntsView.do?mi=2272&cntntsId=7693"
                target="_blank"
                rel="noreferrer"
              >
                국세청 신고 안내 ↗
              </a>
              <button
                className="rev-text-button"
                onClick={() => window.print()}
              >
                이 집계표 인쇄 / PDF 저장
              </button>
            </section>
          </div>
          <section className="rev-card">
            {sectionHeader(
              "과세 구분과 증빙",
              `선택한 기간 전체 앱의 확정 자료 ${tax.rows.length}건`,
            )}
            <div className="rev-tax-review">
              {tax.rows.slice(page * 10, page * 10 + 10).map((r) => (
                <button key={r.id} onClick={() => setTaxRow(r)}>
                  <div>
                    <b>{r.appName}</b>
                    <small>
                      {r.date} · {platformName[r.platform]} · {r.currency}{" "}
                      {money(r.gross - r.refunds)}
                    </small>
                  </div>
                  <span
                    className={`rev-badge ${r.taxClass === "unreviewed" ? "amber" : ""}`}
                  >
                    {taxLabels[r.taxClass]}
                  </span>
                  <Icon name="chevron" size={16} />
                </button>
              ))}
            </div>
            {!tax.rows.length && (
              <Empty
                title="확정 자료가 아직 없습니다"
                text="연결 관리에서 지난달의 확정 보고서를 동기화하거나 재무 보고서를 가져오세요."
              />
            )}
            {tax.rows.length > 10 && (
              <div className="rev-pagination">
                <span>
                  {page + 1} / {Math.ceil(tax.rows.length / 10)}
                </span>
                <button disabled={page === 0} onClick={() => setPage(page - 1)}>
                  이전
                </button>
                <button
                  disabled={(page + 1) * 10 >= tax.rows.length}
                  onClick={() => setPage(page + 1)}
                >
                  다음
                </button>
              </div>
            )}
          </section>
        </div>
      )}

      {section === "connections" && (
        <>
          <section className="rev-card">
            {sectionHeader(
              "스토어 연결",
              "한 번 설정하면 버튼 하나로 앱·매출·수익을 가져옵니다",
              <Action
                icon="sync"
                primary
                disabled={busy || demo || connectorHealth === "offline"}
                onClick={() => void sync()}
              >
                지금 동기화
              </Action>,
            )}
            <div className="rev-connection-month">
              <span>동기화할 기간</span>
              <input
                type="month"
                aria-label="동기화할 월"
                value={month}
                max={currentMonth()}
                onChange={(e) => e.target.value && setMonth(e.target.value)}
              />
            </div>
            <div className="rev-connection-grid">
              {(["apple", "google"] as const).map((p) => (
                <article key={p}>
                  <div className="rev-connection-top">
                    <PlatformMark platform={p} />
                    <h3>
                      {p === "apple"
                        ? "App Store Connect"
                        : "Google Play Console"}
                    </h3>
                  </div>
                  <span
                    className={`rev-badge ${connection?.[p].reports ? "positive" : "amber"}`}
                  >
                    {connection?.[p].reports
                      ? "연결 설정 완료"
                      : connection?.[p].configured
                        ? "API 키 확인 · 보고서 설정 필요"
                        : "연결 설정 필요"}
                  </span>
                  <p>
                    {p === "apple"
                      ? "앱 목록, 최근 빌드, 일별 판매 및 월별 확정 재무 보고서"
                      : "앱 목록, 출시 트랙, 예상 매출 및 월별 확정 수익 보고서"}
                  </p>
                  <div className="rev-connection-requirements">
                    {connection?.[p].missing.map((m) => (
                      <span key={m}>
                        <Icon name="info" size={14} />
                        {m}
                      </span>
                    ))}
                  </div>
                  <a
                    href={
                      p === "apple"
                        ? "https://appstoreconnect.apple.com/"
                        : "https://play.google.com/console/"
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="rev-text-button"
                  >
                    {p === "apple" ? "App Store Connect" : "Play Console"} 열기
                    ↗
                  </a>
                </article>
              ))}
            </div>

            <section className="rev-card rev-google-setup">
              {sectionHeader(
                "Google Play 정식 연결",
                "GCS·API·서비스 계정 체크리스트",
              )}
              <ol className="rev-google-steps">
                {googleSetupSteps(
                  connection,
                  googleSaEmail,
                  connection?.settings?.bucket || "",
                ).map((step) => (
                  <li key={step.id} className={step.done ? "is-done" : ""}>
                    <div>
                      <b>{step.title}</b>
                      <p>{step.body}</p>
                    </div>
                    {step.link ? (
                      <a href={step.link} target="_blank" rel="noreferrer">
                        열기 ↗
                      </a>
                    ) : null}
                  </li>
                ))}
              </ol>
              {!isRevenueCloudMode() ? (
                <Action
                  icon="sync"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setProgress("Chrome에서 Play zip 받는 중…");
                    try {
                      const out = await connector<{
                        ok: boolean;
                        files?: number;
                        error?: string;
                      }>("/refresh-play-bundle", { method: "POST" });
                      setToast(
                        out.ok
                          ? `Play 번들 ${out.files ?? 0}개 갱신 · 다음 동기화에 반영`
                          : out.error || "번들 갱신 실패",
                      );
                    } catch (e) {
                      setToast(
                        e instanceof Error ? e.message : "번들 갱신 실패",
                      );
                    } finally {
                      setBusy(false);
                      setProgress("");
                    }
                  }}
                >
                  PC Chrome 번들 갱신
                </Action>
              ) : (
                <p className="rev-muted">
                  클라우드에서는 서버에 올려 둔 번들·GCS를 사용합니다. zip
                  갱신은 PC 커넥터에서 실행하세요.
                </p>
              )}
            </section>

            {connection ? (
              <>
                <div className="rev-toolbar" style={{ marginBottom: "0.75rem" }}>
                  <Action
                    onClick={async () => {
                      setBusy(true);
                      setProgress("버킷·패키지 자동 감지 중…");
                      try {
                        const next = await connector<
                          Connection & {
                            discovered?: { notes: string[]; bucket: string; packages: string[]; vendor: string };
                          }
                        >("/discover", { method: "POST" });
                        setConnection(next);
                        setToast(
                          next.discovered?.notes?.length
                            ? next.discovered.notes.join(" · ")
                            : "자동 감지를 마쳤습니다.",
                        );
                      } catch (e) {
                        setToast(e instanceof Error ? e.message : "자동 감지 실패");
                      } finally {
                        setBusy(false);
                        setProgress("");
                      }
                    }}
                  >
                    설정 자동 찾기
                  </Action>
                  <span className="rev-muted">
                    Google 버킷·앱 목록을 찾고, Apple은 판매자 번호만 한 번
                    입력하면 됩니다.
                  </span>
                </div>
              <DataForm
                key={`${connection.settings.vendor}|${connection.settings.bucket}|${connection.settings.packages.join(",")}`}
                label="연결 설정 저장"
                cancel={() => setSection("overview")}
                submit={async (f) => {
                  if (demo)
                    throw new Error(
                      "연결 설정은 실제 데이터 모드에서 저장해 주세요.",
                    );
                  const next = await connector<Connection>("/settings", {
                    method: "PUT",
                    body: JSON.stringify({
                      vendor: fieldText(f, "vendor"),
                      bucket: fieldText(f, "bucket"),
                      packages: fieldText(f, "packages")
                        .split(/[\s,]+/)
                        .filter(Boolean),
                    }),
                  });
                  setConnection(next);
                  setToast(
                    "연결 설정을 저장했습니다. 지금 동기화를 눌러 주세요.",
                  );
                }}
              >
                <div className="rev-form-grid">
                  <label>
                    Apple 판매자 번호
                    <input
                      name="vendor"
                      inputMode="numeric"
                      placeholder="Vendor Number"
                      defaultValue={connection.settings.vendor}
                    />
                    <small>App Store Connect → 지급 및 재무 보고서</small>
                  </label>
                  <label>
                    Google 보고서 버킷 ID
                    <input
                      name="bucket"
                      placeholder="pubsite_prod_… 또는 pubsite_prod_rev_…"
                      defaultValue={connection.settings.bucket}
                    />
                    <small>
                      Play Console → 보고서 다운로드 → Cloud Storage URI
                    </small>
                  </label>
                </div>
                <label>
                  Google 패키지명{" "}
                  <span className="rev-muted">
                    선택 · 자동 목록 조회가 안 될 때
                  </span>
                  <textarea
                    name="packages"
                    rows={2}
                    placeholder="com.example.app"
                    defaultValue={connection.settings.packages.join("\n")}
                  />
                </label>
              </DataForm>
              </>
            ) : (
              <div className="rev-notice rev-notice-warn">
                {connectionError ||
                  (isRevenueCloudMode()
                    ? "클라우드 동기화에 연결되지 않았습니다."
                    : "로컬 수익 커넥터가 응답하지 않습니다.")}
                <p>
                  {isRevenueCloudMode()
                    ? "배포 환경에서는 로그인 계정으로 Apple·Google 보고서를 가져옵니다. API 키는 서버 환경 변수에만 보관됩니다."
                    : "PC: npm run revenue:connector · 휴대폰: 배포 사이트 로그인 후 동기화 · API 키는 서버에만 보관합니다."}
                </p>
                <Action
                  onClick={() => {
                    setConnectorHealth("checking");
                    void connector<Connection>("/status")
                      .then((c) => {
                        setConnection(c);
                        setConnectionError("");
                        setConnectorHealth("online");
                      })
                      .catch((e) => {
                        setConnectorHealth("offline");
                        setToast(e.message);
                      });
                  }}
                >
                  연결 다시 확인
                </Action>
              </div>
            )}
            <p className="rev-caption">
              키 파일은 브라우저로 전송하지 않습니다. 이 미리보기의 자동 연결은
              현재 컴퓨터의 개인용 연결 서버를 사용합니다. 공개 배포 환경은
              사용자별 인증 서버 설정이 필요합니다. Google 빌드 조회용 임시
              세션은 조회 후 폐기하며 앱을 배포하지 않습니다.
            </p>
          </section>
          <div className="rev-overview-grid">
            <section className="rev-card">
              {sectionHeader(
                "파일과 환율",
                "원본 통화를 보존하고 원화로 비교합니다",
              )}
              <div
                className={`rev-dropzone ${dropActive ? "is-active" : ""}`}
                onDragEnter={(e) => {
                  e.preventDefault();
                  setDropActive(true);
                }}
                onDragOver={(e) => e.preventDefault()}
                onDragLeave={() => setDropActive(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDropActive(false);
                  void importFiles(e.dataTransfer.files);
                }}
                onClick={() => fileInput.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") fileInput.current?.click();
                }}
              >
                <Icon name="upload" />
                <div>
                  <b>보고서를 끌어다 놓거나 클릭</b>
                  <small>여러 파일·ZIP 한 번에 · Apple TXT · Google CSV</small>
                </div>
              </div>
              <div className="rev-tool-list">
                <button onClick={() => fileInput.current?.click()}>
                  <Icon name="upload" />
                  <div>
                    <b>파일 선택</b>
                    <small>Apple TXT · Google CSV · ZIP · GZIP</small>
                  </div>
                  <Icon name="chevron" size={17} />
                </button>
                <button
                  onClick={() =>
                    download("앱수익_입력양식.csv", "\uFEFF" + csvTemplate)
                  }
                >
                  <Icon name="download" />
                  <div>
                    <b>표준 CSV 양식</b>
                    <small>직접 정리한 매출과 수익 가져오기</small>
                  </div>
                  <Icon name="chevron" size={17} />
                </button>
                <button
                  onClick={() => {
                    void (async () => {
                      const codes = neededCurrencies(data.rows, month);
                      if (!codes.length) {
                        setDialog("rates");
                        return;
                      }
                      setBusy(true);
                      setProgress("환율 자동 조회 중…");
                      try {
                        const fetched = await fetchMonthRatesKrw(month, codes);
                        update((d) => ({
                          ...d,
                          rates: { ...d.rates, ...fetched },
                        }));
                        setToast(
                          Object.keys(fetched).length
                            ? `환율 ${Object.keys(fetched).length}건 반영`
                            : "자동 환율을 받지 못했습니다. 수동 입력으로 전환합니다.",
                        );
                      } finally {
                        setBusy(false);
                        setProgress("");
                        setDialog("rates");
                      }
                    })();
                  }}
                >
                  <Icon name="wallet" />
                  <div>
                    <b>{monthLabel(month)} 환산 기준</b>
                    <small>자동 조회 · 통화별 원화 환율</small>
                  </div>
                  <Icon name="chevron" size={17} />
                </button>
              </div>
            </section>
            <section className="rev-card">
              {sectionHeader(
                "백업과 복원",
                "이 브라우저의 데이터를 파일로 안전하게 보관하세요",
              )}
              <p className="rev-body-copy">
                매출·앱·비용·정산·세무 검토 기록을 한 번에 저장합니다. API
                비밀키는 백업에 포함되지 않습니다.
              </p>
              <div className="rev-inline-actions">
                <Action
                  icon="download"
                  onClick={() =>
                    download(
                      `${demo ? "샘플_" : ""}앱수익_백업_${localDate()}.json`,
                      JSON.stringify(data, null, 2),
                      "application/json",
                    )
                  }
                >
                  백업 다운로드
                </Action>
                <Action
                  icon="upload"
                  onClick={() => backupInput.current?.click()}
                >
                  백업 복원
                </Action>
              </div>
              <small className="rev-muted">
                {demo ? "샘플 저장소" : "현재 브라우저 · 계정별 저장소"} ·{" "}
                {data.rows.length}건 보관 중
              </small>
            </section>
          </div>
          <section className="rev-card">
            {sectionHeader(
              "동기화 기록",
              "오류가 발생해도 기존 데이터는 유지됩니다",
            )}
            <div className="rev-log-list">
              {data.logs.length ? (
                data.logs.slice(0, 12).map((l) => (
                  <article key={l.id} className="rev-sync-report">
                    <span
                      className={`rev-badge ${l.status === "success" ? "positive" : "amber"}`}
                    >
                      {l.status === "success"
                        ? "완료"
                        : l.status === "partial"
                          ? "일부 완료"
                          : "실패"}
                    </span>
                    <div>
                      <time>{new Date(l.at).toLocaleString("ko-KR")}</time>
                      <p>{l.message}</p>
                      {l.detail ? (
                        <ul className="rev-sync-detail">
                          {l.detail.apps != null ? (
                            <li>앱 {l.detail.apps}개</li>
                          ) : null}
                          {l.detail.documents != null ? (
                            <li>보고서 {l.detail.documents}개</li>
                          ) : null}
                          {l.detail.appleMonths != null ? (
                            <li>Apple {l.detail.appleMonths}개월</li>
                          ) : null}
                          {l.detail.googleMonths != null ? (
                            <li>Google {l.detail.googleMonths}개월</li>
                          ) : null}
                          {(l.detail.completed || []).slice(0, 4).map((c) => (
                            <li key={c}>✓ {c}</li>
                          ))}
                          {(l.detail.errors || []).slice(0, 4).map((e) => (
                            <li key={e} className="is-error">
                              ! {e}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  </article>
                ))
              ) : (
                <p className="rev-muted">아직 동기화 기록이 없습니다.</p>
              )}
            </div>
          </section>
          <section className="rev-card">
            {sectionHeader(
              "가져온 보고서",
              `${data.imports.length}개 · 같은 이름의 보고서를 다시 가져오면 해당 자료를 대체합니다`,
            )}
            <div className="rev-log-list">
              {data.imports
                .slice(-10)
                .reverse()
                .map((i) => (
                  <article key={i.key}>
                    <Icon name="receipt" />
                    <div>
                      <b>{i.name}</b>
                      <p>
                        {i.rows}행 ·{" "}
                        {new Date(i.importedAt).toLocaleString("ko-KR")}
                      </p>
                    </div>
                  </article>
                ))}
            </div>
          </section>
        </>
      )}

      <footer className="rev-page-footer">
        <span>
          <Icon name="shield" size={14} />{" "}
          {demo
            ? "샘플 데이터"
            : cloudNote || "브라우저 저장 · 로그인 시 클라우드 공유"}{" "}
          · 금액 단위 KRW
        </span>
        <span>원본 보고서와 함께 확인하세요.</span>
      </footer>
      <input
        className="rev-sr-only"
        ref={fileInput}
        type="file"
        accept=".csv,.txt,.tsv,.zip,.gz"
        multiple
        onChange={(e) => void importFiles(e.target.files)}
        aria-label="보고서 파일 선택"
      />
      <input
        className="rev-sr-only"
        ref={backupInput}
        type="file"
        accept=".json"
        aria-label="백업 파일 선택"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f)
            void (async () => {
              try {
                if (f.size > 25 * 1024 * 1024)
                  throw new Error("백업은 25MB 이하만 지원합니다.");
                setRestore(validateBackup(JSON.parse(await f.text())));
              } catch (err) {
                setToast(err instanceof Error ? err.message : "복원 실패");
              } finally {
                if (backupInput.current) backupInput.current.value = "";
              }
            })();
        }}
      />
      {renderDialogs()}
    </main>
  );

  function setUndo(previous: RevenueData) {
    setRestoreUndo(previous);
    setToast("기록을 삭제했습니다. 아래 버튼으로 되돌릴 수 있습니다.");
  }
  function renderDialogs() {
    return (
      <>
        {undo && (
          <div className="rev-undo" role="status">
            삭제한 기록을 되돌릴 수 있어요.
            <button
              onClick={() => {
                update(undo);
                setRestoreUndo(null);
                setToast("삭제를 취소했습니다.");
              }}
            >
              되돌리기
            </button>
            <button
              aria-label="되돌리기 알림 닫기"
              onClick={() => setRestoreUndo(null)}
            >
              ×
            </button>
          </div>
        )}
        {importPreview && (
          <RevenueDialog
            title="보고서 가져오기"
            description="검토한 뒤 반영해 주세요."
            close={() => setImportPreview(null)}
          >
            <div className="rev-import-preview">
              {importPreview.map((r) => (
                <div key={r.document.key}>
                  <b>{r.document.name}</b>
                  <span>
                    {r.rows.length}행 ·{" "}
                    {new Set(r.rows.map((x) => x.currency)).size}개 통화
                  </span>
                </div>
              ))}
            </div>
            <p className="rev-caption">
              같은 보고서는 대체하며 동일 거래는 중복 반영하지 않습니다. API로
              동기화한 자료와 파일 수입을 함께 사용할 때는 같은 기간의 원본인지
              확인해 주세요.
            </p>
            <div className="rev-dialog-actions">
              <Action onClick={() => setImportPreview(null)}>취소</Action>
              <Action
                primary
                onClick={() => {
                  let next: RevenueData | null = null;
                  update((d) => {
                    next = mergeReports(d, importPreview);
                    return next;
                  });
                  if (next) void saveCloud(next);
                  const row = importPreview[0]?.rows[0];
                  if (row) {
                    setMonth(row.period);
                    setBasis(row.basis);
                  }
                  setImportPreview(null);
                  setSection("transactions");
                  setToast("보고서를 반영했습니다. 클라우드에도 저장을 시도합니다.");
                }}
              >
                보고서 반영
              </Action>
            </div>
          </RevenueDialog>
        )}
        {restore && (
          <RevenueDialog
            title="백업으로 복원"
            description={`앱 ${restore.apps.length}개 · 거래 ${restore.rows.length}건`}
            close={() => setRestore(null)}
          >
            <p className="rev-body-copy">
              현재 앱 수익 데이터를 이 백업 내용으로 바꿉니다. 먼저 현재 백업을
              내려받아 보관할 수 있습니다.
            </p>
            <div className="rev-dialog-actions">
              <Action
                icon="download"
                onClick={() =>
                  download(
                    "복원전_앱수익_백업.json",
                    JSON.stringify(data),
                    "application/json",
                  )
                }
              >
                현재 백업
              </Action>
              <Action
                primary
                onClick={() => {
                  update(restore);
                  setRestore(null);
                  setAppFilter("all");
                  setToast("백업을 복원했습니다.");
                }}
              >
                복원 적용
              </Action>
            </div>
          </RevenueDialog>
        )}
        {dialog === "goal" && (
          <RevenueDialog
            title="월 수익 목표"
            description="목표는 모든 앱의 개발자 수익 기준입니다."
            close={closeDialog}
          >
            <DataForm
              cancel={closeDialog}
              submit={(f) => {
                update((d) => ({ ...d, goal: fieldNumber(f, "goal") }));
                saveMessage();
              }}
            >
              <label>
                목표 금액 (원)
                <input
                  name="goal"
                  type="number"
                  min="0"
                  step="1"
                  required
                  defaultValue={data.goal || ""}
                  placeholder="10000000"
                  autoFocus
                />
              </label>
            </DataForm>
          </RevenueDialog>
        )}
        {dialog === "rates" && (
          <RevenueDialog
            title="환율 관리"
            description={`${monthLabel(month)} · 외화 1단위당 원화 환율`}
            close={closeDialog}
          >
            <DataForm
              cancel={closeDialog}
              submit={(f) => {
                const c = fieldText(f, "currency").toUpperCase();
                if (!/^[A-Z]{3}$/.test(c) || c === "KRW")
                  throw new Error("외화의 3자리 통화 코드를 입력해 주세요.");
                const v = fieldNumber(f, "rate");
                if (v <= 0) throw new Error("환율은 0보다 커야 합니다.");
                update((d) => ({
                  ...d,
                  rates: {
                    ...d.rates,
                    [`${month}:${c}`]: { value: v, note: fieldText(f, "note") },
                  },
                }));
                saveMessage();
              }}
            >
              <div className="rev-rate-list">
                {pendingCurrency.map((c) => (
                  <div key={c}>
                    <b>{c}</b>
                    <span>
                      {data.rates[`${month}:${c}`]
                        ? `₩${money(data.rates[`${month}:${c}`].value)}`
                        : "미입력"}
                    </span>
                  </div>
                ))}
              </div>
              <div className="rev-form-grid">
                <label>
                  통화 코드
                  <input
                    name="currency"
                    required
                    pattern="[A-Za-z]{3}"
                    maxLength={3}
                    placeholder="USD"
                    defaultValue={pendingCurrency[0] || ""}
                  />
                </label>
                <label>
                  1단위당 원화
                  <input
                    name="rate"
                    required
                    type="number"
                    min="0.0001"
                    step="0.0001"
                    placeholder="직접 입력"
                  />
                </label>
              </div>
              <label>
                환율 근거
                <input
                  name="note"
                  required
                  placeholder="적용일·은행·정산 명세서 등"
                />
              </label>
              <p className="rev-caption">
                환율을 임의로 자동 지정하지 않습니다. 화면 비교용 월 환율이며
                신고 공급가액은 별도로 검토합니다.
              </p>
            </DataForm>
          </RevenueDialog>
        )}
        {dialog === "business" && (
          <RevenueDialog title="사업자 정보" close={closeDialog}>
            <DataForm
              cancel={closeDialog}
              submit={(f) => {
                update((d) => ({
                  ...d,
                  business: {
                    name: fieldText(f, "name"),
                    number: fieldText(f, "number"),
                    kind: fieldText(f, "kind") as "general" | "simplified",
                    prepaid: {
                      ...d.business.prepaid,
                      [`${taxYear}-${taxHalf}`]: fieldNumber(f, "prepaid"),
                    },
                  },
                }));
                saveMessage();
              }}
            >
              <label>
                상호
                <input name="name" required defaultValue={data.business.name} />
              </label>
              <label>
                사업자등록번호
                <input
                  name="number"
                  placeholder="000-00-00000"
                  pattern="[0-9]{3}-[0-9]{2}-[0-9]{5}"
                  required
                  defaultValue={data.business.number}
                />
              </label>
              <label>
                과세 유형
                <select name="kind" defaultValue={data.business.kind}>
                  <option value="general">일반과세자</option>
                  <option value="simplified">
                    간이과세자 · 세액 자동 계산 제외
                  </option>
                </select>
              </label>
              <label>
                선택 기간의 기납부세액 (원)
                <input
                  name="prepaid"
                  type="number"
                  min="0"
                  step="1"
                  required
                  defaultValue={
                    data.business.prepaid[`${taxYear}-${taxHalf}`] || 0
                  }
                />
              </label>
            </DataForm>
          </RevenueDialog>
        )}
        {dialog === "expense" && (
          <RevenueDialog title="운영비 추가" close={closeDialog}>
            <DataForm
              cancel={closeDialog}
              submit={(f) => {
                const amount = fieldNumber(f, "amount"),
                  vat = fieldNumber(f, "vat");
                if (vat > amount)
                  throw new Error("매입세액은 지출액을 넘을 수 없습니다.");
                update((d) => ({
                  ...d,
                  expenses: [
                    ...d.expenses,
                    {
                      id: crypto.randomUUID(),
                      date: fieldText(f, "date"),
                      name: fieldText(f, "name"),
                      category: fieldText(f, "category"),
                      amount,
                      inputVat: vat,
                      deductible: f.get("deductible") === "on",
                      evidence: fieldText(f, "evidence"),
                    },
                  ],
                }));
                saveMessage();
              }}
            >
              <div className="rev-form-grid">
                <label>
                  지출일
                  <input
                    name="date"
                    type="date"
                    required
                    defaultValue={`${month}-01`}
                  />
                </label>
                <label>
                  분류
                  <select name="category">
                    <option>서버</option>
                    <option>광고</option>
                    <option>소프트웨어</option>
                    <option>외주</option>
                    <option>기타</option>
                  </select>
                </label>
              </div>
              <label>
                비용명
                <input name="name" required placeholder="예: 앱 검색 광고" />
              </label>
              <div className="rev-form-grid">
                <label>
                  총 지출액 (원)
                  <input
                    name="amount"
                    type="number"
                    min="0"
                    step="1"
                    required
                  />
                </label>
                <label>
                  증빙상 매입세액 (원)
                  <input
                    name="vat"
                    type="number"
                    min="0"
                    step="1"
                    required
                    defaultValue="0"
                  />
                </label>
              </div>
              <label>
                증빙 번호 / 보관 위치
                <input
                  name="evidence"
                  placeholder="세금계산서 번호 또는 보관 위치"
                />
              </label>
              <label className="rev-check-label">
                <input name="deductible" type="checkbox" />
                공제 대상임을 확인한 매입세액
              </label>
            </DataForm>
          </RevenueDialog>
        )}
        {dialog === "payout" && (
          <RevenueDialog title="정산 입금 기록" close={closeDialog}>
            <DataForm
              cancel={closeDialog}
              submit={(f) => {
                update((d) => ({
                  ...d,
                  payouts: [
                    ...d.payouts,
                    {
                      id: crypto.randomUUID(),
                      platform: fieldText(f, "platform") as Platform,
                      month: fieldText(f, "month"),
                      dueDate: fieldText(f, "dueDate"),
                      expected: fieldNumber(f, "expected"),
                      received: fieldNumber(f, "received"),
                      receivedDate: fieldText(f, "receivedDate"),
                      memo: fieldText(f, "memo"),
                    },
                  ],
                }));
                saveMessage();
              }}
            >
              <div className="rev-form-grid">
                <label>
                  스토어
                  <select name="platform">
                    <option value="apple">App Store</option>
                    <option value="google">Google Play</option>
                  </select>
                </label>
                <label>
                  매출 귀속월
                  <input
                    name="month"
                    type="month"
                    required
                    defaultValue={shiftMonth(month, -1)}
                  />
                </label>
              </div>
              <div className="rev-form-grid">
                <label>
                  입금 예정일
                  <input
                    name="dueDate"
                    type="date"
                    required
                    defaultValue={`${month}-15`}
                  />
                </label>
                <label>
                  실제 입금일
                  <input name="receivedDate" type="date" />
                </label>
              </div>
              <div className="rev-form-grid">
                <label>
                  예상 정산액 (원)
                  <input
                    name="expected"
                    required
                    type="number"
                    min="0"
                    step="1"
                  />
                </label>
                <label>
                  실제 입금액 (원)
                  <input
                    name="received"
                    required
                    type="number"
                    min="0"
                    step="1"
                    defaultValue="0"
                  />
                </label>
              </div>
              <label>
                메모
                <input name="memo" placeholder="환전·송금 수수료 등" />
              </label>
            </DataForm>
          </RevenueDialog>
        )}
        {dialog === "app" && (
          <RevenueDialog
            title={editingApp ? "앱 정보 편집" : "앱 직접 등록"}
            close={closeDialog}
          >
            <DataForm
              cancel={closeDialog}
              submit={(f) => {
                const p = fieldText(f, "platform") as Platform;
                const id =
                  editingApp?.id || `${p}:${fieldText(f, "identifier")}`;
                if (!editingApp && data.apps.some((a) => a.id === id))
                  throw new Error("이미 등록된 앱입니다.");
                const a: AppProduct = {
                  id,
                  name: fieldText(f, "name"),
                  platform: p,
                  bundleId: fieldText(f, "bundleId"),
                  version: fieldText(f, "version"),
                  build: fieldText(f, "build"),
                  status: fieldText(f, "status"),
                  updatedAt: new Date().toISOString(),
                  source: editingApp?.source || "manual",
                  favorite: editingApp?.favorite,
                };
                update((d) => ({
                  ...d,
                  apps: [...d.apps.filter((x) => x.id !== id), a],
                }));
                saveMessage();
              }}
            >
              <label>
                앱 이름
                <input name="name" required defaultValue={editingApp?.name} />
              </label>
              <label>
                스토어
                <select
                  name="platform"
                  defaultValue={editingApp?.platform || "apple"}
                >
                  {(editingApp
                    ? [editingApp.platform]
                    : (["apple", "google"] as const)
                  ).map((p) => (
                    <option key={p} value={p}>
                      {platformName[p as Platform]}
                    </option>
                  ))}
                </select>
              </label>
              {!editingApp && (
                <label>
                  Apple ID / Google 패키지명
                  <input
                    name="identifier"
                    required
                    placeholder="숫자 Apple ID 또는 com.example.app"
                  />
                </label>
              )}
              <label>
                번들 ID / 패키지명
                <input
                  name="bundleId"
                  defaultValue={editingApp?.bundleId}
                  placeholder="com.example.app"
                />
              </label>
              <div className="rev-form-grid">
                <label>
                  버전
                  <input name="version" defaultValue={editingApp?.version} />
                </label>
                <label>
                  빌드 번호
                  <input name="build" defaultValue={editingApp?.build} />
                </label>
              </div>
              <label>
                현재 상태
                <input
                  name="status"
                  required
                  defaultValue={editingApp?.status || "확인 전"}
                />
              </label>
              {editingApp?.source === "api" && (
                <p className="rev-caption">
                  API 동기화 시 스토어의 최신 이름과 상태로 갱신됩니다.
                </p>
              )}
            </DataForm>
          </RevenueDialog>
        )}
        {taxRow && (
          <RevenueDialog
            title="과세 구분 검토"
            description={`${taxRow.appName} · ${taxRow.date}`}
            close={() => setTaxRow(null)}
          >
            <DataForm
              cancel={() => setTaxRow(null)}
              submit={(f) => {
                const category = fieldText(f, "taxClass") as TaxClass;
                const supply =
                  category === "excluded" ? 0 : fieldNumber(f, "supply", true);
                const vat =
                  category === "taxable" ? fieldNumber(f, "vat", true) : 0;
                const evidence = fieldText(f, "evidence");
                if (category !== "excluded" && !evidence)
                  throw new Error("검토한 증빙을 입력해 주세요.");
                update((d) => ({
                  ...d,
                  rows: d.rows.map((r) =>
                    r.id === taxRow.id
                      ? {
                          ...r,
                          taxClass: category,
                          supplyAmount: supply,
                          outputVat: vat,
                          evidence,
                          taxDate: fieldText(f, "taxDate"),
                        }
                      : r,
                  ),
                }));
                setTaxRow(null);
                setToast("과세 구분과 검토 금액을 저장했습니다.");
              }}
            >
              <label>
                매출 귀속일
                <input
                  name="taxDate"
                  type="date"
                  required
                  defaultValue={taxRow.taxDate || taxRow.date}
                />
              </label>
              <label>
                세무 분류
                <select
                  name="taxClass"
                  defaultValue={
                    taxRow.taxClass === "unreviewed"
                      ? "taxable"
                      : taxRow.taxClass
                  }
                >
                  {(
                    ["taxable", "zero", "exempt", "excluded"] as TaxClass[]
                  ).map((c) => (
                    <option key={c} value={c}>
                      {taxLabels[c]}
                    </option>
                  ))}
                </select>
              </label>
              <div className="rev-form-grid">
                <label>
                  검토한 공급가액 (원)
                  <input
                    name="supply"
                    type="number"
                    step="1"
                    defaultValue={taxRow.supplyAmount ?? ""}
                  />
                </label>
                <label>
                  검토한 매출세액 (원)
                  <input
                    name="vat"
                    type="number"
                    step="1"
                    defaultValue={taxRow.outputVat ?? ""}
                  />
                </label>
              </div>
              <label>
                증빙 / 검토 근거
                <input
                  name="evidence"
                  defaultValue={taxRow.evidence}
                  placeholder="정산서 번호·계약·세무 검토 내용"
                />
              </label>
              <p className="rev-caption">
                스토어 국가만으로 영세율을 적용하지 않습니다. 환불·취소 거래는
                검토된 음수 금액을 입력할 수 있습니다.
              </p>
            </DataForm>
          </RevenueDialog>
        )}
      </>
    );
  }
}
