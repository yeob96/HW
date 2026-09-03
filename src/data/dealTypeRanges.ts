import type { AreaRange, BudgetCondition, DealType, PropertyType } from '../types'

export const ALL_DEAL_TYPES: DealType[] = ['매매', '전세', '월세']

export const ALL_PROPERTY_TYPES: PropertyType[] = ['아파트', '오피스텔', '빌라', '단독/다가구']

export interface PropertyTypeStyle {
  /** 배경색 (임의값) */
  bg: string
}

/** 주택 유형 배지에 쓰는 유형별 배경색 */
export const PROPERTY_TYPE_STYLES: Record<PropertyType, PropertyTypeStyle> = {
  아파트: { bg: 'bg-[#FF8C61]' },
  오피스텔: { bg: 'bg-[#FFD670]' },
  빌라: { bg: 'bg-[#06D6A0]' },
  '단독/다가구': { bg: 'bg-[#1B98E0]' },
}

export const DEAL_TYPE_RANGES: Record<DealType, { max: number; step: number }> = {
  매매: { max: 300000, step: 5000 },
  전세: { max: 200000, step: 5000 },
  월세: { max: 20000, step: 500 },
}

/** 주택 유형별 전용면적(㎡) 슬라이더 범위 */
export const AREA_RANGE = { min: 0, max: 150, step: 5 }

/** 월세 슬라이더 범위(만원) */
export const MONTHLY_RENT_RANGE = { min: 0, max: 300, step: 10 }

function defaultAreaRanges(): Record<PropertyType, AreaRange> {
  const entries = ALL_PROPERTY_TYPES.map((pt) => [pt, { min: AREA_RANGE.min, max: AREA_RANGE.max }] as const)
  return Object.fromEntries(entries) as Record<PropertyType, AreaRange>
}

export function defaultBudget(dealType: DealType): BudgetCondition {
  const range = DEAL_TYPE_RANGES[dealType]
  return {
    dealType,
    minPrice: 0,
    maxPrice: Math.round(range.max * 0.6),
    minMonthlyRent: dealType === '월세' ? 0 : undefined,
    maxMonthlyRent: dealType === '월세' ? 100 : undefined,
    propertyTypes: [...ALL_PROPERTY_TYPES],
    areaRanges: defaultAreaRanges(),
  }
}
