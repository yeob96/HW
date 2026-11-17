import { create } from 'zustand'
import type { AuctionFilter, AuctionPropertyType, AuctionSort } from '../types'
import { AUCTION_PRICE_RANGE } from '../data/mockAuctions'

export const DEFAULT_AUCTION_FILTER: AuctionFilter = {
  dongCodes: [],
  propertyTypes: [],
  minPrice: AUCTION_PRICE_RANGE.min,
  maxPrice: AUCTION_PRICE_RANGE.max,
  minFailedCount: 0,
  excludeRisky: false,
  onlyUpcoming: true,
  sort: 'saleDate',
}

interface AuctionState extends AuctionFilter {
  /** 목록에서 마우스를 올려둔 물건 — 지도 강조용 */
  hoveredId: string | null

  toggleDongCode: (dongCode: string) => void
  togglePropertyType: (type: AuctionPropertyType) => void
  setPriceRange: (min: number, max: number) => void
  setMinFailedCount: (count: number) => void
  setExcludeRisky: (value: boolean) => void
  setOnlyUpcoming: (value: boolean) => void
  setSort: (sort: AuctionSort) => void
  setHoveredId: (id: string | null) => void
  reset: () => void
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

/** 경매 물건 목록 화면의 필터·정렬 상태 */
export const useAuctionStore = create<AuctionState>((set) => ({
  ...DEFAULT_AUCTION_FILTER,
  hoveredId: null,

  toggleDongCode: (dongCode) => set((s) => ({ dongCodes: toggle(s.dongCodes, dongCode) })),
  togglePropertyType: (type) => set((s) => ({ propertyTypes: toggle(s.propertyTypes, type) })),
  setPriceRange: (minPrice, maxPrice) => set({ minPrice, maxPrice }),
  setMinFailedCount: (minFailedCount) => set({ minFailedCount }),
  setExcludeRisky: (excludeRisky) => set({ excludeRisky }),
  setOnlyUpcoming: (onlyUpcoming) => set({ onlyUpcoming }),
  setSort: (sort) => set({ sort }),
  setHoveredId: (hoveredId) => set({ hoveredId }),
  reset: () => set({ ...DEFAULT_AUCTION_FILTER }),
}))

/** filterAuctions에 넘길 필터 값만 뽑아낸다 */
export function selectAuctionFilter(s: AuctionState): AuctionFilter {
  return {
    dongCodes: s.dongCodes,
    propertyTypes: s.propertyTypes,
    minPrice: s.minPrice,
    maxPrice: s.maxPrice,
    minFailedCount: s.minFailedCount,
    excludeRisky: s.excludeRisky,
    onlyUpcoming: s.onlyUpcoming,
    sort: s.sort,
  }
}
