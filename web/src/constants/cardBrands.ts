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

/** 통계·차트용 — 카드사마다 고정 색 (막대·도넛 구분) */
export const CARD_BRAND_LEGACY_CHART_ID = '__legacy_card__'

const CARD_BRAND_CHART_COLOR_BY_ID: Record<string, string> = {
  hyundai: '#1E5BAA',
  samsung: '#2D3B9F',
  lotte: '#E31837',
  kb: '#D4A017',
  shinhan: '#0046FF',
  woori: '#0082CA',
  hana: '#00857A',
  nh: '#00A04A',
  ibk: '#003D7A',
  sc: '#0072CE',
  citi: '#056DAE',
  bc: '#D41317',
  kakaobank: '#3A2920',
  kbank: '#5C2D91',
  toss: '#3182F6',
  suhyup: '#0067B3',
  mg: '#2E7D32',
  cu: '#6D4C41',
  epost: '#C62828',
  dgb: '#1565C0',
  bnk: '#E65100',
  kdb: '#546E7A',
  jeju: '#FF6F00',
  kjbank: '#7B1FA2',
  mirae: '#F57C00',
  korea_invest: '#C2185B',
  [CARD_BRAND_LEGACY_CHART_ID]: '#9CA3AF',
}

const CARD_BRAND_CHART_FALLBACK = [
  '#E53935',
  '#8E24AA',
  '#3949AB',
  '#00897B',
  '#FB8C00',
  '#5D4037',
  '#00ACC1',
  '#D81B60',
  '#5E35B1',
  '#43A047',
] as const

export function cardBrandChartColor(brandId: string): string {
  const fixed = CARD_BRAND_CHART_COLOR_BY_ID[brandId]
  if (fixed) return fixed
  let h = 0
  for (let i = 0; i < brandId.length; i++) {
    h = (h * 31 + brandId.charCodeAt(i)) >>> 0
  }
  return CARD_BRAND_CHART_FALLBACK[h % CARD_BRAND_CHART_FALLBACK.length]!
}
