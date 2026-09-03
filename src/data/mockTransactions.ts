import type { BudgetCondition, DealType, RegionBase, Transaction } from '../types'
import { ALL_PROPERTY_TYPES, AREA_RANGE } from './dealTypeRanges'
import { createRng } from '../utils/rng'

const APT_POOL = [
  '래미안', '푸르지오', '자이', 'e편한세상', '힐스테이트',
  '더샵', '아이파크', '롯데캐슬', '센트레빌', '파크뷰',
]

const NOW = new Date()

/** 프로토타입: 국토교통부 실거래가 API 대신 지역/거래유형 시드 기반으로 결정론적 목업 데이터 생성 */
export function generateTransactions(region: RegionBase, dealType: DealType, count = 12): Transaction[] {
  const rng = createRng(`${region.dongCode}-${dealType}`)
  const txs: Transaction[] = []

  for (let i = 0; i < count; i++) {
    const monthsAgo = Math.floor(rng() * 12)
    const dayCap = monthsAgo === 0 ? NOW.getDate() : 27
    const day = 1 + Math.floor(rng() * dayCap)
    const date = new Date(NOW.getFullYear(), NOW.getMonth() - monthsAgo, day)
    const trend = 1 + (11 - monthsAgo) * 0.004
    const variance = 0.88 + rng() * 0.24
    const area = Math.round((39 + rng() * 75) * 10) / 10
    const aptName = `${APT_POOL[Math.floor(rng() * APT_POOL.length)]} ${1 + Math.floor(rng() * 3)}차`
    const propertyType = ALL_PROPERTY_TYPES[Math.floor(rng() * ALL_PROPERTY_TYPES.length)]

    let price = 0
    let deposit = 0
    let monthlyRent = 0

    if (dealType === '매매') {
      price = Math.round(region.basePriceEok * trend * variance)
    } else if (dealType === '전세') {
      deposit = Math.round(region.basePriceEok * 0.6 * trend * variance)
    } else {
      deposit = Math.round((3000 + region.basePriceEok * 0.02) * variance)
      monthlyRent = Math.round(region.basePriceEok * 0.0015 * trend * variance)
    }

    txs.push({
      id: `${region.dongCode}-${dealType}-${i}`,
      dongCode: region.dongCode,
      aptName,
      address: `${region.regionName} ${100 + Math.floor(rng() * 50)}`,
      dealType,
      propertyType,
      price,
      deposit,
      monthlyRent,
      area,
      dealDate: date.toISOString(),
    })
  }

  return txs.sort((a, b) => b.dealDate.localeCompare(a.dealDate))
}

/** 선택된 주택 유형 + 유형별 전용면적 범위로 거래 내역을 필터링 */
export function filterTransactions(txs: Transaction[], budget: BudgetCondition): Transaction[] {
  return txs.filter((t) => {
    if (!budget.propertyTypes.includes(t.propertyType)) return false
    const area = budget.areaRanges[t.propertyType]
    if (!area) return true
    // 슬라이더를 최대치까지 올리면 상한 없음("OO 초과")으로 취급
    const maxArea = area.max >= AREA_RANGE.max ? Infinity : area.max
    return t.area >= area.min && t.area <= maxArea
  })
}

export interface RegionSummary {
  avgPrice: number
  avgDeposit: number
  avgMonthlyRent: number
  transactionCount: number
}

const SUMMARY_POOL_SIZE = 48
const TREND_POOL_SIZE = 96

export function getRegionSummary(region: RegionBase, dealType: DealType, budget: BudgetCondition): RegionSummary {
  const txs = filterTransactions(generateTransactions(region, dealType, SUMMARY_POOL_SIZE), budget)
  if (txs.length === 0) {
    return { avgPrice: 0, avgDeposit: 0, avgMonthlyRent: 0, transactionCount: 0 }
  }
  const sum = (pick: (t: Transaction) => number) => txs.reduce((s, t) => s + pick(t), 0) / txs.length
  return {
    avgPrice: Math.round(sum((t) => t.price)),
    avgDeposit: Math.round(sum((t) => t.deposit)),
    avgMonthlyRent: Math.round(sum((t) => t.monthlyRent)),
    transactionCount: txs.length,
  }
}

export interface MonthlyPoint {
  month: string
  value: number
}

/** dealType에 따라 매매가/전세보증금/월세 중 대표값을 월별 평균으로 집계 */
export function getPriceTrend(region: RegionBase, dealType: DealType, budget: BudgetCondition): MonthlyPoint[] {
  const txs = filterTransactions(generateTransactions(region, dealType, TREND_POOL_SIZE), budget)
  const buckets = new Map<string, number[]>()

  for (const t of txs) {
    const d = new Date(t.dealDate)
    const key = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}`
    const value = dealType === '매매' ? t.price : dealType === '전세' ? t.deposit : t.monthlyRent
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key)!.push(value)
  }

  const points: MonthlyPoint[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(NOW.getFullYear(), NOW.getMonth() - i, 1)
    const key = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}`
    const values = buckets.get(key)
    const base = dealType === '매매' ? region.basePriceEok : dealType === '전세' ? region.basePriceEok * 0.6 : region.basePriceEok * 0.0015
    const value = values ? Math.round(values.reduce((s, v) => s + v, 0) / values.length) : Math.round(base)
    points.push({ month: key.slice(2), value })
  }
  return points
}
