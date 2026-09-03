import type { BudgetCondition, DealType } from '../types'

export const ALL_DEAL_TYPES: DealType[] = ['매매', '전세', '월세']

export const DEAL_TYPE_RANGES: Record<DealType, { max: number; step: number }> = {
  매매: { max: 300000, step: 5000 },
  전세: { max: 200000, step: 5000 },
  월세: { max: 20000, step: 500 },
}

export function defaultBudget(dealType: DealType): BudgetCondition {
  const range = DEAL_TYPE_RANGES[dealType]
  return {
    dealType,
    minPrice: 0,
    maxPrice: Math.round(range.max * 0.6),
    minMonthlyRent: dealType === '월세' ? 0 : undefined,
    maxMonthlyRent: dealType === '월세' ? 100 : undefined,
  }
}
