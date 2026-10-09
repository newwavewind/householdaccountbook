import { gunzipSync, unzipSync, strFromU8 } from "fflate";
import { validDate } from "./model";
import type { GoogleOrderProceeds, RevenueData, RevenueRow, StoreDocument } from "./types";
import { compareGoogleOrderProceeds, hasVerifiedGoogleOrderProceeds, reportScopeFromKey, reportSource } from "./reportSelection";
import { resolveAppleReportAppKey } from "./appMatch";

export function parseDelimited(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const delimiter = source.split("\n")[0].includes("\t") ? "\t" : ",";
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (c === '"') {
      if (quoted && source[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (!quoted && (c === delimiter || c === "\n")) {
      row.push(cell.trim());
      cell = "";
      if (c === "\n") {
        if (row.some(Boolean)) rows.push(row);
        row = [];
      }
    } else cell += c;
  }
  if (quoted)
    throw new Error("닫히지 않은 따옴표가 있습니다. CSV 형식을 확인해 주세요.");
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}
function numeric(value: string, optional = false) {
  if (!value && optional) return 0;
  if (!value) throw new Error("필수 금액이 비어 있습니다.");
  const n = Number(value.replaceAll(",", ""));
  if (!Number.isFinite(n) || Math.abs(n) > 1e13)
    throw new Error(`올바르지 않은 금액: ${value.slice(0, 40)}`);
  return n;
}
export function reportDate(value: string) {
  let result = value;
  const slash = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const english = value.match(/^([A-Za-z]{3})\s+(\d{1,2}),?\s+(\d{4})$/);
  if (slash)
    result = `${slash[3]}-${slash[1].padStart(2, "0")}-${slash[2].padStart(2, "0")}`;
  else if (/^\d{8}$/.test(value))
    result = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6)}`;
  else if (english)
    result = `${english[3]}-${String(["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].indexOf(english[1]) + 1).padStart(2, "0")}-${english[2].padStart(2, "0")}`;
  if (!validDate(result))
    throw new Error(`올바르지 않은 날짜: ${value.slice(0, 30)}`);
  return result;
}
async function digest(text: string) {
  return [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)),
    ),
  ]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
export async function parseReport(doc: StoreDocument): Promise<RevenueRow[]> {
  const table = parseDelimited(doc.text);
  if (table.length < 2) throw new Error("보고서에 데이터가 없습니다.");
  const header = table[0].map((cell) => cell.trim());
  const has = (name: string) => header.some((cell) => cell.toLowerCase() === name.toLowerCase());
  const financial = has("Partner Share");
  const apple = financial || has("Developer Proceeds");
  const google =
    has("Transaction Type") &&
    has("Amount (Merchant Currency)");
  const sales =
    has("Order Number") && has("Charged Amount");
  const canonical = has("date") && has("proceeds");
  if (!apple && !google && !sales && !canonical)
    throw new Error(
      "지원 형식: Apple 판매·재무 TXT, Google 예상 매출·수익 CSV, 표준 CSV 양식",
    );
  const source: NonNullable<RevenueRow["source"]> = financial ? "apple-finance" :
    apple ? "apple-sales" : google ? "google-earnings" : sales ? "google-sales" : "standard";
  const googleOrders = new Map<number, GoogleOrderProceeds>();
  if (doc.googleOrderProceeds !== undefined) {
    if (source !== "google-sales" || !Array.isArray(doc.googleOrderProceeds))
      throw new Error("Google 주문 수익은 Google 판매 보고서에만 연결할 수 있습니다.");
    const statusIndex = header.findIndex((cell) => cell.toLowerCase() === "financial status");
    for (const entry of doc.googleOrderProceeds) {
      const validTimestamp = entry && typeof entry.fetchedAt === "string" &&
        /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.test(entry.fetchedAt) &&
        validDate(entry.fetchedAt.slice(0, 10)) && Number.isFinite(Date.parse(entry.fetchedAt));
      if (!entry || !Number.isInteger(entry.rowIndex) || entry.rowIndex < 0 || entry.rowIndex >= table.length - 1 ||
        typeof entry.proceeds !== "number" || !Number.isFinite(entry.proceeds) || Math.abs(entry.proceeds) > 1e13 ||
        typeof entry.currency !== "string" || !/^[A-Z]{3}$/.test(entry.currency) || !validTimestamp)
        throw new Error("Google 주문 수익의 행 번호·금액·통화·조회 시각을 확인해 주세요.");
      if (googleOrders.has(entry.rowIndex))
        throw new Error("같은 판매 행에 Google 주문 수익이 두 번 연결되어 있습니다.");
      const state = table[entry.rowIndex + 1][statusIndex]?.toLowerCase().trim();
      if (!["charged", "refund", "refunded", "partial refund"].includes(state))
        throw new Error("Google 주문 수익이 유효한 판매·환불 행에 연결되지 않았습니다.");
      googleOrders.set(entry.rowIndex, entry);
    }
  }
  const reportScope = reportScopeFromKey(doc.key, source) || reportScopeFromKey(doc.name, source);
  const filenameMonth = /(?:salesreport|earnings)_(\d{4})(\d{2})/i.exec(`${doc.key} ${doc.name}`);
  const documentPeriod = doc.period || (filenameMonth ? `${filenameMonth[1]}-${filenameMonth[2]}` : "");
  const occurrences = new Map<string, number>();
  const result: RevenueRow[] = [];
  for (const [index, cells] of table.slice(1).entries()) {
    if (
      cells[0]?.startsWith("Total_Rows") ||
      cells[0]?.startsWith("Total Rows")
    ) {
      // The consolidated Apple finance file ends its transaction table with
      // Total_Rows, then appends a country/currency summary. That summary is
      // already represented by the transactions and must never be added again.
      if (financial) break;
      continue;
    }
    const get = (...names: string[]) => {
      for (const n of names) {
        const i = header.findIndex((cell) => cell.toLowerCase() === n.toLowerCase());
        if (i >= 0 && cells[i]) return cells[i];
      }
      return "";
    };
    try {
      let row: RevenueRow;
      const base = {
        id: "",
        reportKey: doc.key,
        country: "",
        taxClass: "unreviewed" as const,
        source,
        reportScope,
        periodKind: financial ? "fiscal" as const : "calendar" as const,
      };
      if (apple) {
        const date = reportDate(get(financial ? "Start Date" : "Begin Date"));
        const endDate = get("End Date") ? reportDate(get("End Date")) : date;
        const units = numeric(get(financial ? "Quantity" : "Units"));
        const price = Math.abs(numeric(get("Customer Price")));
        const perUnit = numeric(
          get(financial ? "Partner Share" : "Developer Proceeds"),
        );
        const isRefund = units < 0 || get("Sales or Return", "Sale or Return") === "R";
        const total = financial
          ? numeric(get("Extended Partner Share"))
          : perUnit * units;
        row = {
          ...base,
          date,
          endDate,
          period: documentPeriod || (financial ? endDate : date).slice(0, 7),
          appId: `apple:${resolveAppleReportAppKey(get)}`,
          appName: get("Title"),
          platform: "apple",
          country: get("Country of Sale", "Country Code"),
          currency: get("Customer Currency"),
          proceedsCurrency:
            (get("Partner Share Currency", "Currency of Proceeds") || "").trim() ||
            get("Customer Currency"),
          gross: isRefund ? 0 : price * Math.abs(units),
          refunds: isRefund ? price * Math.abs(units) : 0,
          fee: null,
          tax: null,
          proceeds: isRefund ? -Math.abs(total) : total,
          units: isRefund ? -Math.abs(units) : units,
          basis: financial ? "settled" : "estimate",
        };
      } else if (google) {
        const date = reportDate(get("Transaction Date", "Transaction Date & Time"));
        const amount = numeric(get("Amount (Merchant Currency)"));
        const type = get("Transaction Type").toLowerCase();
        const fee = type.includes("fee"),
          tax = type.includes("tax"),
          refund = type.includes("refund") && !fee && !tax;
        const charge = type === "charge" || type === "charge rebill";
        // Account-wide adjustments/chargeback fees have no app identity. They
        // still change the payout and must never be dropped from the report.
        const packageId = get("Package ID", "Product ID") || "__account_adjustments__";
        const title = (get("Product Title") ||
          (packageId === "__account_adjustments__" ? "계정 조정" : packageId)).replace(/\s+/g, " ").trim();
        row = {
          ...base,
          date,
          period: documentPeriod || date.slice(0, 7),
          appId: `google:${packageId}`,
          appName: title,
          platform: "google",
          country: get("Buyer Country", "Country of Buyer"),
          currency: get("Merchant Currency"),
          proceedsCurrency: get("Merchant Currency"),
          gross: charge ? amount : 0,
          refunds: refund ? -amount : 0,
          fee: fee ? -amount : 0,
          tax: tax ? -amount : 0,
          proceeds: amount,
          units: charge ? 1 : refund && get("Refund Type").toLowerCase() !== "partial" ? -1 : 0,
          basis: "settled",
        };
      } else if (sales) {
        const date = reportDate(get("Order Charged Date"));
        const state = get("Financial Status").toLowerCase().trim();
        if (!["charged", "refund", "refunded", "partial refund"].includes(state))
          continue; // skip cancelled / pending rows without failing the whole file
        const refund = state.includes("refund"),
          amount = Math.abs(numeric(get("Charged Amount")));
        const packageId = get("Package ID", "Product ID");
        const title = (get("Product Title") || packageId).replace(/\s+/g, " ").trim();
        const taxCollected = get("Taxes Collected")
          ? Math.abs(numeric(get("Taxes Collected")))
          : null;
        const country = get("Country of Buyer", "Buyer Country");
        const currency =
          get("Currency of Sale") || get("Buyer Currency");
        const gross = refund ? 0 : amount;
        const refunds = refund ? amount : 0;
        row = {
          ...base,
          date,
          period: documentPeriod || date.slice(0, 7),
          appId: `google:${packageId}`,
          appName: title,
          platform: "google",
          country,
          currency,
          proceedsCurrency: currency.trim(),
          gross,
          refunds,
          fee: null,
          tax: taxCollected === null ? null : refund ? -taxCollected : taxCollected,
          proceeds: null,
          units: state === "partial refund" ? 0 : refund ? -1 : 1,
          basis: "estimate",
        };
      } else {
        const date = reportDate(get("date"));
        if (!["apple", "google"].includes(get("platform")))
          throw new Error("platform은 apple 또는 google이어야 합니다.");
        if (!["estimate", "settled"].includes(get("basis")))
          throw new Error("basis는 estimate 또는 settled이어야 합니다.");
        row = {
          ...base,
          date,
          period: get("period") || date.slice(0, 7),
          appId: `${get("platform")}:${get("app_id")}`,
          appName: get("app_name"),
          platform: get("platform") as "apple" | "google",
          country: get("country"),
          currency: get("currency"),
          proceedsCurrency: get("proceeds_currency") || get("currency"),
          gross: numeric(get("gross")),
          refunds: numeric(get("refunds"), true),
          fee: get("fee") ? numeric(get("fee")) : null,
          tax: get("tax") ? numeric(get("tax")) : null,
          proceeds: get("proceeds") ? numeric(get("proceeds")) : null,
          units: numeric(get("units"), true),
          basis: get("basis") as "estimate" | "settled",
        };
      }
      const orderProceeds = googleOrders.get(index);
      if (orderProceeds) {
        if (orderProceeds.currency !== row.currency)
          throw new Error("Google 주문 수익 통화가 원본 판매 통화와 다릅니다.");
        // The server allocates the current order-net snapshot to the first
        // eligible row and zero to its other refund rows. Use that signed
        // amount as-is; subtracting CSV refunds again would double-count them.
        row.proceeds = orderProceeds.proceeds;
        row.proceedsCurrency = orderProceeds.currency;
        row.proceedsSource = "google-orders";
        row.proceedsFetchedAt = orderProceeds.fetchedAt;
      }
      if (
        !/^[A-Z]{3}$/.test(row.currency) ||
        !/^[A-Z]{3}$/.test(row.proceedsCurrency)
      )
        throw new Error("통화는 KRW, USD와 같은 ISO 코드여야 합니다.");
      if (
        !/^\d{4}-(0[1-9]|1[0-2])$/.test(row.period) ||
        !row.appName ||
        row.appId.endsWith(":")
      )
        throw new Error("보고서 기간 또는 앱 식별자가 올바르지 않습니다.");
      const fingerprint = JSON.stringify({
        transaction: get("Description", "Order Number"),
        transactionType: get("Transaction Type"),
        ...row,
        id: "",
        reportKey: "",
        taxClass: "",
        source: undefined,
        reportScope: undefined,
        periodKind: undefined,
        // Orders enrichment changes availability, not the original sale.
        // The same charge can be repeated across report shards with its current
        // net allocated to one copy and zero to the others.
        proceeds: source === "google-sales" ? null : row.proceeds,
        proceedsSource: source === "google-sales" ? undefined : row.proceedsSource,
        proceedsFetchedAt: undefined,
      });
      // One Google order cannot contain the identical charged sale twice.
      // Repeated partial-refund amounts can be distinct events, so preserve
      // their occurrences (and other providers' aggregate rows) as before.
      const duplicateCharge = source === "google-sales" && get("Order Number") &&
        get("Financial Status").toLowerCase().trim() === "charged";
      const occurrence = duplicateCharge ? 0 : occurrences.get(fingerprint) ?? 0;
      if (!duplicateCharge) occurrences.set(fingerprint, occurrence + 1);
      row.id = await digest(`${fingerprint}:${occurrence}`);
      result.push(row);
    } catch (e) {
      throw new Error(
        `${index + 2}행: ${e instanceof Error ? e.message : "읽기 실패"}`,
        { cause: e },
      );
    }
  }
  if (!result.length) throw new Error("가져올 거래가 없습니다.");
  return result;
}
export function mergeReports(
  data: RevenueData,
  reports: { document: StoreDocument; rows: RevenueRow[] }[],
  options: { now?: Date } = {},
): RevenueData {
  const utcMonth = (options.now ?? new Date()).toISOString().slice(0, 7);
  // Revisions replace the same logical file across API/cache/manual transports.
  // Separate adjustment filenames remain separate report scopes.
  const active = new Map<string, { document: StoreDocument; rows: RevenueRow[] }>();
  for (const report of reports) {
    const scope = report.rows[0]?.reportScope || report.document.key;
    const storedKeys = new Set(data.rows.filter((row) =>
      (row.reportScope || reportScopeFromKey(row.reportKey, reportSource(row)) || row.reportKey) === scope,
    ).map((row) => row.reportKey));
    const storedApi = data.imports.find((entry) => entry.source === "api" &&
      (storedKeys.has(entry.key) || entry.key === report.document.key));
    if (report.document.source === "cache" && storedApi) {
      const cacheTime = Date.parse(report.document.sourceUpdatedAt || "");
      const apiTime = Date.parse(storedApi.sourceUpdatedAt || storedApi.fetchedAt || storedApi.importedAt);
      if (!Number.isFinite(cacheTime) || !Number.isFinite(apiTime) || cacheTime <= apiTime) continue;
    }
    const prior = active.get(scope);
    if (!prior || report.document.source !== "cache" || prior.document.source === "cache")
      active.set(scope, report);
  }
  const incoming = [...active.values()];
  const keys = new Set(incoming.map((r) => r.document.key));
  const scopes = new Set(incoming.flatMap((r) => r.rows.map((row) => row.reportScope).filter(Boolean)));
  const replacedKeys = new Set(data.rows.filter((row) => {
    const scope = row.reportScope || reportScopeFromKey(row.reportKey, reportSource(row));
    return keys.has(row.reportKey) || (scope !== undefined && scopes.has(scope));
  }).map((row) => row.reportKey));
  const previous = new Map(data.rows.map((row) => [row.id, row]));
  const rows = new Map(
    data.rows.filter((r) => !replacedKeys.has(r.reportKey)).map((r) => [r.id, r]),
  );
  for (const report of incoming)
    for (const row of report.rows) {
      const collision = rows.get(row.id);
      // Preserve the API-backed net across duplicated sales shards. Selection
      // and persistence share the same latest-snapshot/allocation preference.
      const refreshFailedCurrentOrder = collision && report.document.source === "api" &&
        row.period === utcMonth && reportSource(row) === "google-sales" &&
        !hasVerifiedGoogleOrderProceeds(row) && hasVerifiedGoogleOrderProceeds(collision) &&
        Date.parse(report.document.fetchedAt || "") >= Date.parse(collision.proceedsFetchedAt!);
      if (collision && !refreshFailedCurrentOrder && compareGoogleOrderProceeds(collision, row) > 0) continue;
      const collisionScope = collision && (collision.reportScope || reportScopeFromKey(collision.reportKey, reportSource(collision)));
      // An extra earnings/adjustment shard can legitimately repeat an amount
      // and order. Only the same source file is a duplicate snapshot.
      const priorScoped = row.reportScope ? data.rows.find((prior) =>
        (prior.reportScope || reportScopeFromKey(prior.reportKey, reportSource(prior))) === row.reportScope &&
        (prior.id === row.id || prior.id.startsWith(`${row.id}:`)),
      ) : undefined;
      const id = priorScoped?.id || (row.source === "google-earnings" && row.reportScope &&
        collisionScope && row.reportScope !== collisionScope
          ? `${row.id}:${row.reportScope}` : row.id);
      const old = previous.get(id);
      let nextRow = id === row.id ? row : { ...row, id };
      // Orders only enrich the open UTC month. Re-fetching the same historical
      // CSV after month-end must not erase the last verified order snapshot.
      // The unchanged source-row identity is required; changed sales/refunds
      // stay unknown. Current-month lookup failures also remain unknown.
      if (old && report.document.source === "api" && row.period < utcMonth &&
        reportSource(row) === "google-sales" && !hasVerifiedGoogleOrderProceeds(row) &&
        hasVerifiedGoogleOrderProceeds(old) && old.period === row.period &&
        old.proceedsCurrency === row.currency &&
        new Date(old.proceedsFetchedAt!).toISOString().slice(0, 7) === row.period) {
        nextRow = {
          ...nextRow, proceeds: old.proceeds, proceedsCurrency: old.proceedsCurrency,
          proceedsSource: old.proceedsSource, proceedsFetchedAt: old.proceedsFetchedAt,
        };
      }
      rows.set(
        id,
        old
          ? {
              ...nextRow,
              taxClass: old.taxClass,
              supplyAmount: old.supplyAmount,
              outputVat: old.outputVat,
              evidence: old.evidence,
              taxDate: old.taxDate,
            }
          : nextRow,
      );
    }
  const imports = [
    ...data.imports.filter((i) => !keys.has(i.key) && !replacedKeys.has(i.key)),
    ...incoming.map((r) => ({
      key: r.document.key,
      name: r.document.name,
      rows: r.rows.length,
      importedAt: new Date().toISOString(),
      period: r.document.period || r.rows[0]?.period,
      source: r.document.source,
      fetchedAt: r.document.fetchedAt,
      sourceUpdatedAt: r.document.sourceUpdatedAt,
    })),
  ];
  return { ...data, rows: [...rows.values()], imports };
}
const MAX_SIZE = 25 * 1024 * 1024;
export async function readReportFile(file: File): Promise<StoreDocument[]> {
  if (file.size > MAX_SIZE)
    throw new Error("한 파일은 25MB 이하로 가져와 주세요.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  let files: Record<string, Uint8Array>;
  if (/\.zip$/i.test(file.name)) {
    let size = 0;
    files = unzipSync(bytes, {
      filter: (f) => {
        size += f.originalSize;
        if (size > MAX_SIZE) throw new Error("압축 해제 후 25MB를 초과합니다.");
        return /\.(csv|txt|tsv)$/i.test(f.name);
      },
    });
  } else if (/\.gz$/i.test(file.name)) {
    const view = new DataView(bytes.buffer);
    if (bytes.length < 8 || view.getUint32(bytes.length - 4, true) > MAX_SIZE)
      throw new Error("압축 파일이 너무 큽니다.");
    files = { [file.name.replace(/\.gz$/i, "")]: gunzipSync(bytes) };
  } else files = { [file.name]: bytes };
  return Object.entries(files).map(([name, content]) => ({
    key: /\.zip$/i.test(file.name) ? `file:${file.name}:${name}` : `file:${name}`,
    name,
    text:
      content[0] === 0xff && content[1] === 0xfe
        ? new TextDecoder("utf-16le").decode(content)
        : strFromU8(content),
    period: "",
  }));
}
export const csvTemplate =
  "date,period,platform,app_id,app_name,country,currency,gross,refunds,fee,tax,proceeds,proceeds_currency,units,basis\n2026-09-01,2026-09,apple,my-app,내 앱,KR,KRW,11000,0,1500,1000,8500,KRW,1,settled\n";
