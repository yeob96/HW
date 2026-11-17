import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { AuctionCard } from '../components/AuctionCard'
import { RangeSlider } from '../components/RangeSlider'
import {
  ALL_AUCTION_PROPERTY_TYPES,
  AUCTION_PRICE_RANGE,
  filterAuctions,
  getAllAuctions,
} from '../data/mockAuctions'
import { REGIONS } from '../data/regions'
import { useAuctionStore } from '../store/auctionStore'
import { useAuthStore, useCurrentUser } from '../store/authStore'
import { AUTH_REQUIRED_MESSAGE, useUiStore } from '../store/uiStore'
import type { AuctionSort } from '../types'
import { formatEokTickBound, formatRangeLabel } from '../utils/format'

const SORT_OPTIONS: Array<{ value: AuctionSort; label: string }> = [
  { value: 'saleDate', label: '매각기일 빠른순' },
  { value: 'discount', label: '저감률 높은순' },
  { value: 'priceAsc', label: '최저가 낮은순' },
  { value: 'priceDesc', label: '최저가 높은순' },
]

const FAILED_OPTIONS = [
  { value: 0, label: '전체' },
  { value: 1, label: '1회 이상' },
  { value: 2, label: '2회 이상' },
  { value: 3, label: '3회 이상' },
]

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={[
        'cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition-colors',
        active
          ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
          : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-slate-100 pt-4 first:border-t-0 first:pt-0">
      <p className="mb-2 text-xs font-semibold text-slate-700">{title}</p>
      {children}
    </div>
  )
}

export function AuctionListPage() {
  const navigate = useNavigate()
  const [filterOpen, setFilterOpen] = useState(false)
  const [onlyLiked, setOnlyLiked] = useState(false)

  const dongCodes = useAuctionStore((s) => s.dongCodes)
  const propertyTypes = useAuctionStore((s) => s.propertyTypes)
  const minPrice = useAuctionStore((s) => s.minPrice)
  const maxPrice = useAuctionStore((s) => s.maxPrice)
  const minFailedCount = useAuctionStore((s) => s.minFailedCount)
  const excludeRisky = useAuctionStore((s) => s.excludeRisky)
  const onlyUpcoming = useAuctionStore((s) => s.onlyUpcoming)
  const sort = useAuctionStore((s) => s.sort)
  const toggleDongCode = useAuctionStore((s) => s.toggleDongCode)
  const togglePropertyType = useAuctionStore((s) => s.togglePropertyType)
  const setPriceRange = useAuctionStore((s) => s.setPriceRange)
  const setMinFailedCount = useAuctionStore((s) => s.setMinFailedCount)
  const setExcludeRisky = useAuctionStore((s) => s.setExcludeRisky)
  const setOnlyUpcoming = useAuctionStore((s) => s.setOnlyUpcoming)
  const setSort = useAuctionStore((s) => s.setSort)
  const reset = useAuctionStore((s) => s.reset)
  const setHoveredId = useAuctionStore((s) => s.setHoveredId)

  const user = useCurrentUser()
  const toggleLikeAuction = useAuthStore((s) => s.toggleLikeAuction)
  const openAuthModal = useUiStore((s) => s.openAuthModal)
  const likedIds = user?.likedAuctionIds ?? []

  const all = useMemo(() => getAllAuctions(), [])
  const results = useMemo(
    () =>
      filterAuctions(all, {
        dongCodes,
        propertyTypes,
        minPrice,
        maxPrice,
        minFailedCount,
        excludeRisky,
        onlyUpcoming,
        sort,
      }),
    [all, dongCodes, propertyTypes, minPrice, maxPrice, minFailedCount, excludeRisky, onlyUpcoming, sort],
  )
  const shown = onlyLiked ? results.filter((item) => likedIds.includes(item.id)) : results

  const handleToggleLike = (id: string) => {
    if (!user) {
      openAuthModal(AUTH_REQUIRED_MESSAGE)
      return
    }
    toggleLikeAuction(id)
  }

  const priceLabel = formatRangeLabel(minPrice, maxPrice, AUCTION_PRICE_RANGE.max, (v) =>
    formatEokTickBound(v, AUCTION_PRICE_RANGE.max),
  )

  const filters = (
    <div className="flex flex-col gap-4">
      <FilterSection title="지역">
        <div className="flex flex-wrap gap-1.5">
          {REGIONS.map((r) => (
            <Chip key={r.dongCode} active={dongCodes.includes(r.dongCode)} onClick={() => toggleDongCode(r.dongCode)}>
              {r.regionName}
            </Chip>
          ))}
        </div>
      </FilterSection>

      <FilterSection title="물건종류">
        <div className="flex flex-wrap gap-1.5">
          {ALL_AUCTION_PROPERTY_TYPES.map((t) => (
            <Chip key={t} active={propertyTypes.includes(t)} onClick={() => togglePropertyType(t)}>
              {t}
            </Chip>
          ))}
        </div>
      </FilterSection>

      <FilterSection title={`최저매각가 · ${priceLabel}`}>
        <RangeSlider
          min={AUCTION_PRICE_RANGE.min}
          max={AUCTION_PRICE_RANGE.max}
          step={1000}
          valueMin={minPrice}
          valueMax={maxPrice}
          onChangeMin={(v) => setPriceRange(v, maxPrice)}
          onChangeMax={(v) => setPriceRange(minPrice, v)}
          formatTick={(v) => formatEokTickBound(v, AUCTION_PRICE_RANGE.max)}
        />
      </FilterSection>

      <FilterSection title="유찰 횟수">
        <div className="flex flex-wrap gap-1.5">
          {FAILED_OPTIONS.map((o) => (
            <Chip key={o.value} active={minFailedCount === o.value} onClick={() => setMinFailedCount(o.value)}>
              {o.label}
            </Chip>
          ))}
        </div>
      </FilterSection>

      <FilterSection title="조건">
        <label className="flex cursor-pointer items-center gap-2 py-1 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={onlyUpcoming}
            onChange={(e) => setOnlyUpcoming(e.target.checked)}
            className="h-4 w-4 cursor-pointer accent-emerald-600"
          />
          기일이 남은 물건만
        </label>
        <label className="flex cursor-pointer items-center gap-2 py-1 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={excludeRisky}
            onChange={(e) => setExcludeRisky(e.target.checked)}
            className="h-4 w-4 cursor-pointer accent-emerald-600"
          />
          특수권리·대항력 임차인 제외
        </label>
      </FilterSection>

      <button
        onClick={reset}
        className="cursor-pointer rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-500 hover:border-slate-300 hover:text-slate-700"
      >
        필터 초기화
      </button>
    </div>
  )

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-100 px-6 py-4">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-emerald-600">법원 경매</p>
            <h1 className="text-lg font-semibold text-slate-900">진행 중인 경매 물건 {results.length}건</h1>
          </div>
          <button
            onClick={() => setFilterOpen((v) => !v)}
            className="cursor-pointer rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-300 lg:hidden"
          >
            필터 {filterOpen ? '닫기' : '열기'}
          </button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-6 lg:flex-row">
        <aside className="lg:w-64 lg:shrink-0">
          <div className="hidden rounded-lg border border-slate-200 bg-white p-4 lg:block">{filters}</div>
          <AnimatePresence initial={false}>
            {filterOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="overflow-hidden lg:hidden"
              >
                <div className="rounded-lg border border-slate-200 bg-white p-4">{filters}</div>
              </motion.div>
            )}
          </AnimatePresence>
        </aside>

        <div className="flex-1">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-1 border-b border-slate-100">
              {[
                { value: false, label: '전체', count: results.length },
                { value: true, label: '관심물건', count: results.filter((i) => likedIds.includes(i.id)).length },
              ].map((tab) => (
                <button
                  key={String(tab.value)}
                  onClick={() => setOnlyLiked(tab.value)}
                  className={[
                    '-mb-px cursor-pointer border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                    onlyLiked === tab.value
                      ? 'border-emerald-600 text-emerald-700 hover:text-emerald-800'
                      : 'border-transparent text-slate-400 hover:text-slate-600',
                  ].join(' ')}
                >
                  {tab.label}
                  <span className="ml-1.5 text-xs text-slate-400">{tab.count}</span>
                </button>
              ))}
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as AuctionSort)}
              className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 hover:border-slate-300"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {shown.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-400">
              {onlyLiked ? '관심물건으로 등록한 물건이 없어요.' : '조건에 맞는 물건이 없어요. 필터를 넓혀보세요.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {shown.map((item) => (
                <AuctionCard
                  key={item.id}
                  item={item}
                  liked={likedIds.includes(item.id)}
                  onClick={() => navigate(`/auction/${encodeURIComponent(item.id)}`)}
                  onMouseEnter={() => setHoveredId(item.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onToggleLike={() => handleToggleLike(item.id)}
                />
              ))}
            </div>
          )}

          <p className="mt-6 rounded-lg bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-400">
            프로토타입 안내 — 표시되는 물건은 법원경매정보 수집 데이터가 아니라 목업입니다. 실제 입찰 전에는 대법원
            법원경매정보와 물건명세서·현황조사서·감정평가서를 직접 확인해야 합니다.
          </p>
        </div>
      </main>
    </div>
  )
}
