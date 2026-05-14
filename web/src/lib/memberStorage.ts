const STORAGE_KEY = 'household-members'

export function loadMembers(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (Array.isArray(parsed)) return parsed.filter((x): x is string => typeof x === 'string')
  } catch {
    // ignore
  }
  return []
}

export function saveMembers(members: string[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(members))
}

export function addMember(name: string): string[] {
  const trimmed = name.trim()
  if (!trimmed) return loadMembers()
  const current = loadMembers()
  if (current.includes(trimmed)) return current
  const next = [...current, trimmed]
  saveMembers(next)
  return next
}

export function removeMember(name: string): string[] {
  const next = loadMembers().filter((m) => m !== name)
  saveMembers(next)
  return next
}
