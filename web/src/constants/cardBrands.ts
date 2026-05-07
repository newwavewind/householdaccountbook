/** 저장값은 `id`, 화면 표시는 `label` */
export const CARD_BRANDS = [
  { id: 'hyundai', label: '현대카드' },
  { id: 'samsung', label: '삼성카드' },
  { id: 'lotte', label: '롯데카드' },
  { id: 'kb', label: 'KB국민카드' },
  { id: 'shinhan', label: '신한카드' },
  { id: 'woori', label: '우리카드' },
  { id: 'hana', label: '하나카드' },
  { id: 'nh', label: 'NH농협카드' },
  { id: 'ibk', label: 'IBK기업은행' },
  { id: 'sc', label: 'SC제일은행' },
  { id: 'citi', label: '씨티카드' },
  { id: 'bc', label: 'BC카드' },
  { id: 'kakaobank', label: '카카오뱅크' },
  { id: 'kbank', label: '케이뱅크' },
  { id: 'toss', label: '토스뱅크' },
  { id: 'suhyup', label: '수협은행' },
  { id: 'mg', label: '새마을금고' },
  { id: 'cu', label: '신협' },
  { id: 'epost', label: '우체국' },
  { id: 'dgb', label: '대구은행' },
  { id: 'bnk', label: '부산은행' },
  { id: 'kdb', label: '산업은행' },
  { id: 'jeju', label: '제주은행' },
  { id: 'kjbank', label: '광주은행' },
  { id: 'mirae', label: '미래에셋대우' },
  { id: 'korea_invest', label: '한국투자증권' },
] as const

export type CardBrandId = (typeof CARD_BRANDS)[number]['id']

export function cardBrandLabel(cardBrandId: string | undefined): string | undefined {
  if (!cardBrandId) return undefined
  const hit = CARD_BRANDS.find((c) => c.id === cardBrandId)
  return hit?.label ?? cardBrandId
}
