import { userSupabase, type RevenueAuth } from './auth.js'

export type RevenueApp = {
  id: string
  name: string
  platform: 'apple' | 'google'
  bundleId: string
  version: string
  build: string
  status: string
  updatedAt: string
  source: 'api'
}

export type RevenueDocument = {
  key: string
  name: string
  text: string
  period: string
}

export type RevenueJob = {
  id: string
  state: 'running' | 'done'
  progress: string
  apps: RevenueApp[]
  documents: RevenueDocument[]
  errors: string[]
  completed: string[]
  started: number
  userId?: string
}

type JobStore = {
  get(id: string, auth: RevenueAuth): Promise<RevenueJob | null>
  set(job: RevenueJob, auth: RevenueAuth): Promise<void>
  findRunning(auth: RevenueAuth): Promise<RevenueJob | null>
}

const memory = new Map<string, RevenueJob>()
/** Cloud/local sync jobs stuck after a poll/route crash must not block forever. */
const STALE_MS = 12 * 60 * 1000

function isFreshRunning(job: RevenueJob) {
  return job.state === 'running' && Date.now() - job.started < STALE_MS
}

const memoryStore: JobStore = {
  async get(id) {
    return memory.get(id) || null
  },
  async set(job) {
    memory.set(job.id, job)
    for (const [id, j] of memory) {
      if (Date.now() - j.started > 30 * 60 * 1000) memory.delete(id)
    }
  },
  async findRunning(auth) {
    const userId = auth.mode === 'user' ? auth.user.id : undefined
    const hit = [...memory.values()].find(
      (j) => j.state === 'running' && (!userId || j.userId === userId),
    )
    if (!hit) return null
    if (isFreshRunning(hit)) return hit
    hit.state = 'done'
    hit.progress = '시간 초과로 종료됨'
    hit.errors = [
      ...(hit.errors || []),
      '이전 동기화가 응답 없이 남아 자동 종료했습니다. 다시 동기화해 주세요.',
    ]
    memory.set(hit.id, hit)
    return null
  },
}

function serializeResult(job: RevenueJob) {
  return {
    apps: job.apps,
    documents: job.documents,
    errors: job.errors,
    completed: job.completed,
  }
}

const supabaseStore: JobStore = {
  async get(id, auth) {
    if (auth.mode !== 'user') return memoryStore.get(id, auth)
    const mem = memory.get(id)
    if (mem) return mem
    const sb = userSupabase(auth.accessToken)
    const { data, error } = await sb
      .from('app_revenue_jobs')
      .select('id,state,progress,result,created_at')
      .eq('id', id)
      .maybeSingle()
    if (error || !data) return null
    const result = (data.result || {}) as Partial<RevenueJob>
    return {
      id: data.id,
      state: data.state as 'running' | 'done',
      progress: data.progress || '',
      apps: result.apps || [],
      documents: result.documents || [],
      errors: result.errors || [],
      completed: result.completed || [],
      started: Date.parse(data.created_at) || Date.now(),
      userId: auth.user.id,
    }
  },
  async set(job, auth) {
    memory.set(job.id, job)
    if (auth.mode !== 'user') return
    const sb = userSupabase(auth.accessToken)
    const row = {
      id: job.id,
      user_id: auth.user.id,
      state: job.state,
      progress: job.progress,
      result: job.state === 'done' ? serializeResult(job) : { errors: job.errors, completed: job.completed },
      updated_at: new Date().toISOString(),
    }
    const { error } = await sb.from('app_revenue_jobs').upsert(row)
    if (error) {
      // Keep memory copy; surface later via job.errors when possible.
      job.errors.push(`동기화 상태 저장 실패: ${error.message}`)
    }
  },
  async findRunning(auth) {
    const local = await memoryStore.findRunning(auth)
    if (local) return local
    if (auth.mode !== 'user') return null
    const sb = userSupabase(auth.accessToken)
    const { data } = await sb
      .from('app_revenue_jobs')
      .select('id,state,progress,result,created_at')
      .eq('state', 'running')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!data) return null
    return {
      id: data.id,
      state: 'running',
      progress: data.progress || '',
      apps: [],
      documents: [],
      errors: [],
      completed: [],
      started: Date.parse(data.created_at) || Date.now(),
      userId: auth.user.id,
    }
  },
}

export function getJobStore(): JobStore {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  if (url.startsWith('http') && (process.env.VERCEL || process.env.REVENUE_JOB_BACKEND === 'supabase')) {
    return supabaseStore
  }
  return memoryStore
}

export async function persistJobProgress(job: RevenueJob, auth: RevenueAuth) {
  // Throttle cloud writes while running: every ~4s or on done.
  const store = getJobStore()
  const key = `__lastPersist:${job.id}`
  const g = globalThis as unknown as Record<string, number>
  const now = Date.now()
  if (job.state !== 'done' && g[key] && now - g[key] < 4000) return
  g[key] = now
  await store.set(job, auth)
}
