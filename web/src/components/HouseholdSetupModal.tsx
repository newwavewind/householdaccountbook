import { useState } from 'react'
import { getSupabase } from '../lib/supabaseClient'
import { useLedger } from '../hooks/useLedger'

export default function HouseholdSetupModal() {
  const { setHouseholdId } = useLedger()
  const [tab, setTab] = useState<'create' | 'join'>('create')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleCreate = async () => {
    setLoading(true)
    setError(null)
    try {
      const sb = getSupabase()
      if (!sb) throw new Error('Supabase 연결 없음')
      const { data, error: rpcErr } = await sb.rpc('create_household_with_member')
      if (rpcErr) throw new Error(rpcErr.message)
      const result = data as { id: string; code: string }
      setHouseholdId(result.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleJoin = async () => {
    if (!code.trim()) { setError('코드를 입력하세요.'); return }
    setLoading(true)
    setError(null)
    try {
      const sb = getSupabase()
      if (!sb) throw new Error('Supabase 연결 없음')
      const { data, error: rpcErr } = await sb.rpc('join_household_by_code', { p_code: code.trim().toUpperCase() })
      if (rpcErr) {
        if (rpcErr.message.includes('code_not_found')) throw new Error('코드가 올바르지 않습니다.')
        if (rpcErr.message.includes('already_member')) throw new Error('이미 가구에 속해 있습니다.')
        throw new Error(rpcErr.message)
      }
      const result = data as { household_id: string }
      setHouseholdId(result.household_id)
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-2xl">
        <div className="p-6">
          <h2 className="text-lg font-bold text-gray-900">가계부 가구 설정</h2>
          <p className="mt-1 text-sm text-gray-500">
            가족과 가계부를 공유하려면 가구를 만들거나 기존 가구 코드로 참여하세요.
          </p>

          <div className="mt-5 flex rounded-xl bg-gray-100 p-1">
            <button
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${tab === 'create' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
              onClick={() => { setTab('create'); setError(null) }}
            >
              새 가구 만들기
            </button>
            <button
              className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${tab === 'join' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}
              onClick={() => { setTab('join'); setError(null) }}
            >
              코드로 참여
            </button>
          </div>

          {tab === 'create' ? (
            <div className="mt-5">
              <p className="text-sm text-gray-600">
                새 가구를 만들면 6자리 가족 코드가 발급됩니다.<br />
                아내(남편)에게 코드를 공유하면 함께 가계부를 볼 수 있습니다.
              </p>
              <button
                onClick={handleCreate}
                disabled={loading}
                className="mt-4 w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white disabled:opacity-50 active:bg-emerald-700"
              >
                {loading ? '생성 중…' : '가구 만들기'}
              </button>
            </div>
          ) : (
            <div className="mt-5">
              <p className="text-sm text-gray-600">가족에게 받은 6자리 코드를 입력하세요.</p>
              <input
                type="text"
                maxLength={6}
                placeholder="예: A3K9PQ"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="mt-3 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-center text-lg font-bold tracking-[0.3em] uppercase outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
              />
              <button
                onClick={handleJoin}
                disabled={loading || code.length < 6}
                className="mt-3 w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white disabled:opacity-50 active:bg-emerald-700"
              >
                {loading ? '참여 중…' : '참여하기'}
              </button>
            </div>
          )}

          {error && (
            <p className="mt-3 text-center text-sm text-red-500">{error}</p>
          )}
        </div>
      </div>
    </div>
  )
}
