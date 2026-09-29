/** Shared credential helpers for local files or Vercel env PEMs/JSON. */
import { existsSync, readFileSync } from 'node:fs'

function stripQuotes(raw: string | undefined): string {
  if (!raw) return ''
  const t = raw.trim()
  if (t.length >= 2 && ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'")))) {
    return t.slice(1, -1)
  }
  return t
}

export function envPem(pemKey: string, pathKey: string): Buffer | null {
  const pem = stripQuotes(process.env[pemKey])
  if (pem.includes('BEGIN')) {
    return Buffer.from(pem.replace(/\\n/g, '\n'))
  }
  const path = stripQuotes(process.env[pathKey])
  if (path && existsSync(path)) return readFileSync(path)
  return null
}

export function googleServiceAccount(): { client_email: string; private_key: string } | null {
  const raw = stripQuotes(process.env.GOOGLE_PLAY_SA_JSON || process.env.GOOGLE_PLAY_SA_JSON_INLINE || '')
  if (!raw) return null
  try {
    if (raw.startsWith('{')) return JSON.parse(raw)
    if (existsSync(raw)) return JSON.parse(readFileSync(raw, 'utf8'))
  } catch {
    return null
  }
  return null
}

export function isCloudRuntime(): boolean {
  return Boolean(process.env.VERCEL || process.env.REVENUE_CLOUD === '1')
}
