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

// ───────────────────────── 부동산 경매 ─────────────────────────

export type AuctionPropertyType = '아파트' | '오피스텔' | '다세대' | '단독주택' | '근린상가' | '토지'

/** 물건 진행 상태 */
export type AuctionStatus = '신건' | '유찰' | '재매각' | '변경' | '매각'

/** 낙찰 후 인수될 수 있어 따로 확인해야 하는 권리 (특수권리) */
export type AuctionRight =
  | '유치권'
  | '법정지상권'
  | '지분매각'
  | '선순위임차인'
  | '대지권미등기'
  | '토지별도등기'
  | '분묘기지권'
  | '가처분'

/** 임차인 대항력 — 낙찰자가 보증금을 인수해야 하는지와 직결된다 */
export type TenantStatus = '임차인 없음' | '대항력 없음' | '대항력 있음' | '조사 필요'

export type AuctionScheduleResult = '유찰' | '변경' | '매각' | '진행예정'

/** 회차별 매각기일 이력 */
export interface AuctionSchedule {
  round: number
  date: string
  /** 그 회차의 최저매각가격(만원) */
  minimumPrice: number
  result: AuctionScheduleResult
}

export interface AuctionItem {
  /** `${caseNo}-${itemNo}` */
  id: string
  /** 사건번호 (예: 2025타경12345) */
  caseNo: string
  /** 물건번호 — 한 사건에 여러 물건이 묶일 수 있다 */
  itemNo: number
  court: string
  dongCode: string
  regionName: string
  address: string
  lat: number
  lng: number
  propertyType: AuctionPropertyType
  buildingName: string
  /** 전용면적(㎡) */
  exclusiveArea: number
  /** 대지권/토지면적(㎡) */
  landArea: number
  /** 감정가(만원) */
  appraisalPrice: number
  /** 현재 최저매각가격(만원) */
  minimumPrice: number
  /** 입찰보증금(만원) — 최저매각가격의 10% */
  bidDeposit: number
  /** 유찰 횟수 */
  failedCount: number
  status: AuctionStatus
  /** 다음 매각기일 (매각된 물건은 낙찰된 기일) */
  saleDate: string
  schedules: AuctionSchedule[]
  rights: AuctionRight[]
  tenant: TenantStatus
  /** 인근 시세 추정가(만원) — 최저가가 시세보다 얼마나 싼지 보기 위한 기준값 */
  marketPrice: number
}

export type AuctionSort = 'saleDate' | 'discount' | 'priceAsc' | 'priceDesc'

export interface AuctionFilter {
  /** 선택한 지역(법정동코드). 비어 있으면 전체 */
  dongCodes: string[]
  propertyTypes: AuctionPropertyType[]
  /** 최저매각가격 범위(만원) */
  minPrice: number
  maxPrice: number
  /** 최소 유찰 횟수 */
  minFailedCount: number
  /** 특수권리가 붙은 물건 제외 */
  excludeRisky: boolean
  /** 기일이 아직 남은 물건만 */
  onlyUpcoming: boolean
  sort: AuctionSort
}
