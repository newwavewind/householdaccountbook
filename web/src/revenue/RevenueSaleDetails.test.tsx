import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { emptyData } from "./model";
import { dailyRevenue, dailyRanking } from "./dailyRevenue";
import { parseReport, mergeReports } from "./imports";
import { paidSaleRows, saleRecordLabel, saleTime, RevenueSaleRecords } from "./RevenueSaleDetails";
import type { RevenueRow, StoreDocument } from "./types";
const apple: RevenueRow = {id:"a",reportKey:"apple-sales:2026-09-15",date:"2026-09-15",period:"2026-09",appId:"apple:a",appName:"주택관리사",productName:"주택관리사 기출",platform:"apple",country:"KR",currency:"KRW",proceedsCurrency:"KRW",gross:14700,refunds:0,fee:null,tax:null,proceeds:10692,units:3,basis:"estimate",taxClass:"unreviewed"};
it("keeps Apple aggregates without inventing individual orders",()=>{
 const data={...emptyData(),rows:[apple,{...apple,id:"free",gross:0,proceeds:0,units:20},{...apple,id:"refund",gross:0,refunds:4900,units:-1},{...apple,id:"g",appId:"google:g",platform:"google" as const,gross:4900,units:1}]};
 const rank=dailyRanking(data,dailyRevenue(data,"2026-09-15"),"app","units")[0];
 const rows=paidSaleRows(rank.salesRows,"apple");expect(rows).toHaveLength(1);expect(rows[0].units).toBe(rank.paidByPlatform.apple);expect(rows[0].gross).toBe(14700);
 const html=renderToStaticMarkup(createElement(RevenueSaleRecords,{data,rows:rank.salesRows,platform:"apple"}));
 expect(html).toContain("3건 합산");expect(html).toContain("14,700");expect(html).toContain("10,692");expect(html).toContain("판매 시각 미제공");expect(html).not.toContain("<time");
 expect(html).toContain("Connect 판매 요약");expect(html).toContain("Pacific Time");
 expect(html).toContain("주택관리사 기출");expect(html).toContain("주택관리사");
});
it("labels paid-app rows separately from in-app subjects",()=>{
 expect(saleRecordLabel({...apple,productName:"봄기출 공인중개사",appName:"봄기출 공인중개사",productType:"1F",productId:"bomgichul001"},"봄기출 공인중개사")).toEqual({title:"앱 유료 구매",app:"봄기출 공인중개사"});
 expect(saleRecordLabel({...apple,productName:"민법 프리미엄",appName:"공인중개사",productId:"civil"},"봄기출 공인중개사")).toEqual({title:"민법 프리미엄",app:"봄기출 공인중개사"});
 expect(saleRecordLabel({...apple,productName:"봄기출 공인중개사",appName:"봄기출 공인중개사",productId:"premium_unlock_civil"},"봄기출 공인중개사")).toEqual({title:"premium_unlock_civil",app:"봄기출 공인중개사"});
 const paidApp=renderToStaticMarkup(createElement(RevenueSaleRecords,{data:emptyData(),rows:[{...apple,productName:"봄기출 공인중개사",appName:"봄기출 공인중개사",productType:"1F",units:1,gross:4900,proceeds:3564}],platform:"apple"}));
 expect(paidApp).toContain("앱 유료 구매");expect(paidApp).toContain("봄기출 공인중개사");
});
const doc=(stamp:string,state="charged"):StoreDocument=>({key:"google:sales/salesreport_202609.csv",name:"Google sales",period:"2026-09",text:`Order Number,Order Charged Date,Order Charged Timestamp,Financial Status,Package ID,Product Title,Currency of Sale,Charged Amount,Country of Buyer\nGPA.test,2026-09-15,${stamp},${state},com.app,주택관리사,KRW,4900,KR`});
it("imports charge time without changing report day, row ID or tax review",async()=>{
 const timestamp=String(Date.parse("2026-09-15T18:23:45Z")/1000);
 const [old]=await parseReport(doc(""));const [fresh]=await parseReport(doc(timestamp));
 expect(fresh.chargedAt).toBe("2026-09-15T18:23:45.000Z");expect(fresh.date).toBe("2026-09-15");expect(fresh.id).toBe(old.id);
 const merged=await mergeReports({...emptyData(),rows:[{...old,taxClass:"taxable",evidence:"검토 완료",supplyAmount:4000,outputVat:400}]},[{document:doc(timestamp),rows:[fresh]}]);
 expect(merged.rows).toHaveLength(1);expect(merged.rows[0]).toMatchObject({chargedAt:fresh.chargedAt,taxClass:"taxable",evidence:"검토 완료",supplyAmount:4000,outputVat:400});
 expect(saleTime(fresh.chargedAt)).toContain("03:23:45");expect(saleTime(fresh.chargedAt)).toContain("16.");
});
it("keeps missing, invalid and refund timestamps absent",async()=>{
 for(const stamp of ["","not-a-time","0","999999999999999999"]){expect((await parseReport(doc(stamp)))[0].chargedAt).toBeUndefined();}
 expect((await parseReport(doc("1789496625","refund")))[0].chargedAt).toBeUndefined();
 expect(saleTime("invalid")).toBeNull();expect(saleTime()).toBeNull();
});
it("filters stores and sorts separate orders by charge time",()=>{
 const first={...apple,id:"early",platform:"google" as const,units:1,gross:4900,chargedAt:"2026-09-15T01:00:00Z"};
 const last={...first,id:"late",chargedAt:"2026-09-15T14:00:00Z"};
 expect(paidSaleRows([last,apple,first],"google").map(row=>row.id)).toEqual(["early","late"]);
 const html=renderToStaticMarkup(createElement(RevenueSaleRecords,{data:emptyData(),rows:[{...first,proceeds:null}],platform:"google"}));expect(html).toContain("10:00:00");expect(html).toContain("KST");expect(html).toContain("개별 수익 미확인");
 expect(html).toContain("Play Console 판매 보고서 날짜(UTC)");
});
