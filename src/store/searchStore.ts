import { create } from 'zustand'
import { REGIONS } from '../data/regions'
import { WORKPLACE_PRESETS } from '../data/workplaces'
import { ALL_DEAL_TYPES, defaultBudget } from '../data/dealTypeRanges'
import { getRegionSummary } from '../data/mockTransactions'
import type { BudgetCondition, CommuteMode, DealType, RegionResult, Workplace } from '../types'
import { estimateCarMinutes, estimateTransitMinutes, haversineKm } from '../utils/geo'

interface SearchState {
  workplace: Workplace
  commuteMode: CommuteMode
  maxMinutes: number
  dealTypes: DealType[]
  budgets: Record<DealType, BudgetCondition>
  activeDealType: DealType
  resultsByType: Partial<Record<DealType, RegionResult[]>>
  hasSearched: boolean

  setWorkplace: (w: Workplace) => void
  setCommuteMode: (m: CommuteMode) => void
  setMaxMinutes: (v: number) => void
  toggleDealType: (dealType: DealType) => void
  setDealTypes: (dealTypes: DealType[]) => void
  setBudget: (dealType: DealType, patch: Partial<BudgetCondition>) => void
  setBudgets: (budgets: Record<DealType, BudgetCondition>) => void
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
        const summary = getRegionSummary(region, dealType)

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
        .filter((r) => {
          const priceBasis = dealType === '매매' ? r.avgPrice : r.avgDeposit
          const withinPrice = priceBasis >= budget.minPrice && priceBasis <= budget.maxPrice
          if (dealType === '월세' && budget.maxMonthlyRent != null) {
            return withinPrice && r.avgMonthlyRent <= budget.maxMonthlyRent
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
