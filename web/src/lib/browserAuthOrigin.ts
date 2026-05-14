/** 브라우저 주소창 기준 origin (Google「승인된 JavaScript 원본」과 문자 단위로 일치해야 함) */
export function browserAuthOrigin(): string {
  if (typeof window === 'undefined') return 'http://localhost:5173'
  return window.location.origin
}
