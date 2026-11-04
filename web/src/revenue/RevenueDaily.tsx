import { RevenueSaleDetails } from "./RevenueSaleDetails";
import { dailyDownloads } from "./downloads";
import { RevenueDownloadRanking } from "./RevenueDownloadRanking";
import { useMemo, useRef, useState } from "react";
import { RevenueDialog } from "./RevenueDialog";
import { currentMonth, localDate, money, monthLabel, platformName, shiftMonth } from "./model";
import { dailyDates, refundDetails, dailyRanking, dailyRevenue, summarizeDailyMonth, summarizeCalendarMonth, isDailySale, type DailyGrouping, type DailyPlatform } from "./dailyRevenue";
import type { RevenueData } from "./types";

const won = (value: number) => `₩${money(value)}`;
export function RevenueDaily({data, month, onMonthChange, canRefresh}: {data: RevenueData; month: string; onMonthChange: (month: string)=>void; canRefresh: boolean}) {
  const today = localDate();
  const latest = data.rows.filter(isDailySale).map(row=>row.date).filter(date=>date<=today).sort().at(-1) || today;
  const [selected,setSelected] = useState(latest);
  const [detailOpen,setDetailOpen] = useState(false);
  const [refundOpen,setRefundOpen] = useState(false);
  const detailBody = useRef<HTMLDivElement>(null);
  const [platform,setPlatform] = useState<DailyPlatform>("all");
  const [activity,setActivity] = useState<"sales"|"downloads">("sales");
  const [grouping,setGrouping] = useState<DailyGrouping>("app");
  const [order,setOrder] = useState<"units"|"sales">("units");
  const days = useMemo(()=>dailyDates(month,today).reverse().map(date=>({...dailyRevenue(data,date,platform),downloads:dailyDownloads(data,date,platform)})),[data,month,today,platform]);
  const dailyTotals = useMemo(()=>summarizeDailyMonth(days),[days]);
  const monthTotals = useMemo(()=>summarizeCalendarMonth(data,month,platform,today),[data,month,platform,today]);
  const refunds = useMemo(()=>refundDetails(data,monthTotals.salesRows),[data,monthTotals]);
  const day = days.find(day=>day.date===selected) || days[0];
  const calendarStart = new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7))-1,1)).getUTCDay();
  const calendarLength = new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),0)).getUTCDate();
  const calendarDays = new Map(days.map(item=>[item.date,item]));
  const ranking = useMemo(()=>day ? dailyRanking(data,day,grouping,order) : [],[data,day,grouping,order]);
  function changeMonth(value: string) { if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(value) || value > currentMonth() || value < "2026-01") return; onMonthChange(value); setSelected(dailyDates(value,today).at(-1) || value+"-01"); }
  function selectDetailDate(date: string) {
    setSelected(date);
    detailBody.current?.scrollTo({top: 0});
  }
  const knownSales = day?.sales.length && day.salesTotals.missingGrossFx < day.sales.length;
  return <section className="rd-daily" aria-label="일별 현황">
    <div className="rd-daily-heading"><div><h2>하루 실적, 한눈에</h2><p>앱 다운로드와 유료 판매를 나눠서 확인하세요.</p></div></div>
    <div className="rd-daily-controls"><div className="rev-month"><button aria-label="일별 현황 이전 달" disabled={month<="2026-01"} onClick={()=>changeMonth(shiftMonth(month,-1))}>‹</button><label><span className="rev-sr-only">일별 현황 조회 월</span><input type="month" value={month} min="2026-01" max={currentMonth()} onChange={e=>changeMonth(e.target.value)}/></label><button aria-label="일별 현황 다음 달" disabled={month>=currentMonth()} onClick={()=>changeMonth(shiftMonth(month,1))}>›</button></div>
    <div className="rd-daily-stores" role="group" aria-label="일별 스토어 선택">{([['all','전체 합산'],['apple','App Store'],['google','Google Play']] as const).map(([value,label])=><button key={value} aria-pressed={platform===value} onClick={()=>setPlatform(value)}>{label}</button>)}</div></div>
    <p className="rd-daily-note">실시간 매출이 아닌 스토어 보고서 기준입니다. App Store는 Connect 판매 요약의 태평양 시간(PT) 날짜, Google Play는 Play Console 판매 보고서의 UTC 날짜로 합산합니다. 오늘·미제공 자료는 늦게 반영될 수 있어요.</p>
    <section className="rd-daily-month-summary" aria-label={`${monthLabel(month)} 매출과 수익 요약`} aria-live="polite">
      <div className="rd-daily-month-summary-heading"><h3>{monthLabel(month)} 요약</h3><span>{platform === "all" ? "전체 합산" : platformName[platform]} · 1~{days.length}일</span></div>
      <div className="rd-daily-month-summary-grid">
        <article><span>{monthTotals.completeSales ? "이달 매출" : "확인된 매출 소계"}</span><strong>{monthTotals.hasSales ? won(monthTotals.gross) : "확인 중"}</strong><small>{monthTotals.hasSales && !monthTotals.completeSales ? "확인된 소계 · " : ""}환불 전 판매액</small></article>
        <article className="is-income"><span>{monthTotals.completeIncome ? "판매기간 기준 수익" : "확인된 수익 소계"}</span><strong>{monthTotals.hasIncome ? won(monthTotals.proceeds) : "확인 중"}</strong><small>{monthTotals.hasIncome && !monthTotals.completeIncome ? "확인된 소계 · " : ""}수수료·환불 반영 후</small></article>
      </div>
      <dl className="rd-daily-month-refunds">
        <div><dt>이달 환불액</dt><dd><button type="button" className="rd-refund-trigger" aria-haspopup="dialog" aria-label={`${monthLabel(month)} 환불 상세 내역 보기`} onClick={()=>setRefundOpen(true)}>{monthTotals.hasSales ? won(monthTotals.refunds) : "확인 중"}<span>상세 보기 ↗</span></button></dd></div>
        <div><dt>환불 차감 후 매출</dt><dd>{monthTotals.hasSales ? won(monthTotals.netSales) : "확인 중"}</dd></div>
      </dl>
      <p>{monthTotals.hasMonthlyApple ? "Apple 월 판매 보고서 우선 · 일별 중복 제외" : "수집된 판매 보고서 합계"}{monthTotals.hasEstimates ? " · 스토어 제공 예상 포함" : ""}{!monthTotals.completeSales || !monthTotals.completeIncome ? " · 미확인 금액 제외" : ""}</p>
      <p>판매기간 기준 수익은 Apple 회계기간 기준 확정 수익과 다를 수 있습니다. 세무 자료는 별도로 검토합니다.</p>
    </section>
    {monthTotals.missingAppleDates.length > 0 && <aside className="rd-daily-collection-gap" role="status">
      <strong>App Store 일별 자료 {monthTotals.missingAppleDates.length}일 미수집</strong>
      <p>{monthTotals.hasMonthlyApple ? `위 월 매출은 월 보고서를 반영한 ${won(monthTotals.gross)}입니다. 달력에서 확인된 매출은 ${dailyTotals.hasSales ? won(dailyTotals.gross) : "아직 없어요"}${dailyTotals.hasSales ? "입니다" : ""}.` : "일별 자료가 덜 수집되어 월 전체 금액을 아직 확인할 수 없어요."} 월 합계를 날짜별로 임의 배분하지 않습니다.</p>
      {canRefresh && <p>상단 ‘자료 새로고침’을 누르면 이 달의 일별 자료도 함께 확인합니다.</p>}
    </aside>}
    <section className="rd-daily-calendar" aria-label={`${monthLabel(month)} 일별 현황 달력`}>
      <div className="rd-daily-calendar-heading"><h3>{monthLabel(month)} 달력</h3><p>금액 단위: 원 · 날짜를 누르면 상세 창이 열립니다.</p></div>
      <div className="rd-daily-calendar-grid">
        {["일","월","화","수","목","금","토"].map((weekday,index)=><span className={`rd-daily-calendar-weekday ${index===0 ? "is-sunday" : index===6 ? "is-saturday" : ""}`} key={weekday}>{weekday}</span>)}
        {Array.from({length:calendarStart},(_,index)=><span className="rd-daily-calendar-blank" aria-hidden="true" key={`blank-${index}`}/>)}
        {Array.from({length:calendarLength},(_,index)=>{
          const date = `${month}-${String(index+1).padStart(2,"0")}`;
          const item = calendarDays.get(date);
          const sales = item?.sales.length ? item.paid.sold : null;
          const downloads = item?.downloads.known ? item.downloads.total : null;
          const hasSalesAmount = !!item?.sales.length && item.salesTotals.missingGrossFx < item.sales.length;
          const salesAmount = hasSalesAmount && item ? won(item.salesTotals.gross) : "확인 중";
          const incomeAmount = item?.hasKnownIncome ? won(item.incomeTotals.proceeds) : "확인 중";
          const partialSales = hasSalesAmount && !item?.completeSales;
          const partialIncome = item?.hasKnownIncome && !item.completeIncome;
          return item ? <button key={date} type="button" aria-label={`${Number(month.slice(5))}월 ${index+1}일, 유료 판매 ${sales === null ? "확인 중" : `${sales}건`}, 다운로드·설치 ${downloads === null ? "확인 중" : `${downloads}건`}, 매출 ${salesAmount}${partialSales ? " 일부" : ""}, 수익 ${incomeAmount}${partialIncome ? " 일부" : ""}`} aria-pressed={day?.date===date} aria-current={date===today ? "date" : undefined} aria-haspopup="dialog" onClick={()=>{ setSelected(date); setDetailOpen(true); }}>
            <strong>{index+1}</strong><span>판매 {sales === null ? "—" : sales}</span><small>{downloads === null ? "다운 —" : `다운 ${downloads}`}</small>
            <span className="rd-daily-calendar-money"><small>매출{partialSales ? "·일부" : ""}</small><b>{hasSalesAmount ? money(item.salesTotals.gross) : "확인 중"}</b></span>
            <span className="rd-daily-calendar-money is-income"><small>수익{partialIncome ? "·일부" : ""}</small><b>{item.hasKnownIncome ? money(item.incomeTotals.proceeds) : "확인 중"}</b></span>
          </button> : <span className="rd-daily-calendar-future" key={date} aria-label={`${index+1}일, 아직 선택할 수 없음`}>{index+1}</span>;
        })}
      </div>
      <p className="rd-daily-calendar-help">판매는 유료 결제 건수, 다운은 App Store 무료 최초 다운로드와 Google Play 사용자 설치 건수입니다. ‘다운 —’는 Apple 상품 유형(Product Type)이 없거나 Google 설치 보고서가 아직 없을 때입니다. 자료를 다시 가져오면 채워집니다. 0건으로 임의로 채우지 않습니다.</p>
      <p className="rd-daily-calendar-help">{platform === "all" ? "App Store와 Google Play 합산" : platformName[platform]} · 금액 단위 원. 매출은 환불 전 판매액, 수익은 스토어 보고서의 수수료 차감 후 금액입니다. 일부 자료만 확인되면 ‘일부’, 금액이 없으면 ‘확인 중’으로 표시합니다.</p>
    </section>
    {refundOpen && <RevenueDialog className="rd-daily-dialog rd-refund-dialog" title={`${monthLabel(month)} 환불 상세 내역`} description={`${platform === "all" ? "App Store + Google Play" : platformName[platform]} · App Store PT · Google Play UTC`} close={()=>setRefundOpen(false)}>
      <div className="rd-daily-dialog-body">
        <div className="rd-refund-total"><span>확인된 환불액</span><strong>{monthTotals.hasSales ? won(monthTotals.refunds) : "확인 중"}</strong></div>
        <p className="rd-daily-note">환불이 반영된 보고서 날짜·기간입니다. App Store는 Connect 판매 요약(PT), Google Play는 Play Console 판매 보고서(UTC) 기준입니다. 월 보고서만 있으면 개별 환불일은 확인할 수 없어요. 실제 환불 신청일이나 카드 입금일과 다를 수 있습니다.{!monthTotals.completeSales ? " 미확인 자료는 합계에서 제외했어요." : ""}</p>
        {refunds.length ? <ul className="rd-refund-list">{refunds.map(item=><li key={item.id}>
          <div><strong>{item.appName || "앱 이름 확인 중"}</strong><span>{platformName[item.platform]}</span></div>
          {item.productName && item.productName !== item.appName && <p>{item.productName}</p>}
          <div><time dateTime={item.date}>{item.date.replaceAll("-", ". ")}{item.endDate && item.endDate !== item.date ? ` ~ ${item.endDate.replaceAll("-", ". ")} · 월 보고서` : ""}</time><b>{item.refunds === null ? "환율 확인 중" : won(item.refunds)}</b></div>
          {item.currency !== "KRW" && <small>원본 환불액 {money(item.nativeRefunds)} {item.currency}</small>}
        </li>)}</ul> : <div className="rd-daily-empty">{monthTotals.hasSales ? "선택한 기간·스토어의 수집된 자료에 환불 내역이 없어요." : "환불 내역을 확인할 판매 자료가 아직 없어요."}</div>}
        <p className="rd-daily-note">같은 날짜·앱이라도 보고서 항목은 각각 표시합니다. 수익에는 스토어가 제공한 환불 반영 금액을 사용하며, 여기의 환불액을 다시 차감하지 않습니다.</p>
      </div>
    </RevenueDialog>}
    {detailOpen && day && <RevenueDialog
      className="rd-daily-dialog"
      title={`${monthLabel(month)} ${Number(day.date.slice(8))}일 상세 현황`}
      description="매출·수익, 다운로드와 유료 판매 순위를 확인하세요."
      close={()=>setDetailOpen(false)}
    >
    <div className="rd-daily-dialog-body" ref={detailBody}>

    <div className="rd-daily-selected"><label>선택한 날짜<input aria-label="확인할 날짜" type="date" min={`${month}-01`} max={dailyDates(month,today).at(-1)} value={day.date} onChange={e=>{ if(dailyDates(month,today).includes(e.target.value)) setSelected(e.target.value); }}/></label><span>{platform==="all" ? "App Store + Google Play" : platformName[platform]} · 원화 환산</span></div>
    <div className="rd-daily-stores" role="group" aria-label="상세 현황 스토어 선택">{([['all','전체 합산'],['apple','App Store'],['google','Google Play']] as const).map(([value,label])=><button key={value} aria-pressed={platform===value} onClick={()=>setPlatform(value)}>{label}</button>)}</div>
    <div className="rd-daily-metrics rd-daily-metrics-four" aria-live="polite">
      <article><span>{day.completeSales ? "판매 매출" : "확인된 판매 매출"}</span><strong>{knownSales ? won(day.salesTotals.gross) : "—"}</strong><small>환불 {won(day.salesTotals.refunds)} · 환불 차감 후 {knownSales ? won(day.salesTotals.gross-day.salesTotals.refunds) : "—"}</small></article>
      <article className="is-income"><span>{day.completeIncome ? "보고서 기준 수익" : "확인된 수익 소계"}</span><strong>{day.hasKnownIncome ? won(day.incomeTotals.proceeds) : "확인 중"}</strong><small>{day.hasEstimates ? "스토어 제공 예상 포함" : day.hasKnownIncome ? "Google 확정 보고서 기준" : "수익 자료가 필요해요"}{!day.completeIncome && day.hasKnownIncome ? " · 일부 금액" : ""}</small></article>
      <article className="is-downloads"><span>앱 다운로드·설치</span><strong>{day.downloads.known ? `${money(day.downloads.total)}건` : "확인 중"}</strong><small>{platform==="apple" ? "무료 최초 다운로드" : platform==="google" ? "일별 사용자 설치 · 유·무료 미구분" : "Apple 무료 다운로드 + Google 사용자 설치"}{day.downloads.known && !day.downloads.complete ? " · 일부 자료" : ""}</small></article>
      <article><span>유료 판매</span><strong>{day.sales.length ? `${money(day.paid.sold)}건` : "—"}</strong><small>환불 {money(day.paid.refunded)}건 · 앱·과목·구독 결제</small></article>
    </div>
    <p className="rd-daily-note">수익은 App Store Connect와 Google Play Console이 제공한 수수료 차감 후 금액입니다. 수수료를 다시 빼지 않으며, 수익 미제공분은 확인 중으로 표시합니다. 실제 입금액은 정산 시 달라질 수 있어요.</p>
    <div className="rd-daily-coverage">{(platform==="all" ? ["apple","google"] as const : [platform]).map(store=><span key={store}>{platformName[store]} · {day.sales.some(row=>row.platform===store) ? "판매 자료 있음" : "해당 날짜 판매 기록 없음"}</span>)}</div>
    {(!day.completeIncome || !day.completeSales) && <p className="rd-daily-note">자료가 없거나 환율·수익이 확인되지 않은 부분은 0원으로 채우지 않았어요. 월별 합계와 Apple 확정 수익을 날짜별로 나누지 않습니다.</p>}
    <div className="rd-daily-activity" role="group" aria-label="다운로드와 유료 판매 구분"><button aria-pressed={activity==="sales"} onClick={()=>setActivity("sales")}>유료 판매 순위</button><button aria-pressed={activity==="downloads"} onClick={()=>setActivity("downloads")}>다운로드·설치 순위</button></div>
    {activity==="downloads" ? <><h3>{Number(day.date.slice(5,7))}월 {Number(day.date.slice(8))}일 다운로드·설치 순위</h3><RevenueDownloadRanking downloads={day.downloads} platform={platform}/></> : <section className="rd-daily-ranking" aria-label="일별 판매 순위"><div className="rd-daily-heading"><div><h3>{Number(day.date.slice(5,7))}월 {Number(day.date.slice(8))}일 판매 순위</h3><p>{order==="units" ? "유료 판매 수가 많은 순 · 동률이면 매출순" : "환불 전 판매 매출이 많은 순"}</p></div></div>
    <div className="rd-daily-rank-controls"><div role="group" aria-label="판매 순위 묶음"><button aria-pressed={grouping==="app"} onClick={()=>setGrouping("app")}>앱별</button><button aria-pressed={grouping==="product"} onClick={()=>setGrouping("product")}>과목·상품별</button></div><select aria-label="판매 순위 정렬" value={order} onChange={e=>setOrder(e.target.value as "units"|"sales")}><option value="units">판매 수 많은 순</option><option value="sales">매출 높은 순</option></select></div>
    {grouping==="product" && <p className="rd-daily-note">원본의 과목·상품명 또는 SKU로 표시해요. 같은 앱 그룹 안에서 이름이나 ID가 일치하는 상품만 합칩니다. 상품 정보가 없으면 이 달 자료를 다시 가져와 주세요.</p>}
    {ranking.length ? <ol className="rd-daily-ranks">{ranking.map((entry,index)=><li key={entry.key}><div className="rd-daily-rank-title"><span className="rd-daily-rank-number">{index+1}</span><div><strong>{entry.name}</strong><small>{entry.parent && `${entry.parent} · `}{entry.platforms.map(p=>platformName[p]).join(" + ")}</small></div><b>{money(entry.paid.sold)}건</b></div><RevenueSaleDetails key={`${day.date}:${grouping}:${entry.key}:${platform}`} data={data} rows={entry.salesRows} platforms={entry.platforms} name={entry.name}/><div className="rd-daily-rank-money"><span>매출 <b>{entry.sales.missingGrossFx ? "환율 확인" : won(entry.sales.gross)}</b></span><span>수익 <b>{entry.hasKnownIncome ? won(entry.income.proceeds) : "확인 중"}{entry.hasKnownIncome && !entry.completeIncome && <small>일부</small>}</b></span><small>환불 {money(entry.paid.refunded)}건{entry.sales.refunds ? ` · ${won(entry.sales.refunds)}` : ""}</small></div></li>)}</ol> : <div className="rd-daily-empty">이 날짜에는 확인된 유료 판매가 없어요.<br/>다른 날짜를 선택하거나 일별 자료를 가져와 주세요.</div>}
    </section>}
    <details className="rd-daily-dialog-history"><summary>이 달 전체 일별 내역</summary>
    <section className="rd-daily-history" aria-label="매일 매출과 수익"><div className="rd-daily-heading"><div><h3>{monthLabel(month)} 일별 내역</h3><p>날짜를 누르면 해당 날짜의 상세 현황으로 바뀝니다.</p></div></div><div className="rd-daily-history-head"><span>날짜 / 다운로드 / 유료 판매</span><span>매출 / 수익</span></div>{days.map(item=><button key={item.date} aria-pressed={item.date===day.date} onClick={()=>selectDetailDate(item.date)}><span><strong>{Number(item.date.slice(8))}일 <small>{new Date(`${item.date}T12:00:00Z`).toLocaleDateString("ko-KR",{weekday:"short",timeZone:"UTC"})}</small></strong><small>다운로드·설치 {item.downloads.known ? `${money(item.downloads.total)}건${item.downloads.complete ? "" : " · 일부"}` : "확인 중"}</small><small>{item.sales.length ? `유료 판매 ${money(item.paid.sold)}건` : "판매 기록 없음"}</small></span><span><strong>{item.sales.length && item.salesTotals.missingGrossFx<item.sales.length ? won(item.salesTotals.gross) : "—"}{item.sales.length>0 && !item.completeSales && <small> 일부</small>}</strong><small>수익 {item.hasKnownIncome ? won(item.incomeTotals.proceeds) : "확인 중"}{item.hasKnownIncome && !item.completeIncome ? " · 일부" : ""}</small></span></button>)}</section>
    </details>
    </div>
    </RevenueDialog>}
  </section>;
}
