import { getCommunitySupabase } from '../lib/communitySupabaseClient'
import { communityBackendMode } from '../lib/communityBackend'
import { parseVoterRef } from './communityGuest'
import type { CommunityPollSettings } from './communityPollTypes'

const MOCK_KEY = 'gaegyeobu-community-poll-votes-v2'
const MOCK_VOTERS_KEY = 'gaegyeobu-community-poll-voters-v2'

type VoteMap = Record<string, Record<string, number>>

export type PollVoter = {
  userId: string
  displayName: string
  optionId: string
  votedAt: string
}

export type PollVoteResult = {
  counts: Record<string, number>
  myOptionIds: string[]
  total: number
  voters: PollVoter[]
}

function mockKey(postId: string, pollId: string): string {
  return `${postId}::${pollId}`
}

function readMockVotes(): VoteMap {
  try {
    const raw = localStorage.getItem(MOCK_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as VoteMap
  } catch {
    return {}
  }
}

function writeMockVotes(map: VoteMap): void {
  localStorage.setItem(MOCK_KEY, JSON.stringify(map))
}

type VoterMap = Record<string, PollVoter[]>

function readMockVoters(): VoterMap {
  try {
    const raw = localStorage.getItem(MOCK_VOTERS_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as VoterMap
  } catch {
    return {}
  }
}

function writeMockVoters(map: VoterMap): void {
  localStorage.setItem(MOCK_VOTERS_KEY, JSON.stringify(map))
}

function bumpCount(bucket: Record<string, number>, optionId: string, delta: number): void {
  bucket[optionId] = Math.max(0, (bucket[optionId] ?? 0) + delta)
}

function voterIdentity(row: { user_id: string | null; voter_key: string | null }): string {
  if (row.user_id) return row.user_id
  return row.voter_key ? `guest:${row.voter_key}` : ''
}

export async function fetchPollVotes(
  postId: string,
  pollId: string,
  optionIds: string[],
  voterId: string | null,
): Promise<PollVoteResult> {
  const counts: Record<string, number> = {}
  for (const id of optionIds) counts[id] = 0

  const mode = communityBackendMode()
  if (mode === 'supabase' && getCommunitySupabase()) {
    const sb = getCommunitySupabase()!
    const { data: rows, error } = await sb
      .from('post_poll_votes')
      .select('option_id, user_id, voter_key, voter_display_name, created_at')
      .eq('post_id', postId)
      .eq('poll_id', pollId)
    if (error) throw new Error(error.message)

    const myOptionIds: string[] = []
    const voters: PollVoter[] = []
    for (const row of rows ?? []) {
      const r = row as {
        option_id: string
        user_id: string | null
        voter_key: string | null
        voter_display_name: string | null
        created_at: string
      }
      const identity = voterIdentity(r)
      counts[r.option_id] = (counts[r.option_id] ?? 0) + 1
      if (voterId && identity && identity === voterId) myOptionIds.push(r.option_id)
      voters.push({
        userId: identity,
        displayName: r.voter_display_name?.trim() || '\uC775\uBA85',
        optionId: r.option_id,
        votedAt: r.created_at,
      })
    }
    const total = new Set(voters.map((v) => v.userId).filter(Boolean)).size
    return { counts, myOptionIds, total, voters }
  }

  const map = readMockVotes()
  const votersMap = readMockVoters()
  const key = mockKey(postId, pollId)
  const bucket = map[key] ?? {}
  for (const id of optionIds) counts[id] = bucket[id] ?? 0
  const voters = votersMap[key] ?? []
  const myOptionIds = voterId ? voters.filter((v) => v.userId === voterId).map((v) => v.optionId) : []
  const total = new Set(voters.map((v) => v.userId)).size
  return { counts, myOptionIds, total, voters }
}

export async function castPollVote(
  postId: string,
  pollId: string,
  optionId: string,
  voterId: string,
  displayName: string,
  settings: CommunityPollSettings,
): Promise<void> {
  const current = await fetchPollVotes(postId, pollId, [optionId], voterId)
  const hasVoted = current.myOptionIds.length > 0
  const alreadyThis = current.myOptionIds.includes(optionId)

  if (settings.allowMultiple) {
    if (alreadyThis) {
      await removePollVote(postId, pollId, optionId, voterId)
      return
    }
    if (current.myOptionIds.length >= settings.maxSelections) {
      throw new Error(`\uCD5C\uB300 ${settings.maxSelections}\uAC1C\uAE4C\uC9C0 \uC120\uD0DD\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.`)
    }
    await addPollVote(postId, pollId, optionId, voterId, displayName)
    return
  }

  if (alreadyThis) return
  if (hasVoted && !settings.allowRevote) {
    throw new Error('\uC7AC\uD22C\uD45C\uAC00 \uD5C8\uC6A9\uB418\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4.')
  }
  if (hasVoted) {
    for (const prev of current.myOptionIds) {
      await removePollVote(postId, pollId, prev, voterId)
    }
  }
  await addPollVote(postId, pollId, optionId, voterId, displayName)
}

function buildPollVoteRow(
  postId: string,
  pollId: string,
  optionId: string,
  voterId: string,
  displayName: string,
): Record<string, string> {
  const { userId, voterKey } = parseVoterRef(voterId)
  const row: Record<string, string> = {
    post_id: postId,
    poll_id: pollId,
    option_id: optionId,
    voter_display_name: displayName,
  }
  if (userId) row.user_id = userId
  else row.voter_key = voterKey!
  return row
}

async function addPollVote(
  postId: string,
  pollId: string,
  optionId: string,
  voterId: string,
  displayName: string,
): Promise<void> {
  const mode = communityBackendMode()
  if (mode === 'supabase' && getCommunitySupabase()) {
    const sb = getCommunitySupabase()!
    const { error } = await sb
      .from('post_poll_votes')
      .insert(buildPollVoteRow(postId, pollId, optionId, voterId, displayName))
    if (error) throw new Error(error.message)
    return
  }

  const map = readMockVotes()
  const votersMap = readMockVoters()
  const key = mockKey(postId, pollId)
  const bucket = { ...(map[key] ?? {}) }
  bumpCount(bucket, optionId, 1)
  map[key] = bucket
  writeMockVotes(map)
  const voters = [...(votersMap[key] ?? [])]
  voters.push({
    userId: voterId,
    displayName,
    optionId,
    votedAt: new Date().toISOString(),
  })
  votersMap[key] = voters
  writeMockVoters(votersMap)
}

async function removePollVote(
  postId: string,
  pollId: string,
  optionId: string,
  voterId: string,
): Promise<void> {
  const mode = communityBackendMode()
  if (mode === 'supabase' && getCommunitySupabase()) {
    const sb = getCommunitySupabase()!
    const { userId, voterKey } = parseVoterRef(voterId)
    let q = sb
      .from('post_poll_votes')
      .delete()
      .eq('post_id', postId)
      .eq('poll_id', pollId)
      .eq('option_id', optionId)
    if (userId) q = q.eq('user_id', userId)
    else q = q.eq('voter_key', voterKey!)
    const { error } = await q
    if (error) throw new Error(error.message)
    return
  }

  const map = readMockVotes()
  const votersMap = readMockVoters()
  const key = mockKey(postId, pollId)
  const bucket = { ...(map[key] ?? {}) }
  bumpCount(bucket, optionId, -1)
  map[key] = bucket
  writeMockVotes(map)
  votersMap[key] = (votersMap[key] ?? []).filter(
    (v) => !(v.userId === voterId && v.optionId === optionId),
  )
  writeMockVoters(votersMap)
}
