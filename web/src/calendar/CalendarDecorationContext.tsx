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
  loadCalendarDecoration,
  saveCalendarDecoration,
  type CalendarDecoration,
} from './calendarDecorationStorage'
import {
  CALENDAR_DECO_STRENGTH,
  calendarDecorationHostStyle,
  calendarDecorationLayerStyle,
  isCalendarDecorated,
  type CalendarDecoStrength,
} from './calendarDecorationStyles'

type CalendarDecorationContextValue = {
  decoration: CalendarDecoration
  setDecoration: (next: CalendarDecoration) => void
  decorated: boolean
  layerStyle: (strength: CalendarDecoStrength) => CSSProperties | undefined
  hostStyle: CSSProperties | undefined
}

const CalendarDecorationContext =
  createContext<CalendarDecorationContextValue | null>(null)

export function CalendarDecorationProvider({ children }: { children: ReactNode }) {
  const { householdId } = useLedger()
  const [decoration, setDecorationState] = useState(() =>
    loadCalendarDecoration(),
  )

  const reload = useCallback(() => {
    setDecorationState(loadCalendarDecoration(householdId))
  }, [householdId])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    const onChange = () => reload()
    window.addEventListener(CALENDAR_DECO_CHANGED_EVENT, onChange)
    return () => window.removeEventListener(CALENDAR_DECO_CHANGED_EVENT, onChange)
  }, [reload])

  const setDecoration = useCallback(
    (next: CalendarDecoration) => {
      setDecorationState(next)
      saveCalendarDecoration(next, householdId)
    },
    [householdId],
  )

  const decorated = isCalendarDecorated(decoration)

  const layerStyle = useCallback(
    (strength: CalendarDecoStrength) => {
      if (!decorated) return undefined
      return calendarDecorationLayerStyle(
        decoration,
        CALENDAR_DECO_STRENGTH[strength],
      )
    },
    [decoration, decorated],
  )

  const hostStyle = useMemo(
    () => calendarDecorationHostStyle(decoration),
    [decoration],
  )

  const value = useMemo(
    () => ({ decoration, setDecoration, decorated, layerStyle, hostStyle }),
    [decoration, setDecoration, decorated, layerStyle, hostStyle],
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
