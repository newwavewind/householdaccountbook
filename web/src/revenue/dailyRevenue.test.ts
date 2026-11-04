import { describe, expect, it } from "vitest";
import { emptyData } from "./model";
import { dailyDates, dailyRanking, dailyRefundDetails, dailyRevenue, summarizeDailyMonth, summarizeCalendarMonth, refundDetails } from "./dailyRevenue";
import { parseReport, mergeReports } from "./imports";
import { enrichRowsWithApps } from "./appMatch";
import type { RevenueData, RevenueRow } from "./types";
let id = 0;
const row = (patch: Partial<RevenueRow> = {}): RevenueRow => ({id: String(++id), reportKey:"apple-sales:2026-10-20",source:"apple-sales",date:"2026-10-20",endDate:"2026-10-20",period:"2026-10",appId:"apple:a",appName:"민법",platform:"apple",country:"KR",currency:"KRW",proceedsCurrency:"KRW",gross:100,refunds:0,fee:null,tax:null,proceeds:70,units:1,basis:"estimate",taxClass:"unreviewed",...patch});
const fixture = (...rows:RevenueRow[]):RevenueData=>({...emptyData(),rows, appGroups:[{id:"civil",name:"공인중개사",appleAppIds:["apple:a"],googlePackages:["com.civil"]}]});
const google = (patch:Partial<RevenueRow>={})=>row({platform:"google",source:"google-sales",reportKey:"google:sales/salesreport_202610.zip:salesreport_202610.csv",appId:"google:com.civil",proceedsSource:"google-orders",proceedsFetchedAt:"2026-10-21T10:00:00Z",...patch});
describe("daily revenue without monthly allocation",()=>{
 it("excludes monthly and fiscal Apple totals without suppressing actual daily rows",()=>{
  const data=fixture(row(),row({id:"monthly",date:"2026-10-01",endDate:"2026-10-31",reportKey:"apple-sales-month:2026-10",gross:5000,proceeds:4000}),row({source:"apple-finance",basis:"settled",gross:5000,proceeds:4000}));
  const day=dailyRevenue(data,"2026-10-20","apple");expect(day.salesTotals.gross).toBe(100);expect(day.incomeTotals.proceeds).toBe(70);expect(day.completeIncome).toBe(true);
 });
 it("combines the stores and filters each without changing the stored rows",()=>{
  const data=fixture(row(),google({gross:200,proceeds:150}));
  expect(dailyRevenue(data,"2026-10-20").incomeTotals.proceeds).toBe(220);
  expect(dailyRevenue(data,"2026-10-20","google").salesTotals.gross).toBe(200);
  expect(data.rows).toHaveLength(2);
 });
 it("uses Google final daily entries once, keeping fee and refund adjustments",()=>{
  const final=(patch:Partial<RevenueRow>)=>google({basis:"settled",source:"google-earnings",reportKey:"google:earnings/earnings_202610.zip:earnings_202610.csv",...patch});
  const day=dailyRevenue(fixture(google(),final({gross:100,proceeds:100}),final({gross:0,units:0,proceeds:-15})),"2026-10-20","google");
  expect(day.salesTotals.gross).toBe(100);expect(day.incomeTotals.proceeds).toBe(85);expect(day.paid.sold).toBe(1);
 });
 it("does not treat absent stores, unknown net or missing FX as zero income",()=>{
  const day=dailyRevenue(fixture(row(),google({proceeds:null,proceedsSource:undefined})),"2026-10-20");
  expect(day.completeIncome).toBe(false);expect(day.incomeTotals.proceeds).toBe(70);
  expect(dailyRevenue(fixture(row()),"2026-10-20").completeSales).toBe(false);
  const fx=dailyRevenue(fixture(row({currency:"USD",proceedsCurrency:"USD"})),"2026-10-20","apple");expect(fx.completeIncome).toBe(false);expect(fx.hasKnownIncome).toBe(false);
  expect(dailyRevenue(fixture(),"2026-10-20").hasKnownIncome).toBe(false);
 });
 it("ranks cross-store app groups by paid units and excludes free downloads",()=>{
  const data=fixture(row({units:2,gross:200}),google({units:1}),row({appId:"apple:b",appName:"경찰",units:2,gross:800}),row({appId:"apple:free",units:1000,gross:0,proceeds:0}),row({units:-1,gross:0,refunds:100,proceeds:-70}));
  const ranks=dailyRanking(data,dailyRevenue(data,"2026-10-20"),"app","units");
  expect(ranks).toHaveLength(2);expect(ranks[0].name).toBe("공인중개사");expect(ranks[0].paid.sold).toBe(3);expect(ranks[0].paid.refunded).toBe(1);expect(ranks[0].paidByPlatform).toEqual({apple:2,google:1});expect(ranks[0].platforms).toEqual(["apple","google"]);
  expect(dailyRanking(data,dailyRevenue(data,"2026-10-20"),"app","sales")[0].name).toBe("경찰");
 });
 it("only combines matching product names inside the same app group",()=>{
  const data=fixture(row({productName:"민법",appName:"공인중개사"}),google({productName:"민법",appName:"공인중개사"}),row({appId:"apple:b",appName:"경찰",productName:"민법"}));
  const ranks=dailyRanking(data,dailyRevenue(data,"2026-10-20"),"product","units");expect(ranks).toHaveLength(2);expect(ranks[0].paid.sold).toBe(2);
 });
 it("produces leap-day calendars and never displays future dates",()=>{
  expect(dailyDates("2028-02","2028-03-01")).toHaveLength(29);expect(dailyDates("2026-10","2026-10-20")).toHaveLength(20);expect(dailyDates("2026-11","2026-10-20")).toHaveLength(0);
 });
 it("preserves subject names through app enrichment and reimports",async()=>{
  const doc={key:"apple-sales:2026-10-20",name:"Daily",period:"2026-10",text:"Provider\tProvider Country\tSKU\tTitle\tUnits\tDeveloper Proceeds\tBegin Date\tEnd Date\tCustomer Currency\tCountry Code\tCurrency of Proceeds\tApple Identifier\tCustomer Price\tParent Identifier\nAPPLE\tUS\tcivil\t민법 프리미엄\t1\t70\t10/20/2026\t10/20/2026\tKRW\tKR\tKRW\t1234567\t100\t1234567"};
  const rows=await parseReport(doc);const enriched=enrichRowsWithApps(rows,[{id:"apple:1234567",name:"공인중개사",bundleId:"com.civil",platform:"apple",source:"api",version:"",build:"",status:"",updatedAt:""}]);
  expect(enriched[0].productName).toBe("민법 프리미엄");expect(enriched[0].productId).toBe("civil");expect(enriched[0].appName).toBe("공인중개사");
  const saved=mergeReports(emptyData(),[{document:doc,rows:enriched}]);expect(mergeReports(saved,[{document:doc,rows:enriched}]).rows).toHaveLength(1);
 });
});

describe("calendar month totals",()=>{
 it("sums daily store values without adding monthly reports or applying another fee",()=>{
  const data=fixture(row({gross:4900,proceeds:3564}),google({gross:4900,proceeds:3430}),row({date:"2026-10-21",endDate:"2026-10-21",reportKey:"apple-sales:2026-10-21",gross:3300,proceeds:2400}),row({date:"2026-10-01",endDate:"2026-10-31",reportKey:"apple-sales-month:2026-10",gross:99999,proceeds:88888}));
  const dates=["2026-10-20","2026-10-21"];
  const all=summarizeDailyMonth(dates.map(date=>dailyRevenue(data,date)));
  expect(all.gross).toBe(13100);expect(all.proceeds).toBe(9394);expect(all.completeIncome).toBe(false);
  const apple=summarizeDailyMonth(dates.map(date=>dailyRevenue(data,date,"apple")));
  expect(apple.gross).toBe(8200);expect(apple.proceeds).toBe(5964);expect(apple.completeIncome).toBe(true);
 });
 it("shows refunds separately without subtracting them twice from provider proceeds",()=>{
  const data=fixture(row({gross:4900,proceeds:3564}),row({gross:0,refunds:4900,proceeds:-3564,units:-1}));
  const totals=summarizeDailyMonth([dailyRevenue(data,"2026-10-20","apple")]);
  expect(totals.gross).toBe(4900);expect(totals.refunds).toBe(4900);expect(totals.netSales).toBe(0);expect(totals.proceeds).toBe(0);
 });
 it("keeps missing income unknown and preserves a reported zero",()=>{
  const unknown=summarizeDailyMonth([dailyRevenue(fixture(google({proceeds:null})),"2026-10-20","google")]);
  expect(unknown.hasSales).toBe(true);expect(unknown.hasIncome).toBe(false);
  const zero=summarizeDailyMonth([dailyRevenue(fixture(row({gross:0,proceeds:0})),"2026-10-20","apple")]);
  expect(zero.hasSales).toBe(true);expect(zero.hasIncome).toBe(true);expect(zero.proceeds).toBe(0);
  expect(summarizeDailyMonth([]).hasSales).toBe(false);expect(summarizeDailyMonth([]).completeIncome).toBe(false);
 });
});

describe("refund details",()=>{
 it("reconciles with the selected daily subtotal, keeps separate refunds and excludes monthly and settled duplicates",()=>{
  const data=fixture(row({refunds:4900,gross:0,units:-1}),google({refunds:1200,gross:0,units:0}),google({refunds:1200,gross:0,units:0}),row({refunds:9999,date:"2026-10-01",endDate:"2026-10-31"}),google({refunds:9999,basis:"settled",source:"google-earnings"}),row({date:"2026-09-20",refunds:900}));
  const days=[dailyRevenue(data,"2026-10-20")];
  const details=dailyRefundDetails(data,days);
  expect(details).toHaveLength(3);
  expect(details.reduce((sum,item)=>sum+(item.refunds??0),0)).toBe(summarizeDailyMonth(days).refunds);
  expect(details[0].appName).toBe("공인중개사");
  expect(details.every(item=>item.date==="2026-10-20")).toBe(true);
  expect(dailyRefundDetails(data,[dailyRevenue(data,"2026-10-20","apple")])).toHaveLength(1);
 });
 it("keeps unconverted refunds visible without adding a fabricated zero",()=>{
  const data=fixture(row({currency:"USD",refunds:10,gross:0}));
  const details=dailyRefundDetails(data,[dailyRevenue(data,"2026-10-20","apple")]);
  expect(details[0].refunds).toBe(null);expect(details[0].nativeRefunds).toBe(10);expect(details[0].currency).toBe("USD");
  expect(dailyRefundDetails(fixture(row()),[dailyRevenue(fixture(row()),"2026-10-20")])).toEqual([]);
 });
});

describe("calendar month summary with incomplete daily collection",()=>{
 it("uses the full Apple monthly report once while preserving the actual daily subtotal",()=>{
  const data=fixture(row({date:"2026-09-01",endDate:"2026-09-30",period:"2026-09",reportKey:"apple-sales-month:2026-09",gross:399200,proceeds:290356}),row({date:"2026-09-28",endDate:"2026-09-28",period:"2026-09",reportKey:"apple-sales:2026-09-28",gross:22900,proceeds:16656}),google({date:"2026-09-02",endDate:"2026-09-02",period:"2026-09",gross:140600,proceeds:null}),google({date:"2026-09-20",endDate:"2026-09-20",period:"2026-09",gross:0,refunds:9800,proceeds:null,units:-2}),google({date:"2026-09-02",endDate:"2026-09-02",period:"2026-09",basis:"settled",source:"google-earnings",gross:140600,proceeds:94990}));
  const month=summarizeCalendarMonth(data,"2026-09","all","2026-10-29");
  expect(month.gross).toBe(539800);expect(month.refunds).toBe(9800);expect(month.netSales).toBe(530000);expect(month.proceeds).toBe(385346);
  expect(month.completeSales).toBe(true);expect(month.completeIncome).toBe(true);expect(month.missingAppleDates).toHaveLength(29);
  const days=dailyDates("2026-09","2026-10-29").map(date=>dailyRevenue(data,date));
  expect(summarizeDailyMonth(days).gross).toBe(163500);
  expect(refundDetails(data,month.salesRows).reduce((sum,r)=>sum+(r.refunds??0),0)).toBe(month.refunds);
  expect(summarizeCalendarMonth(data,"2026-09","apple","2026-10-29").gross).toBe(399200);
  expect(summarizeCalendarMonth(data,"2026-09","google","2026-10-29").gross).toBe(140600);
 });
 it("does not mark a partial daily month complete and never invents dates for monthly refunds",()=>{
  const partial=summarizeCalendarMonth(fixture(row()),"2026-10","apple","2026-10-29");
  expect(partial.completeSales).toBe(false);expect(partial.hasSales).toBe(true);
  const data=fixture(row({date:"2026-09-01",endDate:"2026-09-30",period:"2026-09",reportKey:"apple-sales-month:2026-09",gross:0,refunds:4900,proceeds:-3564}));
  const month=summarizeCalendarMonth(data,"2026-09","apple","2026-10-29");
  const details=refundDetails(data,month.salesRows);
  expect(details[0].date).toBe("2026-09-01");expect(details[0].endDate).toBe("2026-09-30");expect(details[0].refunds).toBe(4900);
 });
});
