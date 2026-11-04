import { describe,it,expect } from "vitest";
import { dailyDownloads,parseInstallReport,mergeInstallReports } from "./downloads";
import { dailyRevenue } from "./dailyRevenue";
import { parseReport } from "./imports";
import { emptyData } from "./model";
import { validateBackup } from "./storage";
import type {RevenueRow,StoreDocument} from "./types";
let id=0;
const row=(productType:string,units:number,gross=0):RevenueRow=>({id:String(++id),reportKey:"apple-sales:2026-10-20",source:"apple-sales",date:"2026-10-20",period:"2026-10",appId:"apple:1",appName:"앱",productType,platform:"apple",country:"KR",currency:"KRW",proceedsCurrency:"KRW",gross,refunds:0,fee:null,tax:null,proceeds:gross*0.7,units,basis:"estimate",taxClass:"unreviewed"});
const doc=(text:string):StoreDocument=>({key:"google-installs:com.example.app:2026-10",name:"설치",period:"2026-10",text});
const header="Date,Package name,Country,Daily User Installs,Daily Device Upgrades";
describe("downloads separate from paid sales",()=>{
 it("counts only free initial app downloads, excluding paid apps, free IAPs, restores, updates and redownloads",()=>{
  const data=emptyData();data.rows=[row("1",10),row("1F",3),row("1T",2),row("F1",1),row("IA1",5),row("IA3",8),row("3",30),row("7",50),row("1",2,9800),row("IA1",1,4900)];
  const result=dailyDownloads(data,"2026-10-20","apple");
  expect(result.total).toBe(16);expect(result.appleUpdates).toBe(50);expect(result.appleRedownloads).toBe(30);expect(result.complete).toBe(true);
  expect(dailyRevenue(data,"2026-10-20","apple").paid.sold).toBe(3);
 });
 it("keeps missing classification and missing Google dates unknown rather than zero",()=>{
  const data=emptyData();data.rows=[row("",99)];
  expect(dailyDownloads(data,"2026-10-20","all").known).toBe(false);
  data.rows=[row("1",3)];
  expect(dailyDownloads(data,"2026-10-20","all")).toMatchObject({total:3,complete:false,googleKnown:false});
 });
 it("aggregates countries once and replaces revised snapshots, preserving explicit zero",()=>{
  const report=parseInstallReport(doc(header+"\n2026-10-20,com.example.app,KR,4,99\n2026-10-20,com.example.app,US,2,10\n2026-10-21,com.example.app,KR,0,9"));
  expect(report.days).toEqual([{date:"2026-10-20",users:6},{date:"2026-10-21",users:0}]);
  const revision={...report,days:[{date:"2026-10-20",users:7}]};
  expect(mergeInstallReports([report],[revision])).toEqual([revision]);
  const data=emptyData();data.installReports=[report];
  expect(dailyDownloads(data,"2026-10-21","google")).toMatchObject({known:true,total:0});
  expect(dailyDownloads(data,"2026-10-22","google").known).toBe(false);
  expect(dailyRevenue(data,"2026-10-20","google").salesTotals.gross).toBe(0);
 });
 it("rejects duplicate dimensions, wrong apps/months and blank install amounts",()=>{
  const line="2026-10-20,com.example.app,KR,4,99";
  expect(()=>parseInstallReport(doc(header+"\n"+line+"\n"+line))).toThrow(/중복/);
  for(const line of ["2026-09-20,com.example.app,KR,4,9","2026-10-20,com.wrong,KR,4,9","2026-10-20,com.example.app,KR,,9"])
    expect(()=>parseInstallReport(doc(header+"\n"+line))).toThrow();
 });
 it("groups known apps across stores and applies individual store filters",()=>{
  const data=emptyData();data.rows=[row("1",10)];data.appGroups=[{id:"same",name:"같은 앱",appleAppIds:["apple:1"],googlePackages:["com.example.app"]}];data.installReports=[parseInstallReport(doc(header+"\n2026-10-20,com.example.app,KR,4,99"))];
  expect(dailyDownloads(data,"2026-10-20","all").ranks).toMatchObject([{name:"같은 앱",apple:10,google:4,googleExpected:true,googleComplete:true}]);
  expect(dailyDownloads(data,"2026-10-20","google").total).toBe(4);
  expect(dailyDownloads(data,"2026-10-20","apple").total).toBe(10);
 });
 it("marks a linked Google app as pending until its daily install report arrives",()=>{
  const data=emptyData();data.rows=[row("1",4)];
  data.appGroups=[{id:"same",name:"같은 앱",appleAppIds:["apple:1"],googlePackages:["com.example.app"]}];
  expect(dailyDownloads(data,"2026-10-20","all").ranks).toMatchObject([{apple:4,google:0,googleExpected:true,googleReported:false,googleComplete:false}]);
  data.installReports=[parseInstallReport(doc(header+"\n2026-10-20,com.example.app,KR,0,0"))];
  expect(dailyDownloads(data,"2026-10-20","all").ranks).toMatchObject([{apple:4,google:0,googleExpected:true,googleReported:true,googleComplete:true}]);
 });
 it("preserves Apple product classifications without changing existing transaction IDs",async()=>{
  const columns="Title\tSKU\tApple Identifier\tProduct Type Identifier\tBegin Date\tEnd Date\tUnits\tCustomer Price\tDeveloper Proceeds\tCustomer Currency\tCurrency of Proceeds\tCountry Code";
  const line="앱\tapp-sku\t1234567\t1F\t10/20/2026\t10/20/2026\t4\t0\t0\tKRW\tKRW\tKR";
  const input={key:"apple-sales:2026-10-20",name:"Apple",period:"2026-10",text:columns+"\n"+line};
  const [parsed]=await parseReport(input);const [old]=await parseReport({...input,text:input.text.replace("Product Type Identifier","Old unused column")});
  expect(parsed.productType).toBe("1F");expect(parsed.id).toBe(old.id);
 });
 it("validates persisted install data and remains compatible with old backups",()=>{
  const data=emptyData();expect(()=>validateBackup(data)).not.toThrow();
  data.installReports=[parseInstallReport(doc(header+"\n2026-10-20,com.example.app,KR,4,99"))];expect(()=>validateBackup(data)).not.toThrow();
  data.installReports[0].days[0].users=-1;expect(()=>validateBackup(data)).toThrow(/설치/);
 });
});
