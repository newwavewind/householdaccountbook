import { useId, useState } from "react";
import { dailyAppIdentity } from "./dailyRevenue";
import { amounts, countPaidSales, money, platformName } from "./model";
import { selectRevenueRows } from "./reportSelection";
import type { Platform, RevenueData, RevenueRow } from "./types";

/** Apple paid-app Product Type Identifier values (not in-app subjects). */
const APPLE_PAID_APP_TYPES = new Set(["1", "1F", "1T", "F1"]);

export function paidSaleRows(rows: RevenueRow[], platform: Platform) {
  return selectRevenueRows(rows).rows.filter(row => row.platform === platform && row.gross > 0 && row.refunds === 0)
    .sort((a,b) => (a.chargedAt || a.date).localeCompare(b.chargedAt || b.date) || a.id.localeCompare(b.id));
}
export function saleTime(iso?: string) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(iso) || !Number.isFinite(Date.parse(iso))) return null;
  return new Intl.DateTimeFormat("ko-KR", {timeZone:"Asia/Seoul", year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).format(new Date(iso));
}
/** Separate subject/product from the parent app so paid-app rows are not mistaken for missing subjects. */
export function saleRecordLabel(row: RevenueRow, appLabel: string) {
  const app = appLabel.trim() || row.appName;
  const product = (row.productName || "").trim();
  const sku = (row.productId || "").trim();
  const distinct = !!product && product !== row.appName && product !== app;
  if (distinct) return { title: product, app };
  const type = (row.productType || "").trim().toUpperCase();
  if (type && APPLE_PAID_APP_TYPES.has(type)) return { title: "앱 유료 구매", app };
  if (sku) return { title: sku, app };
  return { title: "앱 유료 구매", app };
}
export function RevenueSaleRecords({data, rows, platform}: {data:RevenueData;rows:RevenueRow[];platform:Platform}) {
  const sales = paidSaleRows(rows,platform);
  const earnings = platform === "google" ? data.rows.filter(row => row.source === "google-earnings" && row.basis === "settled" && row.transactionReference) : [];
  const settledByOrder = new Map<string, {amount:number;currency:string;hasCharge:boolean;appId:string;valid:boolean}>();
  for (const row of earnings) {
    const ref = row.transactionReference!;
    const prior = settledByOrder.get(ref);
    const currency = row.proceedsCurrency;
    if (prior && (prior.currency !== currency || prior.appId !== row.appId)) { prior.valid = false; continue; }
    const item = settledByOrder.get(ref) ?? {amount:0,currency,hasCharge:false,appId:row.appId,valid:true};
    const converted = amounts(row,data);
    if (!converted?.proceedsAvailable) item.valid = false;
    else item.amount += converted.proceeds;
    if (row.gross > 0) item.hasCharge = true;
    settledByOrder.set(ref,item);
  }
  return <>
    <p className="rd-sale-help">{platform === "apple" ? "App Store는 Connect 판매 요약(태평양 시간·PT)의 일별 합산 항목입니다. Connect 판매·추세에서 타임존을 Pacific Time으로 두면 같은 날 건수를 볼 수 있습니다. 개별 주문·판매 시각은 보고서에서 제공하지 않습니다. 과목(인앱)은 상품명으로, 앱 자체 유료 구매는 ‘앱 유료 구매’로 표시합니다." : "일별 합산은 Play Console 판매 보고서 날짜(UTC)입니다. 판매 시각은 한국시간(KST)이라 보고서 날짜와 하루 차이가 날 수 있습니다. 시각이 없는 기존 자료는 이 달 자료를 다시 가져와 주세요."}</p>
    {sales.length ? <ul className="rd-sale-records">{sales.map(row=>{
      const value = amounts(row,data);
      const settled = row.transactionReference ? settledByOrder.get(row.transactionReference) : undefined;
      const reconciled = settled?.valid && settled.hasCharge && settled.appId === row.appId ? settled.amount : null;
      const time = saleTime(row.chargedAt);
      const label = saleRecordLabel(row, dailyAppIdentity(data, row).name);
      return <li key={row.id}>
        <div className="rd-sale-record-title"><strong>{label.title}</strong><b>{money(Math.max(0,row.units))}건{row.units > 1 ? " 합산" : ""}</b></div>
        {label.title !== label.app && <small>{label.app}</small>}
        {row.productId && <small>상품 ID · {row.productId}</small>}
        <p>보고서 날짜 {row.date} · {row.country || "국가 미제공"}</p>
        <p>{time ? <>판매 시각 <time dateTime={row.chargedAt}>{time} KST</time></> : "판매 시각 미제공"}</p>
        <dl><div><dt>판매액{row.units > 1 ? " 합계" : ""}</dt><dd>{value?.grossAvailable ? `₩${money(value.gross)}` : "환율 확인 중"}</dd></div><div><dt>{row.platform === "google" ? "주문 수익 · 환불 반영" : "보고서 수익"}</dt><dd>{reconciled !== null ? `₩${money(reconciled)}` : value?.proceedsAvailable ? `₩${money(value.proceeds)}` : "개별 수익 미확인"}</dd></div></dl>
        {row.currency !== "KRW" && <small>원본 판매액 {money(row.gross)} {row.currency}</small>}
      </li>;
    })}</ul> : <p className="rd-sale-help">확인된 유료 판매 항목이 없습니다. 환불·수익 조정만 있는 경우 판매 건수는 0건입니다.</p>}
    {platform === "google" && sales.length > 0 && <p className="rd-sale-help">주문 번호가 정확히 일치하는 Google 확정 실적의 판매·수수료·세금 항목을 합산합니다. 일치하는 주문 항목이 없으면 개별 수익을 추정하지 않습니다.</p>}
  </>;
}
export function RevenueSaleDetails({data,rows,platforms,name}: {data:RevenueData;rows:RevenueRow[];platforms:Platform[];name:string}) {
  const [expanded,setExpanded] = useState<Platform | null>(null);
  const id = useId();
  return <>
    <div className="rd-daily-rank-store-counts">{platforms.map(store=><button type="button" key={store} id={`${id}-${store}-button`} aria-expanded={expanded===store} aria-controls={`${id}-${store}-details`} aria-label={`${name} ${platformName[store]} 판매 ${money(countPaidSales(rows.filter(row=>row.platform===store)).sold)}건 상세 내역`} onClick={()=>setExpanded(expanded===store ? null : store)}>{platformName[store]} <b>{money(countPaidSales(rows.filter(row=>row.platform===store)).sold)}건</b><span aria-hidden="true">{expanded===store ? "−" : "+"}</span></button>)}</div>
    {platforms.map(store=><section key={store} id={`${id}-${store}-details`} className="rd-sale-details" hidden={expanded!==store} aria-labelledby={`${id}-${store}-button`}>
      {expanded===store && <RevenueSaleRecords data={data} rows={rows} platform={store}/>}
    </section>)}
  </>;
}
