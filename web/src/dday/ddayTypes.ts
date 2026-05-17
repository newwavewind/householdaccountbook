export type DdayKind = 'birthday' | 'baby' | 'couple' | 'exam' | 'custom'

export type DdayEventBase = {
  id: string
  title: string
  updatedAt: string
}

/** 매년 같은 날 (생일, 기념일) — 양력 또는 음력(매년 해당 음력의 양력일) */
export type DdayAnnualEvent = DdayEventBase &
  (
    | {
        kind: 'birthday' | 'couple'
        dateBasis: 'solar'
        month: number
        day: number
      }
    | {
        kind: 'birthday' | 'couple'
        dateBasis: 'lunar'
        lunarMonth: number
        lunarDay: number
        /** 윤달 여부 */
        lunarLeap: boolean
      }
  )

/** 아기 생일 — 양력 ISO 또는 음력 출생 변환 */
export type DdayBabyEvent = DdayEventBase &
  (
    | { kind: 'baby'; birthBasis: 'solar'; birthDate: string }
    | {
        kind: 'baby'
        birthBasis: 'lunar'
        /** 변환된 양력 생일 (표시·개월수 계산용) */
        birthDate: string
        birthLunarYear: number
        lunarMonth: number
        lunarDay: number
        lunarLeap: boolean
      }
  )

/** 일회성 목표일 (수능, 마감 등) */
export type DdayOnceEvent = DdayEventBase & {
  kind: 'exam' | 'custom'
  targetDate: string
}

export type DdayEvent = DdayAnnualEvent | DdayBabyEvent | DdayOnceEvent

export const DDAY_KIND_LABEL: Record<DdayKind, string> = {
  birthday: '가족 생일',
  baby: '아기 개월수',
  couple: '커플·기념일',
  exam: '시험·입시',
  custom: '디데이',
}
