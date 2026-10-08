import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import type { User } from '@supabase/supabase-js'
import type { RevenueAuth } from './auth.js'
import { getJobStore, type RevenueJob } from './jobs.js'

const user = (id: string): RevenueAuth => ({ mode: 'user', user: { id } as User, accessToken: 'test-token-not-sent' })
const local: RevenueAuth = { mode: 'local' }
function job(userId?: string): RevenueJob {
  return { id: randomUUID(), state: 'running', progress: 'fixture', apps: [], documents: [], errors: [], completed: [], started: Date.now(), userId }
}

test('memory and cloud warm-cache reads preserve job ownership without bypassing database RLS', async () => {
  const keys = ['SUPABASE_URL', 'VITE_SUPABASE_URL', 'REVENUE_JOB_BACKEND', 'VERCEL']
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]))
  try {
    for (const key of keys) delete process.env[key]
    const store = getJobStore(), owner = user('fixture-owner'), other = user('fixture-other')
    const owned = job('fixture-owner'), desktop = job()
    await store.set(owned, owner)
    await store.set(desktop, local)
    assert.equal((await store.get(owned.id, owner))?.id, owned.id)
    assert.equal(await store.get(owned.id, other), null)
    assert.equal(await store.get(owned.id, local), null)
    assert.equal(await store.get(desktop.id, owner), null)
    assert.equal((await store.get(desktop.id, local))?.id, desktop.id)
    assert.equal((await store.findRunning(owner))?.id, owned.id)
    assert.equal(await store.findRunning(other), null)
    assert.equal((await store.findRunning(local))?.id, desktop.id)
    // Select the cloud store without credentials: cached requests must resolve
    // locally after their ownership check and must never need a network call.
    process.env.SUPABASE_URL = 'https://fixture.invalid'
    process.env.REVENUE_JOB_BACKEND = 'supabase'
    const cloud = getJobStore()
    assert.equal((await cloud.get(owned.id, owner))?.id, owned.id)
    assert.equal(await cloud.get(owned.id, other), null)
    assert.equal(await cloud.get(desktop.id, owner), null)
    assert.equal(await cloud.get(owned.id, local), null)
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key]
      else process.env[key] = previous[key]
    }
  }
})
