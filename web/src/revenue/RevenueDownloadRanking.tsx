import { money, platformName } from "./model";
import type { dailyDownloads } from "./downloads";
import type { DailyPlatform } from "./dailyRevenue";
export function RevenueDownloadRanking({downloads,platform}: {downloads: ReturnType<typeof dailyDownloads>; platform: DailyPlatform}) {
  return <section aria-label="앱 다운로드·설치 순위">
    <p className="rd-daily-note">App Store는 무료 최초 다운로드, Google Play는 일별 사용자 설치 수입니다. Google 설치 통계는 유·무료를 구분하지 않습니다. 다운로드한 사람과 결제한 사람이 같은 날의 같은 이용자는 아니므로 구매 전환율로 계산하지 않아요.</p>
    <div className="rd-daily-coverage">{platform!=="google" && <span>App Store · {downloads.appleKnown ? `무료 다운로드 ${money(downloads.values.apple)}건` : "다운로드 자료 확인 중"}</span>}{platform!=="apple" && <span>Google Play · {downloads.googleKnown ? `사용자 설치 ${money(downloads.values.google)}건` : "설치 자료 확인 중"}</span>}</div>
    {platform!=="google" && downloads.appleKnown && <p className="rd-daily-note">Apple 재다운로드 {money(downloads.appleRedownloads)}건 · 업데이트 {money(downloads.appleUpdates)}건은 신규 다운로드에서 제외했어요.</p>}
    {!downloads.complete && <p className="rd-daily-note">자료가 없는 앱·날짜는 0건으로 채우지 않습니다. 최근 설치 통계는 늦게 반영될 수 있어요.</p>}
    {downloads.ranks.length ? <ol className="rd-daily-ranks">{downloads.ranks.map((entry,index)=><li key={entry.key}><div className="rd-daily-rank-title"><span className="rd-daily-rank-number">{index+1}</span><div><strong>{entry.name}</strong><small>{entry.platforms.map(p=>platformName[p]).join(" + ")}</small></div><b>{platform==="all" && entry.googleExpected && !entry.googleComplete ? "확인된 " : ""}{money(entry.apple+entry.google)}건</b></div><div className="rd-daily-rank-money">{entry.platforms.includes("apple") && <span>App Store · 무료 다운로드 <b>{money(entry.apple)}건</b></span>}{entry.platforms.includes("google") && <span>Google Play · 사용자 설치 <b>{money(entry.google)}건</b></span>}{platform==="all" && entry.googleExpected && !entry.googleComplete && <span className="rd-daily-rank-pending">Google Play · {entry.googleReported ? "일부 자료 확인 중" : "아직 확인되지 않았어요"}</span>}</div></li>)}</ol> : <div className="rd-daily-empty">{downloads.known ? "이 날짜에는 확인된 다운로드·설치가 없어요." : "다운로드·설치 자료를 확인 중이에요."}<br/>다른 날짜를 선택하거나 이 달 자료를 가져와 주세요.</div>}
  </section>;
}
