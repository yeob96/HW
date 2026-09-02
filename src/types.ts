export type DealType = '매매' | '전세' | '월세'
export type CommuteMode = 'transit' | 'car'

export interface Workplace {
  name: string
  lat: number
  lng: number
}

export interface RegionBase {
  dongCode: string
  regionName: string
  lat: number
  lng: number
  /** 매매 평균 총액(만원) — 다른 거래유형 시세의 기준값 */
  basePriceEok: number
}

export interface RegionResult extends RegionBase {
  transitMinutes: number
  carMinutes: number
  commuteMinutes: number
  avgPrice: number
  avgDeposit: number
  avgMonthlyRent: number
  transactionCount: number
}

export interface Transaction {
  id: string
  dongCode: string
  aptName: string
  address: string
  dealType: DealType
  price: number
  deposit: number
  monthlyRent: number
  area: number
  dealDate: string
}

export interface BudgetCondition {
  dealType: DealType
  /** 매매·전세: 만원 단위 총액 범위 / 월세: 보증금 범위 */
  minPrice: number
  maxPrice: number
  /** 월세일 때만 사용 (만원) */
  maxMonthlyRent?: number
}

export interface SearchCondition {
  workplace: Workplace
  commuteMode: CommuteMode
  maxMinutes: number
  budget: BudgetCondition
}
