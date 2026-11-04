import { createHash, sign } from 'node:crypto'
import type { RevenueJob } from './jobs.js'

export function refreshContents(job: RevenueJob) {
  return JSON.stringify({ apps: job.apps, documents: job.documents, errors: job.errors, completed: job.completed })
}
/** Only called on the live provider result, never on a job loaded from user-writable storage. */
export function signRefreshResult(job: RevenueJob, key = process.env.REVENUE_REFRESH_SIGNING_KEY): string {
  if (!key || !job.userId || !job.sharedOwnerId) throw new Error('공유 새로고침 서버 서명 설정을 확인해 주세요.')
  const payload = Buffer.from(JSON.stringify({
    jobId: job.id, viewerId: job.userId, ownerId: job.sharedOwnerId,
    digest: createHash('sha256').update(refreshContents(job)).digest('hex'),
    exp: Math.floor(Date.now()/1000) + 3600,
  })).toString('base64url')
  return `${payload}.${sign('RSA-SHA256', Buffer.from(payload), key).toString('base64url')}`
}
