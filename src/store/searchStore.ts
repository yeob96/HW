import { create } from 'zustand'
import { REGIONS } from '../data/regions'
import { WORKPLACE_PRESETS } from '../data/workplaces'
import { ALL_DEAL_TYPES, ALL_PROPERTY_TYPES, DEAL_TYPE_RANGES, MONTHLY_RENT_RANGE, defaultBudget } from '../data/dealTypeRanges'
import { getRegionSummary } from '../data/mockTransactions'
import type { AreaRange, BudgetCondition, CommuteMode, DealType, PropertyType, RegionResult, Workplace } from '../types'
import { estimateCarMinutes, estimateTransitMinutes, haversineKm } from '../utils/geo'

interface SearchState {
  workplace: Workplace
  commuteMode: CommuteMode
  maxMinutes: number
  dealTypes: DealType[]
  budgets: Record<DealType, BudgetCondition>
  /** 각 거래유형 박스의 "상세설정"(주택 유형·전용면적) 펼침 여부 */
  detailsOpen: Record<DealType, boolean>
  activeDealType: DealType
  resultsByType: Partial<Record<DealType, RegionResult[]>>
  hasSearched: boolean

  setWorkplace: (w: Workplace) => void
  setCommuteMode: (m: CommuteMode) => void
  setMaxMinutes: (v: number) => void
  toggleDealType: (dealType: DealType) => void
  setDealTypes: (dealTypes: DealType[]) => void
  setBudget: (dealType: DealType, patch: Partial<BudgetCondition>) => void
  togglePropertyType: (dealType: DealType, propertyType: PropertyType) => void
  setAreaRange: (dealType: DealType, propertyType: PropertyType, patch: Partial<AreaRange>) => void
  setBudgets: (budgets: Record<DealType, BudgetCondition>) => void
  toggleDetailsOpen: (dealType: DealType) => void
  setActiveDealType: (dealType: DealType) => void
  runSearch: () => void
  getRegionResult: (dongCode: string) => RegionResult | undefined
}

export const useSearchStore = create<SearchState>((set, get) => ({
  workplace: WORKPLACE_PRESETS[0],
  commuteMode: 'transit',
  maxMinutes: 40,
  dealTypes: ['전세'],
  budgets: {
    매매: defaultBudget('매매'),
    전세: defaultBudget('전세'),
    월세: defaultBudget('월세'),
  },
  detailsOpen: { 매매: false, 전세: false, 월세: false },
  activeDealType: '전세',
  resultsByType: {},
  hasSearched: false,

  setWorkplace: (w) => set({ workplace: w }),
  setCommuteMode: (m) => set({ commuteMode: m }),
  setMaxMinutes: (v) => set({ maxMinutes: v }),

  toggleDealType: (dealType) =>
    set((state) => {
      const has = state.dealTypes.includes(dealType)
      const next = has ? state.dealTypes.filter((d) => d !== dealType) : [...state.dealTypes, dealType]
      if (next.length === 0) return {}
      return { dealTypes: ALL_DEAL_TYPES.filter((d) => next.includes(d)) }
    }),

  setDealTypes: (dealTypes) => set({ dealTypes: ALL_DEAL_TYPES.filter((d) => dealTypes.includes(d)) }),

  setBudget: (dealType, patch) =>
    set((state) => ({
      budgets: { ...state.budgets, [dealType]: { ...state.budgets[dealType], ...patch } },
    })),

  setBudgets: (budgets) => set({ budgets }),

  toggleDetailsOpen: (dealType) =>
    set((state) => ({ detailsOpen: { ...state.detailsOpen, [dealType]: !state.detailsOpen[dealType] } })),

  togglePropertyType: (dealType, propertyType) =>
    set((state) => {
      const budget = state.budgets[dealType]
      const has = budget.propertyTypes.includes(propertyType)
      const next = has
        ? budget.propertyTypes.filter((p) => p !== propertyType)
        : [...budget.propertyTypes, propertyType]
      if (next.length === 0) return {}
      return {
        budgets: {
          ...state.budgets,
          [dealType]: { ...budget, propertyTypes: ALL_PROPERTY_TYPES.filter((p) => next.includes(p)) },
        },
      }
    }),

  setAreaRange: (dealType, propertyType, patch) =>
    set((state) => {
      const budget = state.budgets[dealType]
      return {
        budgets: {
          ...state.budgets,
          [dealType]: {
            ...budget,
            areaRanges: {
              ...budget.areaRanges,
              [propertyType]: { ...budget.areaRanges[propertyType], ...patch },
            },
          },
        },
      }
    }),

  setActiveDealType: (dealType) => set({ activeDealType: dealType }),

  runSearch: () => {
    const { workplace, commuteMode, maxMinutes, dealTypes, budgets, activeDealType } = get()

    const resultsByType: Partial<Record<DealType, RegionResult[]>> = {}

    for (const dealType of dealTypes) {
      const budget = budgets[dealType]

      const results: RegionResult[] = REGIONS.map((region) => {
        const distanceKm = haversineKm(workplace.lat, workplace.lng, region.lat, region.lng)
        const transitMinutes = estimateTransitMinutes(distanceKm)
        const carMinutes = estimateCarMinutes(distanceKm)
        const commuteMinutes = commuteMode === 'transit' ? transitMinutes : carMinutes
        const summary = getRegionSummary(region, dealType, budget)

        return {
          ...region,
          transitMinutes,
          carMinutes,
          commuteMinutes,
          avgPrice: summary.avgPrice,
          avgDeposit: summary.avgDeposit,
          avgMonthlyRent: summary.avgMonthlyRent,
          transactionCount: summary.transactionCount,
        }
      })
        .filter((r) => r.commuteMinutes <= maxMinutes)
        .filter((r) => r.transactionCount > 0)
        .filter((r) => {
          const priceBasis = dealType === '매매' ? r.avgPrice : r.avgDeposit
          // 슬라이더를 최대치까지 올리면 상한 없음("OO 초과")으로 취급
          const maxPrice = budget.maxPrice >= DEAL_TYPE_RANGES[dealType].max ? Infinity : budget.maxPrice
          const withinPrice = priceBasis >= budget.minPrice && priceBasis <= maxPrice
          if (dealType === '월세') {
            const maxMonthlyRent =
              budget.maxMonthlyRent != null && budget.maxMonthlyRent >= MONTHLY_RENT_RANGE.max
                ? Infinity
                : budget.maxMonthlyRent
            const withinMonthlyRent =
              (budget.minMonthlyRent == null || r.avgMonthlyRent >= budget.minMonthlyRent) &&
              (maxMonthlyRent == null || r.avgMonthlyRent <= maxMonthlyRent)
            return withinPrice && withinMonthlyRent
          }
          return withinPrice
        })
        .sort((a, b) => a.commuteMinutes - b.commuteMinutes)

      resultsByType[dealType] = results
    }

    set({
      resultsByType,
      hasSearched: true,
      activeDealType: dealTypes.includes(activeDealType) ? activeDealType : dealTypes[0],
    })
  },

  getRegionResult: (dongCode) => {
    const { resultsByType, activeDealType } = get()
    return resultsByType[activeDealType]?.find((r) => r.dongCode === dongCode)
  },
}))
