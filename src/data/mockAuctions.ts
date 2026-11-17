import type {
  AuctionFilter,
  AuctionItem,
  AuctionPropertyType,
  AuctionRight,
  AuctionSchedule,
  AuctionStatus,
  RegionBase,
  TenantStatus,
} from '../types'
import { REGIONS } from './regions'
import { createRng } from '../utils/rng'

/**
 * 프로토타입: 법원경매정보(courtauction.go.kr) 수집 데이터 대신
 * 지역 시드 기반으로 결정론적 목업 경매 물건을 생성한다.
 * 필드 구성은 실제 경매 물건명세서와 같게 맞춰, 나중에 수집기를 붙일 때 화면을 그대로 쓸 수 있게 했다.
 */

/** 서울 지역 법원은 유찰 1회당 최저매각가격을 20% 저감한다 */
export const PRICE_CUT_RATE = 0.8

/** 입찰보증금 = 최저매각가격의 10% */
export const BID_DEPOSIT_RATE = 0.1

/** 최저매각가 필터 슬라이더 범위(만원) — 상한에 닿으면 "제한 없음"으로 취급 */
export const AUCTION_PRICE_RANGE = { min: 0, max: 300000 }

/** 매각기일 간격 — 유찰되면 통상 한 달 뒤 다음 기일이 잡힌다 */
const DAYS_BETWEEN_ROUNDS = 35

const NOW = new Date()
const TODAY = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate())

/** 관할 법원 — 자치구 기준 */
const COURT_BY_GU: Record<string, string> = {
  강남구: '서울중앙지방법원',
  서초구: '서울중앙지방법원',
  관악구: '서울중앙지방법원',
  동작구: '서울중앙지방법원',
  송파구: '서울동부지방법원',
  강동구: '서울동부지방법원',
  성동구: '서울동부지방법원',
  광진구: '서울동부지방법원',
  영등포구: '서울남부지방법원',
  구로구: '서울남부지방법원',
  금천구: '서울남부지방법원',
  양천구: '서울남부지방법원',
  노원구: '서울북부지방법원',
  도봉구: '서울북부지방법원',
  강북구: '서울북부지방법원',
  중랑구: '서울북부지방법원',
  마포구: '서울서부지방법원',
  서대문구: '서울서부지방법원',
  은평구: '서울서부지방법원',
  용산구: '서울서부지방법원',
}

export const ALL_AUCTION_PROPERTY_TYPES: AuctionPropertyType[] = [
  '아파트',
  '오피스텔',
  '다세대',
  '단독주택',
  '근린상가',
  '토지',
]

export const ALL_RIGHTS: AuctionRight[] = [
  '유치권',
  '법정지상권',
  '지분매각',
  '선순위임차인',
  '대지권미등기',
  '토지별도등기',
  '분묘기지권',
  '가처분',
]

/** 특수권리별 한 줄 설명 — 상세 화면의 권리분석 안내에 쓴다 */
export const RIGHT_NOTES: Record<AuctionRight, string> = {
  유치권: '공사대금 등을 이유로 점유자가 인도를 거부할 수 있어, 낙찰 후 별도 비용이 들 수 있습니다.',
  법정지상권: '토지만 매각되고 건물 소유자의 사용권이 남아, 토지를 자유롭게 쓰지 못할 수 있습니다.',
  지분매각: '공유지분만 매각되어 단독으로 처분·사용하기 어렵고 공유물분할 절차가 필요합니다.',
  선순위임차인: '말소기준권리보다 앞선 임차인이 있어 낙찰자가 보증금을 인수할 수 있습니다.',
  대지권미등기: '대지지분이 등기되지 않아 추후 대지권 확보에 추가 비용·절차가 필요할 수 있습니다.',
  토지별도등기: '토지에 별도의 권리가 설정되어 있어 건물만 취득하는 결과가 될 수 있습니다.',
  분묘기지권: '묘지가 있어 연고자 동의 없이 이전할 수 없고, 토지 활용이 제한됩니다.',
  가처분: '처분을 금지하는 가처분이 남아 소유권 행사에 다툼이 생길 수 있습니다.',
}

/** 물건종류별 등장 가중치 — 실제 경매도 아파트·다세대가 가장 많다 */
const TYPE_WEIGHTS: Array<[AuctionPropertyType, number]> = [
  ['아파트', 32],
  ['다세대', 26],
  ['오피스텔', 14],
  ['근린상가', 12],
  ['단독주택', 10],
  ['토지', 6],
]

/** 물건종류별 시세 배수 — 같은 동네 아파트 평균가를 1로 본 상대값 */
const TYPE_PRICE_FACTOR: Record<AuctionPropertyType, number> = {
  아파트: 1,
  오피스텔: 0.5,
  다세대: 0.42,
  단독주택: 1.35,
  근린상가: 0.85,
  토지: 0.6,
}

/** 물건종류별로 실제로 붙을 수 있는 특수권리만 추린다 */
const RIGHTS_BY_TYPE: Record<AuctionPropertyType, AuctionRight[]> = {
  아파트: ['선순위임차인', '지분매각', '가처분', '대지권미등기'],
  오피스텔: ['선순위임차인', '지분매각', '가처분'],
  다세대: ['선순위임차인', '대지권미등기', '토지별도등기', '지분매각'],
  단독주택: ['유치권', '선순위임차인', '지분매각', '법정지상권'],
  근린상가: ['유치권', '선순위임차인', '가처분', '토지별도등기'],
  토지: ['법정지상권', '분묘기지권', '지분매각', '가처분'],
}

const APT_POOL = [
  '래미안',
  '푸르지오',
  '자이',
  'e편한세상',
  '힐스테이트',
  '더샵',
  '아이파크',
  '롯데캐슬',
  '센트레빌',
  '파크뷰',
]
const OFFICE_POOL = ['트라팰리스', '스카이타워', '시티프라자', '비즈센터', '리버뷰']
const VILLA_SUFFIX = ['빌라', '하우스', '주택', '맨션']
const SHOP_SUFFIX = ['프라자', '빌딩', '상가', '타워']
const LAND_LABEL = ['대지', '전', '답', '임야']

function pick<T>(pool: T[], rng: () => number): T {
  return pool[Math.floor(rng() * pool.length)]
}

function pickWeighted(rng: () => number): AuctionPropertyType {
  const total = TYPE_WEIGHTS.reduce((sum, [, weight]) => sum + weight, 0)
  let roll = rng() * total
  for (const [type, weight] of TYPE_WEIGHTS) {
    roll -= weight
    if (roll <= 0) return type
  }
  return '아파트'
}

function guOf(regionName: string): string {
  return regionName.split(' ')[0] ?? ''
}

function dongOf(regionName: string): string {
  return regionName.split(' ')[1] ?? regionName
}

function courtOf(regionName: string): string {
  return COURT_BY_GU[guOf(regionName)] ?? '서울중앙지방법원'
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  return d
}

function isoDate(d: Date): string {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString()
}

function buildingNameOf(type: AuctionPropertyType, regionName: string, rng: () => number): string {
  const dong = dongOf(regionName)
  switch (type) {
    case '아파트': {
      const dongNo = 101 + Math.floor(rng() * 12)
      const floor = 1 + Math.floor(rng() * 20)
      const unit = 1 + Math.floor(rng() * 4)
      return `${pick(APT_POOL, rng)} ${1 + Math.floor(rng() * 4)}차 ${dongNo}동 ${floor}0${unit}호`
    }
    case '오피스텔':
      return `${dong} ${pick(OFFICE_POOL, rng)} ${3 + Math.floor(rng() * 15)}0${1 + Math.floor(rng() * 8)}호`
    case '다세대':
      return `${dong}${pick(VILLA_SUFFIX, rng)} ${pick(['가', '나', '다'], rng)}동 ${1 + Math.floor(rng() * 4)}0${1 + Math.floor(rng() * 3)}호`
    case '단독주택':
      return `${dong} 단독주택`
    case '근린상가':
      return `${dong} ${pick(SHOP_SUFFIX, rng)} ${1 + Math.floor(rng() * 5)}층 ${1 + Math.floor(rng() * 9)}호`
    case '토지':
      return `${dong} ${pick(LAND_LABEL, rng)}`
  }
}

function areasOf(type: AuctionPropertyType, rng: () => number): { exclusiveArea: number; landArea: number } {
  const round1 = (v: number) => Math.round(v * 10) / 10
  switch (type) {
    case '아파트':
      return { exclusiveArea: round1(39 + rng() * 85), landArea: round1(20 + rng() * 45) }
    case '오피스텔':
      return { exclusiveArea: round1(18 + rng() * 42), landArea: round1(5 + rng() * 14) }
    case '다세대':
      return { exclusiveArea: round1(28 + rng() * 45), landArea: round1(18 + rng() * 32) }
    case '단독주택':
      return { exclusiveArea: round1(70 + rng() * 140), landArea: round1(90 + rng() * 180) }
    case '근린상가':
      return { exclusiveArea: round1(25 + rng() * 120), landArea: round1(15 + rng() * 60) }
    case '토지':
      return { exclusiveArea: 0, landArea: round1(120 + rng() * 600) }
  }
}

function tenantOf(type: AuctionPropertyType, rights: AuctionRight[], rng: () => number): TenantStatus {
  if (rights.includes('선순위임차인')) return '대항력 있음'
  if (type === '토지') return '임차인 없음'
  const roll = rng()
  if (roll < 0.32) return '임차인 없음'
  if (roll < 0.78) return '대항력 없음'
  return '조사 필요'
}

function statusOf(failedCount: number, sold: boolean, rng: () => number): AuctionStatus {
  if (sold) return '매각'
  if (failedCount === 0) return '신건'
  const roll = rng()
  if (roll < 0.08) return '재매각'
  if (roll < 0.16) return '변경'
  return '유찰'
}

/** 회차별 기일 이력 — 1회차부터 현재 회차까지 */
function buildSchedules(
  appraisalPrice: number,
  failedCount: number,
  saleDate: Date,
  status: AuctionStatus,
): AuctionSchedule[] {
  const rounds = failedCount + 1
  const schedules: AuctionSchedule[] = []
  for (let round = 1; round <= rounds; round++) {
    const isCurrent = round === rounds
    const date = addDays(saleDate, -(rounds - round) * DAYS_BETWEEN_ROUNDS)
    schedules.push({
      round,
      date: isoDate(date),
      minimumPrice: Math.round(appraisalPrice * PRICE_CUT_RATE ** (round - 1)),
      result: isCurrent ? (status === '매각' ? '매각' : '진행예정') : '유찰',
    })
  }
  return schedules
}

function generateForRegion(region: RegionBase): AuctionItem[] {
  const rng = createRng(`auction-${region.dongCode}`)
  const count = 5 + Math.floor(rng() * 8)
  const items: AuctionItem[] = []

  for (let i = 0; i < count; i++) {
    const propertyType = pickWeighted(rng)
    const { exclusiveArea, landArea } = areasOf(propertyType, rng)

    // 인근 시세 = 동네 아파트 평균가 × 물건종류 배수 × 면적 편차
    const sizeFactor = propertyType === '토지' ? 0.5 + landArea / 700 : 0.55 + exclusiveArea / 150
    const marketPrice = Math.round(
      region.basePriceEok * TYPE_PRICE_FACTOR[propertyType] * sizeFactor * (0.88 + rng() * 0.3),
    )

    // 감정가는 감정 시점(보통 6개월~1년 전) 기준이라 현재 시세와 약간 차이가 난다
    const appraisalPrice = Math.round(marketPrice * (0.9 + rng() * 0.16))

    const failedRoll = rng()
    const failedCount = failedRoll < 0.34 ? 0 : failedRoll < 0.66 ? 1 : failedRoll < 0.87 ? 2 : 3

    const saleDate = addDays(TODAY, -18 + Math.floor(rng() * 90))
    const sold = saleDate < TODAY
    const status = statusOf(failedCount, sold, rng)

    // 유찰이 쌓인 물건일수록 특수권리가 붙어 있을 확률이 높다
    const pool = RIGHTS_BY_TYPE[propertyType]
    const riskyChance = 0.14 + failedCount * 0.13
    const rights: AuctionRight[] = []
    if (rng() < riskyChance) rights.push(pick(pool, rng))
    if (rng() < riskyChance * 0.35) {
      const extra = pick(pool, rng)
      if (!rights.includes(extra)) rights.push(extra)
    }

    const minimumPrice = Math.round(appraisalPrice * PRICE_CUT_RATE ** failedCount)
    const caseYear = saleDate.getFullYear() - (rng() < 0.4 ? 1 : 0)
    const caseNo = `${caseYear}타경${10000 + Math.floor(rng() * 89999)}`
    const itemNo = rng() < 0.78 ? 1 : 1 + Math.floor(rng() * 4)

    items.push({
      id: `${caseNo}-${itemNo}`,
      caseNo,
      itemNo,
      court: courtOf(region.regionName),
      dongCode: region.dongCode,
      regionName: region.regionName,
      address: `서울특별시 ${region.regionName} ${100 + Math.floor(rng() * 800)}-${1 + Math.floor(rng() * 40)}`,
      lat: region.lat + (rng() - 0.5) * 0.016,
      lng: region.lng + (rng() - 0.5) * 0.02,
      propertyType,
      buildingName: buildingNameOf(propertyType, region.regionName, rng),
      exclusiveArea,
      landArea,
      appraisalPrice,
      minimumPrice,
      bidDeposit: Math.round(minimumPrice * BID_DEPOSIT_RATE),
      failedCount,
      status,
      saleDate: isoDate(saleDate),
      schedules: buildSchedules(appraisalPrice, failedCount, saleDate, status),
      rights,
      tenant: tenantOf(propertyType, rights, rng),
      marketPrice,
    })
  }

  return items
}

let cache: AuctionItem[] | null = null

/** 전체 경매 물건 목록 (시드 기반이라 매번 같은 결과) */
export function getAllAuctions(): AuctionItem[] {
  if (cache) return cache
  const seen = new Set<string>()
  // 사건번호가 겹치는 물건은 뒤쪽을 버린다 (실제 사건번호도 법원별로 유일하다)
  cache = REGIONS.flatMap(generateForRegion).filter((item) => {
    if (seen.has(item.id)) return false
    seen.add(item.id)
    return true
  })
  return cache
}

export function findAuctionById(id: string): AuctionItem | undefined {
  return getAllAuctions().find((item) => item.id === id)
}

/** 감정가 대비 최저매각가 저감률(%) */
export function discountRate(item: AuctionItem): number {
  return Math.round((1 - item.minimumPrice / item.appraisalPrice) * 100)
}

/** 인근 시세 대비 최저매각가가 얼마나 싼지(%) — 음수면 시세보다 비싸다 */
export function marketGapRate(item: AuctionItem): number {
  return Math.round((1 - item.minimumPrice / item.marketPrice) * 100)
}

/** 특수권리나 대항력 있는 임차인이 있어 권리분석이 꼭 필요한 물건인지 */
export function isRisky(item: AuctionItem): boolean {
  return item.rights.length > 0 || item.tenant === '대항력 있음'
}

/** 매각기일까지 남은 일수 (음수면 지난 기일) */
export function daysUntilSale(item: AuctionItem): number {
  const sale = new Date(item.saleDate)
  const saleDay = new Date(sale.getFullYear(), sale.getMonth(), sale.getDate())
  return Math.round((saleDay.getTime() - TODAY.getTime()) / 86400000)
}

/** 매각기일까지 남은 기간을 사람이 읽는 문구로 */
export function saleDateLabel(item: AuctionItem): string {
  const days = daysUntilSale(item)
  if (item.status === '매각') return '매각 완료'
  if (days < 0) return '기일 지남'
  if (days === 0) return '오늘 입찰'
  return `D-${days}`
}

export function filterAuctions(items: AuctionItem[], filter: AuctionFilter): AuctionItem[] {
  const filtered = items.filter((item) => {
    if (filter.dongCodes.length > 0 && !filter.dongCodes.includes(item.dongCode)) return false
    if (filter.propertyTypes.length > 0 && !filter.propertyTypes.includes(item.propertyType)) return false
    if (item.minimumPrice < filter.minPrice) return false
    // 슬라이더를 끝까지 올리면 상한 없음으로 취급
    if (filter.maxPrice < AUCTION_PRICE_RANGE.max && item.minimumPrice > filter.maxPrice) return false
    if (item.failedCount < filter.minFailedCount) return false
    if (filter.excludeRisky && isRisky(item)) return false
    if (filter.onlyUpcoming && (item.status === '매각' || daysUntilSale(item) < 0)) return false
    return true
  })

  const sorted = filtered.slice()
  switch (filter.sort) {
    case 'saleDate':
      sorted.sort((a, b) => a.saleDate.localeCompare(b.saleDate))
      break
    case 'discount':
      sorted.sort((a, b) => discountRate(b) - discountRate(a))
      break
    case 'priceAsc':
      sorted.sort((a, b) => a.minimumPrice - b.minimumPrice)
      break
    case 'priceDesc':
      sorted.sort((a, b) => b.minimumPrice - a.minimumPrice)
      break
  }
  return sorted
}
