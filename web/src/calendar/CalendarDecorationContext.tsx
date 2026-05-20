import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { CSSProperties } from 'react'
import { useLedger } from '../hooks/useLedger'
import {
  CALENDAR_DECO_CHANGED_EVENT,
  cloneCalendarDecoration,
  loadCalendarDecoration,
  saveCalendarDecoration,
  type CalendarDecoration,
  type CalendarPhotoZone,
} from './calendarDecorationStorage'
import { hasCalendarPhoto } from './calendarDecorationStorage'
import {
  calendarDecorationHostStyle,
  isCalendarDecorated,
  zoneLayerStyle,
  zonePhotoActive,
  type CalendarDecoStrength,
} from './calendarDecorationStyles'

type CalendarDecorationContextValue = {
  /** 저장·적용된 설정 */
  decoration: CalendarDecoration
  /** 패널 미리보기(저장 전) */
  preview: CalendarDecoration
  setPreview: (next: CalendarDecoration) => void
  applyDecoration: (next: CalendarDecoration) => void
  revertPreview: () => void
  decorated: boolean
  hostStyle: CSSProperties | undefined
  zoneLayerStyle: (
    zone: CalendarPhotoZone,
    strength?: CalendarDecoStrength,
  ) => CSSProperties | undefined
  zonePhotoActive: (zone: CalendarPhotoZone) => boolean
}

const CalendarDecorationContext =
  createContext<CalendarDecorationContextValue | null>(null)

export function CalendarDecorationProvider({ children }: { children: ReactNode }) {
  const { householdId } = useLedger()
  const [decoration, setDecorationState] = useState(() =>
    loadCalendarDecoration(),
  )
  const [preview, setPreviewState] = useState(() =>
    cloneCalendarDecoration(loadCalendarDecoration()),
  )

  const reload = useCallback(() => {
    const next = loadCalendarDecoration(householdId)
    setDecorationState(next)
    setPreviewState(cloneCalendarDecoration(next))
  }, [householdId])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    const onChange = () => reload()
    window.addEventListener(CALENDAR_DECO_CHANGED_EVENT, onChange)
    return () => window.removeEventListener(CALENDAR_DECO_CHANGED_EVENT, onChange)
  }, [reload])

  const applyDecoration = useCallback(
    (next: CalendarDecoration) => {
      const cloned = cloneCalendarDecoration(next)
      setDecorationState(cloned)
      setPreviewState(cloneCalendarDecoration(cloned))
      saveCalendarDecoration(cloned, householdId)
    },
    [householdId],
  )

  const setPreview = useCallback((next: CalendarDecoration) => {
    setPreviewState(cloneCalendarDecoration(next))
  }, [])

  const revertPreview = useCallback(() => {
    setPreviewState(cloneCalendarDecoration(decoration))
  }, [decoration])

  const decorated = isCalendarDecorated(preview)
  const hostStyle = useMemo(() => calendarDecorationHostStyle(preview), [preview])

  const zoneLayer = useCallback(
    (zone: CalendarPhotoZone, strength: CalendarDecoStrength = 'card') =>
      zoneLayerStyle(preview, zone, strength),
    [preview],
  )

  const zoneActive = useCallback(
    (zone: CalendarPhotoZone) => zonePhotoActive(preview, zone),
    [preview],
  )

  const value = useMemo(
    () => ({
      decoration,
      preview,
      setPreview,
      applyDecoration,
      revertPreview,
      decorated: decorated || hasCalendarPhoto(decoration),
      hostStyle,
      zoneLayerStyle: zoneLayer,
      zonePhotoActive: zoneActive,
    }),
    [
      decoration,
      preview,
      setPreview,
      applyDecoration,
      revertPreview,
      decorated,
      hostStyle,
      zoneLayer,
      zoneActive,
    ],
  )

  return (
    <CalendarDecorationContext.Provider value={value}>
      {children}
    </CalendarDecorationContext.Provider>
  )
}

export function useCalendarDecoration(): CalendarDecorationContextValue {
  const ctx = useContext(CalendarDecorationContext)
  if (!ctx) {
    throw new Error('useCalendarDecoration requires CalendarDecorationProvider')
  }
  return ctx
}
