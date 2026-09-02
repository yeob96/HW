import { create } from 'zustand'
import { REGIONS } from '../data/regions'
import { WORKPLACE_PRESETS } from '../data/workplaces'
import { getRegionSummary } from '../data/mockTransactions'
import type { BudgetCondition, CommuteMode, RegionResult, Workplace } from '../types'
import { estimateCarMinutes, estimateTransitMinutes, haversineKm } from '../utils/geo'

interface SearchState {
  workplace: Workplace
  commuteMode: CommuteMode
  maxMinutes: number
  budget: BudgetCondition
  results: RegionResult[]
  hasSearched: boolean

  setWorkplace: (w: Workplace) => void
  setCommuteMode: (m: CommuteMode) => void
  setMaxMinutes: (v: number) => void
  setBudget: (b: BudgetCondition) => void
  runSearch: () => void
  getRegionResult: (dongCode: string) => RegionResult | undefined
}

export const useSearchStore = create<SearchState>((set, get) => ({
  workplace: WORKPLACE_PRESETS[0],
  commuteMode: 'transit',
  maxMinutes: 40,
  budget: { dealType: '전세', minPrice: 0, maxPrice: 100000, maxMonthlyRent: 100 },
  results: [],
  hasSearched: false,

  setWorkplace: (w) => set({ workplace: w }),
  setCommuteMode: (m) => set({ commuteMode: m }),
  setMaxMinutes: (v) => set({ maxMinutes: v }),
  setBudget: (b) => set({ budget: b }),

  runSearch: () => {
    const { workplace, commuteMode, maxMinutes, budget } = get()

    const results: RegionResult[] = REGIONS.map((region) => {
      const distanceKm = haversineKm(workplace.lat, workplace.lng, region.lat, region.lng)
      const transitMinutes = estimateTransitMinutes(distanceKm)
      const carMinutes = estimateCarMinutes(distanceKm)
      const commuteMinutes = commuteMode === 'transit' ? transitMinutes : carMinutes
      const summary = getRegionSummary(region, budget.dealType)

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
        const priceBasis = budget.dealType === '매매' ? r.avgPrice : r.avgDeposit
        const withinPrice = priceBasis >= budget.minPrice && priceBasis <= budget.maxPrice
        if (budget.dealType === '월세' && budget.maxMonthlyRent != null) {
          return withinPrice && r.avgMonthlyRent <= budget.maxMonthlyRent
        }
        return withinPrice
      })
      .sort((a, b) => a.commuteMinutes - b.commuteMinutes)

    set({ results, hasSearched: true })
  },

  getRegionResult: (dongCode) => get().results.find((r) => r.dongCode === dongCode),
}))
