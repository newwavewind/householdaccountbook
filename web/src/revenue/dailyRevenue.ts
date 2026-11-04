import { amounts, countPaidSales, summarize, validDate } from "./model";
import { isAppleMonthly, reportSource, selectRevenueRows } from "./reportSelection";
import { summarizePeriodCoverage } from "./completeness";
import type { Platform, RevenueData, RevenueRow } from "./types";

export type DailyPlatform = Platform | "all";
export type DailyGrouping = "app" | "product";
const stores: Platform[] = ["apple", "google"];
export function isDailySale(row: RevenueRow) {
  return row.basis === "estimate" && validDate(row.date) && (!row.endDate || row.endDate === row.date) && !isAppleMonthly(row);
}
export function dailyDates(month: string, today: string) {
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month)) return [];
  return Array.from({ length: new Date(Date.UTC(Number(month.slice(0,4)), Number(month.slice(5)), 0)).getUTCDate() }, (_, i) => `${month}-${String(i+1).padStart(2,"0")}`).filter(date => date <= today);
}
export function dailyRevenue(data: RevenueData, date: string, platform: DailyPlatform = "all") {
  const selectedStores = platform === "all" ? stores : [platform];
  const sales = selectRevenueRows(data.rows.filter(row => isDailySale(row) && row.date === date && selectedStores.includes(row.platform))).rows;
  const finalGoogle = data.rows.filter(row => row.platform === "google" && row.period === date.slice(0,7) && row.basis === "settled" && reportSource(row) === "google-earnings");
  const googleCoverage = finalGoogle.length ? summarizePeriodCoverage(data, date.slice(0,7), data.rows, ["google"]).perPlatform.google : undefined;
  const googleIncome = finalGoogle.length ? finalGoogle.filter(row => row.date === date && (!row.endDate || row.endDate === row.date)) : sales.filter(row => row.platform === "google");
  const income = selectedStores.flatMap(store => store === "apple" ? sales.filter(row => row.platform === "apple") : googleIncome);
  const salesTotals = summarize(sales, data), incomeTotals = summarize(income, data);
  const missingSalesStores = selectedStores.filter(store => !sales.some(row => row.platform === store));
  const missingIncomeStores = selectedStores.filter(store => !income.some(row => row.platform === store));
  const completeSales = sales.length > 0 && !missingSalesStores.length && !salesTotals.missingGrossFx;
  const completeIncome = income.length > 0 && !missingIncomeStores.length && incomeTotals.completeProceeds && !(selectedStores.includes("google") && googleCoverage?.missingPrimarySettledReport);
  return { date, sales, income, salesTotals, incomeTotals, missingSalesStores, missingIncomeStores, completeSales, completeIncome,
    paid: countPaidSales(sales), googleIncomeIncomplete: !!googleCoverage?.missingPrimarySettledReport, googleFinal: finalGoogle.length > 0,
    hasEstimates: income.some(row => row.basis === "estimate"),
    hasKnownIncome: income.some(row => summarize([row], data).completeProceeds),
  };
}
/** Sum the same dated reports shown in the calendar, without adding monthly/fiscal totals. */
export function summarizeDailyMonth(days: ReturnType<typeof dailyRevenue>[]) {
  return {
    gross: days.reduce((sum, day) => sum + day.salesTotals.gross, 0),
    refunds: days.reduce((sum, day) => sum + day.salesTotals.refunds, 0),
    netSales: days.reduce((sum, day) => sum + day.salesTotals.gross - day.salesTotals.refunds, 0),
    proceeds: days.reduce((sum, day) => sum + day.incomeTotals.proceeds, 0),
    hasSales: days.some(day => day.sales.length > day.salesTotals.missingGrossFx),
    hasIncome: days.some(day => day.hasKnownIncome),
    completeSales: days.length > 0 && days.every(day => day.completeSales),
    completeIncome: days.length > 0 && days.every(day => day.completeIncome),
    hasEstimates: days.some(day => day.hasEstimates),
  };
}

/** Month cards use full calendar sales reports when available; daily cells never receive allocations. */
export function summarizeCalendarMonth(data: RevenueData, month: string, platform: DailyPlatform, today: string) {
  const selectedStores = platform === "all" ? stores : [platform];
  const scoped = data.rows.filter(row => selectedStores.includes(row.platform));
  const salesRows = selectRevenueRows(scoped.filter(row => row.period === month &&
    (isAppleMonthly(row) || (isDailySale(row) && row.date <= today))), "estimate").rows;
  const googleFinal = scoped.filter(row => row.platform === "google" && row.period === month && row.basis === "settled" && reportSource(row) === "google-earnings");
  const incomeRows = [...salesRows.filter(row => row.platform === "apple"),
    ...(googleFinal.length ? googleFinal : salesRows.filter(row => row.platform === "google"))];
  const sales = summarize(salesRows, data), income = summarize(incomeRows, data);
  const dates = dailyDates(month,today);
  const appleDaily = new Set([...data.imports.map(report=>report.key), ...scoped.filter(isDailySale).map(row=>row.reportKey)]);
  const missingAppleDates = selectedStores.includes("apple") ? dates.filter(date=>!appleDaily.has(`apple-sales:${date}`)) : [];
  const hasMonthlyApple = salesRows.some(row => row.platform === "apple" && /^apple-sales-month:/.test(row.reportKey));
  const coverage = summarizePeriodCoverage(data,month,scoped,selectedStores);
  const completeSales = selectedStores.every(store => salesRows.some(row=>row.platform===store) &&
    (store === "google" || hasMonthlyApple || missingAppleDates.length === 0)) && !sales.missingGrossFx;
  const completeIncome = completeSales && income.completeProceeds && selectedStores.every(store=>incomeRows.some(row=>row.platform===store)) &&
    !(googleFinal.length && coverage.perPlatform.google.missingPrimarySettledReport);
  return {
    gross: sales.gross, refunds: sales.refunds, netSales: sales.gross-sales.refunds, proceeds: income.proceeds,
    hasSales: salesRows.some(row=>amounts(row,data)?.grossAvailable),
    hasIncome: incomeRows.some(row=>amounts(row,data)?.proceedsAvailable),
    completeSales, completeIncome, hasEstimates: incomeRows.some(row=>row.basis==="estimate"),
    salesRows, missingAppleDates, hasMonthlyApple,
  };
}

function identity(data: RevenueData, row: Pick<RevenueRow, "appId" | "appName" | "platform" | "productId" | "productName">, grouping: DailyGrouping) {
  const app = data.apps.find(app => app.id === row.appId || (app.platform === row.platform && `${row.platform}:${app.bundleId}` === row.appId));
  const pkg = app?.bundleId || row.appId.replace(/^google:/, "");
  const group = data.appGroups?.find(group => row.platform === "apple" ? group.appleAppIds.includes(app?.id || row.appId) : group.googlePackages.includes(pkg));
  const name = group?.name || app?.name || row.appName;
  const appKey = group?.id || app?.id || row.appId;
  if (grouping === "app") return { key: appKey, name, parent: "" };
  const title = row.productName?.trim();
  const usefulTitle = title && title !== row.appName && title !== app?.name;
  const product = usefulTitle ? title : row.productId?.trim();
  // Only identical reported names/IDs within a known app group are combined.
  const key = product ? product.normalize("NFKC").replace(/\s+/g, " ").toLowerCase() : `unknown:${row.platform}`;
  return { key: `${appKey}:${key}`, name: product || "과목·상품 정보 없음", parent: name };
}
export function dailyRanking(data: RevenueData, day: ReturnType<typeof dailyRevenue>, grouping: DailyGrouping, order: "units" | "sales") {
  const entries = new Map<string, {key: string; name: string; parent: string; sales: RevenueRow[]; income: RevenueRow[]}>();
  for (const kind of ["sales", "income"] as const) for (const row of day[kind]) {
    const id = identity(data, row, grouping);
    const entry = entries.get(id.key) || { ...id, sales: [], income: [] };
    entry[kind].push(row); entries.set(id.key, entry);
  }
  return [...entries.values()].map(entry => {
    const sales = summarize(entry.sales, data), income = summarize(entry.income, data);
    const platforms = stores.filter(store => entry.sales.some(row => row.platform === store && (row.gross > 0 || row.refunds > 0)) || entry.income.some(row => row.platform === store && row.proceeds !== null && row.proceeds !== 0));
    return { ...entry, salesRows: entry.sales, sales, income, platforms, paid: countPaidSales(entry.sales), paidByPlatform: { apple: countPaidSales(entry.sales.filter(row=>row.platform==="apple")).sold, google: countPaidSales(entry.sales.filter(row=>row.platform==="google")).sold },
      completeIncome: entry.income.length > 0 && income.completeProceeds && platforms.every(store => entry.income.some(row => row.platform === store)) && (!day.googleIncomeIncomplete || !platforms.includes("google")),
      hasKnownIncome: entry.income.some(row => summarize([row], data).completeProceeds),
    };
  }).filter(entry => entry.paid.sold || entry.paid.refunded || entry.sales.gross || entry.sales.refunds || entry.income.proceeds)
    .sort((a,b) => (order === "units" ? b.paid.sold - a.paid.sold : b.sales.gross - a.sales.gross) || b.sales.gross - a.sales.gross || a.name.localeCompare(b.name,"ko"));
}

export const dailyAppIdentity = (data: RevenueData, row: Pick<RevenueRow,"appId"|"appName"|"platform">) => identity(data,row,"app");

/** Use exactly the calendar sales rows so details reconcile with the monthly refund subtotal. */
export function dailyRefundDetails(data: RevenueData, days: ReturnType<typeof dailyRevenue>[]) {
  return refundDetails(data,days.flatMap(day => day.sales));
}

export function refundDetails(data: RevenueData, rows: RevenueRow[]) {
  return selectRevenueRows(rows).rows.filter(row => row.refunds > 0).map(row => {
    const converted = amounts(row, data);
    return {
      id: row.id, date: row.date, endDate: row.endDate, platform: row.platform,
      appName: dailyAppIdentity(data, row).name,
      productName: row.productName || row.productId || "",
      refunds: converted?.grossAvailable ? converted.refunds : null,
      nativeRefunds: row.refunds, currency: row.currency,
    };
  }).sort((a,b) => b.date.localeCompare(a.date) || a.appName.localeCompare(b.appName,"ko") || a.id.localeCompare(b.id));
}
