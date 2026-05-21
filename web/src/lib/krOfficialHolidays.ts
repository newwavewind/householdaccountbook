import {
  y2018,
  y2019,
  y2020,
  y2021,
  y2022,
  y2023,
  y2024,
  y2025,
  y2026,
} from '@hyunbinseo/holidays-kr'
import type { CalendarLabelKind } from './calendarLabelTypes'
import provisionalJson from '../data/krOfficialHolidaysProvisional.json'

/** 연도별 ISO → 공휴일 명칭 (우주항공청·관보 기준, @hyunbinseo/holidays-kr) */
export type OfficialHolidayYearMap = Record<string, readonly string[]>

const OFFICIAL_BASIC_URL = 'https://holidays.hyunbin.page/basic.json'

const bundledByYear: Record<number, OfficialHolidayYearMap> = {
  2018: y2018,
  2019: y2019,
  2020: y2020,
  2021: y2021,
  2022: y2022,
  2023: y2023,
  2024: y2024,
  2025: y2025,
  2026: y2026,
}

const provisionalByYear = provisionalJson as Record<
  string,
  OfficialHolidayYearMap
>

/** 관보 JSON 원격 로드 결과 (연도 추가 시 자동 반영) */
let remoteByYear: Record<string, OfficialHolidayYearMap> | null = null
let remoteLoadPromise: Promise<void> | null = null
let remoteLoadFailed = false

export const OFFICIAL_HOLIDAY_YEAR_MIN = 2018

export function officialHolidayKind(name: string): CalendarLabelKind {
  if (name.includes('대체공휴일')) return 'substitute'
  if (name.includes('선거')) return 'election'
  return 'public'
}

/** 우주항공청 holidays.hyunbin.page — 신규 연도가 올라오면 앱 재배포 없이 반영 */
export async function ensureOfficialHolidaysRemote(): Promise<boolean> {
  if (remoteByYear) return true
  if (remoteLoadFailed) return false
  if (!remoteLoadPromise) {
    remoteLoadPromise = fetch(OFFICIAL_BASIC_URL)
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status))
        const json = (await res.json()) as Record<string, OfficialHolidayYearMap>
        remoteByYear = json
        for (const [y, map] of Object.entries(json)) {
          const year = Number(y)
          if (Number.isFinite(year)) bundledByYear[year] = map
        }
      })
      .catch(() => {
        remoteLoadFailed = true
        remoteByYear = {}
      })
  }
  await remoteLoadPromise
  return !remoteLoadFailed
}

export function getOfficialHolidayYearMap(
  year: number,
): OfficialHolidayYearMap | undefined {
  return (
    bundledByYear[year] ??
    remoteByYear?.[String(year)] ??
    provisionalByYear[String(year)]
  )
}

/** 관보 데이터 갱신 후 달력 캐시 무효화용 */
export function getOfficialHolidayYearMax(): number {
  const years = [
    ...Object.keys(bundledByYear).map(Number),
    ...Object.keys(provisionalByYear).map(Number),
    ...(remoteByYear ? Object.keys(remoteByYear).map(Number) : []),
  ].filter(Number.isFinite)
  return years.length > 0 ? Math.max(...years) : OFFICIAL_HOLIDAY_YEAR_MIN
}

export function isProvisionalOfficialYear(year: number): boolean {
  return (
    !bundledByYear[year] &&
    !!provisionalByYear[String(year)] &&
    !remoteByYear?.[String(year)]
  )
}
