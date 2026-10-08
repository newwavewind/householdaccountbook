import type { Basis, RevenueRow } from "./types";

/** Source is inferred for old backups without rewriting the original records. */
export function reportSource(row: RevenueRow): NonNullable<RevenueRow["source"]> {
  if (row.source) return row.source;
  const key = row.reportKey.toLowerCase();
  if (row.platform === "apple") {
    if (/apple[-:]finance|financial/.test(key)) return "apple-finance";
    if (/apple[-:]sales|(?:^|[:/])s_[dmwy]_/.test(key)) return "apple-sales";
  } else {
    if (/earnings/.test(key)) return "google-earnings";
    if (/salesreport|google.*sales/.test(key)) return "google-sales";
  }
  return "standard";
}

/** A filename identifies a report shard; adjustment files must stay separate. */
export function reportScopeFromKey(key: string, source: string): string | undefined {
  if (source === "google-sales" || source === "google-earnings") {
    // Keep archive AND entry path: adjustment archives and nested CSV shards
    // can have the same entry basename but contain additional transactions.
    const archived = /([^:/\\]+\.zip):(.+\.csv)$/i.exec(key);
    if (archived && /^(salesreport|earnings)_\d{6}/i.test(archived[1]))
      return `${source}:${archived[1].toLowerCase()}:${archived[2].replaceAll("\\", "/").toLowerCase()}`;
    const file = key.split(/[:/\\]/).at(-1);
    if (file && /^(salesreport|earnings)_\d{6}.*\.csv$/i.test(file))
      return `${source}:${file.replace(/\.csv$/i, ".zip").toLowerCase()}:${file.toLowerCase()}`;
  }
  if (/^apple-(sales-month|sales|finance):/.test(key)) return key;
  return undefined;
}

function isAppleMonthly(row: RevenueRow): boolean {
  if (reportSource(row) !== "apple-sales") return false;
  if (/apple-sales-month:|(?:^|[:/])s_m_/i.test(row.reportKey)) return true;
  const end = row.endDate;
  if (!end || row.date.slice(0, 7) !== end.slice(0, 7)) return false;
  const next = new Date(`${end}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return row.date.endsWith("-01") && next.getUTCDate() === 1;
}

/**
 * Sales and final financial reports are different bases. Never mix Apple fiscal
 * periods with calendar sales months. Within sales, a full monthly report wins
 * over its daily snapshots; all source records remain available in storage.
 */
export function selectRevenueRows(rows: RevenueRow[], basis?: Basis) {
  const candidates = basis ? rows.filter((row) => row.basis === basis) : rows;
  const monthlyRows = candidates.filter(isAppleMonthly);
  const monthly = new Set(monthlyRows.filter((row) => /^apple-sales-month:/.test(row.reportKey)).map((row) => row.period));
  const coverageKey = (row: RevenueRow) => [row.period, row.appId, row.country, row.currency, row.proceedsCurrency].join("|");
  // A manually imported monthly file may cover only one app or territory.
  const manualCoverage = new Set(monthlyRows.map(coverageKey));
  const preferred = new Map<string, RevenueRow>();
  for (const row of candidates) {
    const previous = preferred.get(row.id);
    if (!previous || compareGoogleOrderProceeds(row, previous) > 0) preferred.set(row.id, row);
  }
  const seen = new Set<string>();
  const excludedRows: RevenueRow[] = [];
  const selected = candidates.filter((row) => {
    const duplicate = seen.has(row.id) || preferred.get(row.id) !== row;
    if (!duplicate) seen.add(row.id);
    const overlap = row.basis === "estimate" &&
      reportSource(row) === "apple-sales" && (monthly.has(row.period) || manualCoverage.has(coverageKey(row))) &&
      !isAppleMonthly(row);
    if (duplicate || overlap) excludedRows.push(row);
    return !duplicate && !overlap;
  });
  return { rows: selected, excludedRows, excludedOverlapRows: excludedRows.length };
}

/** Only explicitly attributed, timestamped API amounts can enrich sales rows. */
export function hasVerifiedGoogleOrderProceeds(row: RevenueRow): boolean {
  return row.platform === "google" && row.basis === "estimate" && reportSource(row) === "google-sales" &&
    row.proceedsSource === "google-orders" && typeof row.proceeds === "number" && Number.isFinite(row.proceeds) &&
    typeof row.proceedsFetchedAt === "string" && Number.isFinite(Date.parse(row.proceedsFetchedAt));
}

/** Legacy imported Google sales contain an unsupported automatic fee/net guess. */
export function hasUnverifiedGoogleProceeds(row: RevenueRow): boolean {
  return row.platform === "google" && row.basis === "estimate" &&
    reportSource(row) === "google-sales" && !hasVerifiedGoogleOrderProceeds(row);
}


/** Resolve duplicate raw sales identities after net is allocated once per order.
 * Latest snapshots win, including a genuine new zero. In one snapshot retain
 * the allocated amount instead of a zero attached to a duplicate CSV row. */
export function compareGoogleOrderProceeds(left: RevenueRow, right: RevenueRow): number {
  const a = hasVerifiedGoogleOrderProceeds(left), b = hasVerifiedGoogleOrderProceeds(right);
  if (a !== b) return a ? 1 : -1;
  if (!a || !b) return 0;
  return Date.parse(left.proceedsFetchedAt!) - Date.parse(right.proceedsFetchedAt!) ||
    Math.abs(left.proceeds!) - Math.abs(right.proceeds!);
}
