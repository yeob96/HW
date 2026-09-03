export type DealType = '매매' | '전세' | '월세'
export type CommuteMode = 'transit' | 'car'
export type PropertyType = '아파트' | '오피스텔' | '빌라' | '단독/다가구'

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
  propertyType: PropertyType
  price: number
  deposit: number
  monthlyRent: number
  area: number
  dealDate: string
}

export interface AreaRange {
  min: number
  max: number
}

export interface BudgetCondition {
  dealType: DealType
  /** 매매·전세: 만원 단위 총액 범위 / 월세: 보증금 범위 */
  minPrice: number
  maxPrice: number
  /** 월세일 때만 사용 (만원) */
  minMonthlyRent?: number
  maxMonthlyRent?: number
  propertyTypes: PropertyType[]
  /** 주택 유형별 전용면적(㎡) 범위 */
  areaRanges: Record<PropertyType, AreaRange>
}

export interface SearchCondition {
  workplace: Workplace
  commuteMode: CommuteMode
  maxMinutes: number
  budget: BudgetCondition
}
