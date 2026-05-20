const NICKNAME_MIN = 2
const NICKNAME_MAX = 24

const ADJECTIVES = [
  '맑은',
  '조용한',
  '행복한',
  '용감한',
  '따뜻한',
  '반짝',
  '느긋한',
  '든든한',
] as const

const NOUNS = [
  '고양이',
  '다람쥐',
  '별빛',
  '구름',
  '바람',
  '연잎',
  '솔방울',
  '달토끼',
] as const

export function normalizeNickname(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ')
}

export function isValidNickname(raw: string): boolean {
  const n = normalizeNickname(raw)
  if (n.length < NICKNAME_MIN || n.length > NICKNAME_MAX) return false
  if (n.includes('@')) return false
  if (/^\d+$/.test(n)) return false
  return /^[\p{L}\p{N}\s._-]+$/u.test(n)
}

export function nicknameValidationMessage(raw: string): string | null {
  const n = normalizeNickname(raw)
  if (!n) return '닉네임을 입력하세요.'
  if (n.length < NICKNAME_MIN) return `닉네임은 ${NICKNAME_MIN}자 이상이어야 합니다.`
  if (n.length > NICKNAME_MAX) return `닉네임은 ${NICKNAME_MAX}자까지 가능합니다.`
  if (n.includes('@')) return '이메일 형식은 닉네임으로 쓸 수 없습니다.'
  if (/^\d+$/.test(n)) return '숫자만으로는 닉네임을 만들 수 없습니다.'
  if (!/^[\p{L}\p{N}\s._-]+$/u.test(n)) {
    return '한글·영문·숫자와 . _ - 만 사용할 수 있습니다.'
  }
  return null
}

export function suggestRandomNickname(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)]!
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)]!
  const num = Math.floor(Math.random() * 90) + 10
  return `${adj}${noun}${num}`.slice(0, NICKNAME_MAX)
}
