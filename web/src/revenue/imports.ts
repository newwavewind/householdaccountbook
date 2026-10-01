import { gunzipSync, unzipSync, strFromU8 } from "fflate";
import { validDate } from "./model";
import type { RevenueData, RevenueRow, StoreDocument } from "./types";
import { estimateGoogleDeveloperShare } from "./googleFee";
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
  const header = table[0];
  const financial = header.includes("Partner Share");
  const apple = financial || header.includes("Developer Proceeds");
  const google =
    header.includes("Transaction Type") &&
    header.includes("Amount (Merchant Currency)");
  const sales =
    header.includes("Order Number") && header.includes("Charged Amount");
  const canonical = header.includes("date") && header.includes("proceeds");
  if (!apple && !google && !sales && !canonical)
    throw new Error(
      "지원 형식: Apple 판매·재무 TXT, Google 예상 매출·수익 CSV, 표준 CSV 양식",
    );
  const occurrences = new Map<string, number>();
  const result: RevenueRow[] = [];
  for (const [index, cells] of table.slice(1).entries()) {
    if (
      cells[0]?.startsWith("Total_Rows") ||
      cells[0]?.startsWith("Total Rows")
    )
      continue;
    const get = (...names: string[]) => {
      for (const n of names) {
        const i = header.indexOf(n);
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
      };
      if (apple) {
        const date = reportDate(get(financial ? "Start Date" : "Begin Date"));
        const units = numeric(get(financial ? "Quantity" : "Units"));
        const price = Math.abs(numeric(get("Customer Price")));
        const perUnit = numeric(
          get(financial ? "Partner Share" : "Developer Proceeds"),
        );
        const isRefund = units < 0 || get("Sale or Return") === "R";
        const total = financial
          ? numeric(get("Extended Partner Share"))
          : perUnit * units;
        row = {
          ...base,
          date,
          endDate: get("End Date") ? reportDate(get("End Date")) : date,
          period: doc.period || date.slice(0, 7),
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
        const packageId = get("Package ID", "Product ID", "SKU ID");
        const title = (get("Product Title", "Description") || packageId).replace(/\s+/g, " ").trim();
        row = {
          ...base,
          date,
          period: doc.period || date.slice(0, 7),
          appId: `google:${packageId}`,
          appName: title,
          platform: "google",
          country: get("Buyer Country", "Country of Buyer"),
          currency: get("Merchant Currency") || get("Currency of Sale") || "KRW",
          proceedsCurrency: get("Merchant Currency") || get("Currency of Sale") || "KRW",
          gross: charge ? amount : 0,
          refunds: refund ? -amount : 0,
          fee: fee ? -amount : 0,
          tax: tax ? -amount : 0,
          proceeds: amount,
          units: charge ? 1 : refund ? -1 : 0,
          basis: "settled",
        };
      } else if (sales) {
        const date = reportDate(get("Order Charged Date"));
        const state = get("Financial Status").toLowerCase().trim();
        if (!["charged", "refund", "refunded", "partial refund"].includes(state))
          continue; // skip cancelled / pending rows without failing the whole file
        const refund = state.includes("refund"),
          amount = Math.abs(numeric(get("Charged Amount")));
        const packageId = get("Package ID", "Product ID", "SKU ID");
        const title = (get("Product Title") || packageId).replace(/\s+/g, " ").trim();
        const taxCollected = get("Taxes Collected")
          ? Math.abs(numeric(get("Taxes Collected")))
          : null;
        const country = get("Country of Buyer", "Buyer Country");
        const currency =
          get("Currency of Sale") || get("Buyer Currency") || "KRW";
        const gross = refund ? 0 : amount;
        const refunds = refund ? amount : 0;
        const share = estimateGoogleDeveloperShare({
          gross,
          refunds,
          tax:
            taxCollected === null
              ? null
              : refund
                ? -taxCollected
                : taxCollected,
          country,
          currency,
        });
        row = {
          ...base,
          date,
          period: doc.period || date.slice(0, 7),
          appId: `google:${packageId}`,
          appName: title,
          platform: "google",
          country,
          currency,
          proceedsCurrency: currency.trim(),
          gross,
          refunds,
          fee: share.fee,
          tax: share.tax,
          proceeds: share.proceeds,
          units: refund ? -1 : 1,
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
        continue;
      const fingerprint = JSON.stringify({
        transaction: get("Description", "Order Number"),
        transactionType: get("Transaction Type"),
        ...row,
        id: "",
        reportKey: "",
        taxClass: "",
      });
      const occurrence = occurrences.get(fingerprint) ?? 0;
      occurrences.set(fingerprint, occurrence + 1);
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
): RevenueData {
  const keys = new Set(reports.map((r) => r.document.key));
  const previous = new Map(data.rows.map((row) => [row.id, row]));
  const rows = new Map(
    data.rows.filter((r) => !keys.has(r.reportKey)).map((r) => [r.id, r]),
  );
  for (const report of reports)
    for (const row of report.rows) {
      const old = previous.get(row.id);
      rows.set(
        row.id,
        old
          ? {
              ...row,
              taxClass: old.taxClass,
              supplyAmount: old.supplyAmount,
              outputVat: old.outputVat,
              evidence: old.evidence,
              taxDate: old.taxDate,
            }
          : row,
      );
    }
  const imports = [
    ...data.imports.filter((i) => !keys.has(i.key)),
    ...reports.map((r) => ({
      key: r.document.key,
      name: r.document.name,
      rows: r.rows.length,
      importedAt: new Date().toISOString(),
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
    key: `file:${name}`,
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
