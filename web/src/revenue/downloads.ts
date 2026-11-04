import { parseDelimited } from "./imports";
import { validDate } from "./model";
import { dailyAppIdentity, dailyRevenue, type DailyPlatform } from "./dailyRevenue";
import type { InstallReport, Platform, RevenueData, StoreDocument } from "./types";

export function parseInstallReport(doc: StoreDocument): InstallReport {
  const match = /^google-installs:(.+):(20\d{2}-(?:0[1-9]|1[0-2]))$/.exec(doc.key);
  if (!match || doc.period !== match[2]) throw new Error("설치 보고서 식별자를 확인해 주세요.");
  const table = parseDelimited(doc.text);
  const header = (table[0] || []).map(value=>value.toLowerCase());
  const columns = ["Date", "Package Name", "Country", "Daily User Installs"].map(name=>header.indexOf(name.toLowerCase()));
  if (columns.some(index=>index<0)) throw new Error("Google 국가별 설치 보고서가 필요합니다.");
  const days = new Map<string, number>(), seen = new Set<string>();
  for (const cells of table.slice(1)) {
    const [date,pkg,country,value] = columns.map(index=>cells[index]);
    if (!validDate(date) || !date.startsWith(doc.period+"-") || pkg!==match[1] || !country || !/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) throw new Error("설치 보고서 날짜·앱·설치 수를 확인해 주세요.");
    const key = `${date}:${country}`;
    if (seen.has(key)) throw new Error("같은 날짜·국가의 설치 통계가 중복되어 있습니다.");
    seen.add(key); days.set(date,(days.get(date)||0)+Number(value));
  }
  if (!days.size) throw new Error("아직 설치 통계가 제공되지 않았습니다.");
  return {key:doc.key, period:doc.period, appId:`google:${match[1]}`, fetchedAt:doc.fetchedAt, days:[...days].map(([date,users])=>({date,users}))};
}
export function mergeInstallReports(existing: InstallReport[] = [], incoming: InstallReport[]) {
  const reports = new Map(existing.map(report=>[report.key,report]));
  for (const report of incoming) reports.set(report.key,report);
  return [...reports.values()];
}
const initialAppTypes = new Set(["1","1F","1T","F1"]);
export function dailyDownloads(data: RevenueData, date: string, platform: DailyPlatform) {
  const stores: Platform[] = platform === "all" ? ["apple","google"] : [platform];
  const appleRows = dailyRevenue(data,date,"apple").sales;
  const typedApple = appleRows.filter(row=>!!row.productType);
  const freeRows = typedApple.filter(row=>initialAppTypes.has(row.productType!) && row.gross===0 && row.refunds===0 && row.units>0);
  const reports = (data.installReports||[]).filter(report=>report.period===date.slice(0,7));
  const googleDays = reports.flatMap(report=>report.days.filter(day=>day.date===date).map(day=>({...day, appId:report.appId})));
  const expectedGoogle = data.apps.filter(app=>app.platform==="google" && app.source!=="demo");
  const appleKnown = typedApple.length>0;
  const googleKnown = googleDays.length>0;
  const known = stores.some(store=>store==="apple" ? appleKnown : googleKnown);
  const complete = stores.every(store=>store==="apple" ? appleKnown && typedApple.length===appleRows.length : googleKnown && expectedGoogle.every(app=>googleDays.some(day=>day.appId===app.id || day.appId===`google:${app.bundleId}`)));
  const values = {apple:freeRows.reduce((sum,row)=>sum+row.units,0),google:googleDays.reduce((sum,day)=>sum+day.users,0)};
  const ranks = new Map<string,{key:string;name:string;apple:number;google:number;platforms:Platform[]}>();
  const add = (appId:string,appName:string,store:Platform,count:number)=>{
    if (!stores.includes(store)) return;
    const identity = dailyAppIdentity(data,{appId,appName,platform:store});
    const entry = ranks.get(identity.key) || {...identity,apple:0,google:0,platforms:[]};
    entry[store]+=count;
    if (!entry.platforms.includes(store)) entry.platforms.push(store);
    ranks.set(identity.key,entry);
  };
  for (const row of freeRows) add(row.appId,row.appName,"apple",row.units);
  for (const row of googleDays) add(row.appId,row.appId.replace(/^google:/,""),"google",row.users);
  return {known,complete,values,appleKnown,googleKnown,total:stores.reduce((sum,store)=>sum+values[store],0),
    ranks:[...ranks.values()].filter(entry=>entry.apple+entry.google>0).map(entry=>{
      const group = data.appGroups?.find(group=>group.id===entry.key);
      const googlePackages = group?.googlePackages || [];
      const reportedPackages = googlePackages.filter(pkg=>googleDays.some(day=>day.appId===`google:${pkg}`));
      return {...entry, googleExpected:googlePackages.length>0, googleReported:reportedPackages.length>0, googleComplete:googlePackages.length>0 && reportedPackages.length===googlePackages.length};
    }).sort((a,b)=>(b.apple+b.google)-(a.apple+a.google)||a.name.localeCompare(b.name,"ko")),
    appleUpdates: typedApple.filter(row=>["7","7F","7T","F7"].includes(row.productType!)).reduce((sum,row)=>sum+Math.max(0,row.units),0),
    appleRedownloads: typedApple.filter(row=>["3","3F"].includes(row.productType!)).reduce((sum,row)=>sum+Math.max(0,row.units),0),
  };
}
