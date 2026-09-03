import { useEffect, useRef, useState } from 'react'
import { RangeSlider } from './RangeSlider'
import {
  ALL_DEAL_TYPES,
  ALL_PROPERTY_TYPES,
  AREA_RANGE,
  DEAL_TYPE_RANGES,
  MONTHLY_RENT_RANGE,
  PROPERTY_TYPE_STYLES,
  defaultBudget,
} from '../data/dealTypeRanges'
import { WORKPLACE_PRESETS } from '../data/workplaces'
import { useSearchStore } from '../store/searchStore'
import type { BudgetCondition, CommuteMode, DealType, PropertyType, Workplace } from '../types'
import { formatRangeLabel } from '../utils/format'

const MINUTE_OPTIONS = [20, 30, 40, 50, 60, 90]

interface ConditionModalProps {
  open: boolean
  onClose: () => void
}

export function ConditionModal({ open, onClose }: ConditionModalProps) {
  const storeWorkplace = useSearchStore((s) => s.workplace)
  const storeCommuteMode = useSearchStore((s) => s.commuteMode)
  const storeMaxMinutes = useSearchStore((s) => s.maxMinutes)
  const storeDealTypes = useSearchStore((s) => s.dealTypes)
  const storeBudgets = useSearchStore((s) => s.budgets)
  const setWorkplace = useSearchStore((s) => s.setWorkplace)
  const setCommuteMode = useSearchStore((s) => s.setCommuteMode)
  const setMaxMinutes = useSearchStore((s) => s.setMaxMinutes)
  const setDealTypes = useSearchStore((s) => s.setDealTypes)
  const setBudgets = useSearchStore((s) => s.setBudgets)
  const detailsOpen = useSearchStore((s) => s.detailsOpen)
  const toggleDetailsOpen = useSearchStore((s) => s.toggleDetailsOpen)
  const runSearch = useSearchStore((s) => s.runSearch)

  const [workplace, setLocalWorkplace] = useState<Workplace>(storeWorkplace)
  const [addressInput, setAddressInput] = useState('')
  const [commuteMode, setLocalCommuteMode] = useState<CommuteMode>(storeCommuteMode)
  const [maxMinutes, setLocalMaxMinutes] = useState(storeMaxMinutes)
  const [dealTypes, setLocalDealTypes] = useState<DealType[]>(storeDealTypes)
  const [budgets, setLocalBudgets] = useState<Record<DealType, BudgetCondition>>(storeBudgets)

  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)

  const sectionRefs = useRef<Partial<Record<DealType, HTMLDivElement | null>>>({})
  const prevDealTypesRef = useRef<DealType[]>(dealTypes)

  useEffect(() => {
    if (open) {
      setLocalWorkplace(storeWorkplace)
      setAddressInput('')
      setLocalCommuteMode(storeCommuteMode)
      setLocalMaxMinutes(storeMaxMinutes)
      setLocalDealTypes(storeDealTypes)
      setLocalBudgets(storeBudgets)
    }
  }, [open, storeWorkplace, storeCommuteMode, storeMaxMinutes, storeDealTypes, storeBudgets])

  useEffect(() => {
    if (open) {
      setMounted(true)
      const raf = requestAnimationFrame(() => setVisible(true))
      return () => cancelAnimationFrame(raf)
    }
    setVisible(false)
    const timeout = setTimeout(() => setMounted(false), 200)
    return () => clearTimeout(timeout)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    const prev = prevDealTypesRef.current
    const added = dealTypes.find((d) => !prev.includes(d))
    if (added) {
      sectionRefs.current[added]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
    prevDealTypesRef.current = dealTypes
  }, [dealTypes])

  if (!mounted) return null

  const toggleDealType = (dealType: DealType) => {
    setLocalDealTypes((prev) => {
      const has = prev.includes(dealType)
      const next = has ? prev.filter((d) => d !== dealType) : [...prev, dealType]
      if (next.length === 0) return prev
      return ALL_DEAL_TYPES.filter((d) => next.includes(d))
    })
    setLocalBudgets((prev) =>
      prev[dealType] ? prev : { ...prev, [dealType]: defaultBudget(dealType) },
    )
  }

  const togglePropertyType = (dealType: DealType, propertyType: PropertyType) => {
    setLocalBudgets((prev) => {
      const budget = prev[dealType] ?? defaultBudget(dealType)
      const has = budget.propertyTypes.includes(propertyType)
      const next = has
        ? budget.propertyTypes.filter((p) => p !== propertyType)
        : [...budget.propertyTypes, propertyType]
      if (next.length === 0) return prev
      return {
        ...prev,
        [dealType]: { ...budget, propertyTypes: ALL_PROPERTY_TYPES.filter((p) => next.includes(p)) },
      }
    })
  }

  const setAreaRange = (dealType: DealType, propertyType: PropertyType, patch: Partial<{ min: number; max: number }>) => {
    setLocalBudgets((prev) => {
      const budget = prev[dealType] ?? defaultBudget(dealType)
      return {
        ...prev,
        [dealType]: {
          ...budget,
          areaRanges: {
            ...budget.areaRanges,
            [propertyType]: { ...budget.areaRanges[propertyType], ...patch },
          },
        },
      }
    })
  }

  const selectedDealTypes = ALL_DEAL_TYPES.filter((dt) => dealTypes.includes(dt))

  const apply = () => {
    setWorkplace(workplace)
    setCommuteMode(commuteMode)
    setMaxMinutes(maxMinutes)
    setDealTypes(dealTypes)
    setBudgets(budgets)
    runSearch()
    onClose()
  }

  return (
    <div
      className={[
        'fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto px-4 py-8 sm:items-center',
        'transition-colors duration-200 ease-out',
        visible ? 'bg-slate-900/40' : 'bg-slate-900/0',
      ].join(' ')}
      onClick={onClose}
    >
      <div
        className={[
          'flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-xl',
          'transition duration-200 ease-out',
          visible ? 'translate-y-0 scale-100 opacity-100' : '-translate-y-2 scale-95 opacity-0',
        ].join(' ')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between px-6 pt-6">
          <h2 className="text-lg font-semibold text-slate-900">조건 변경</h2>
          <button
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
        <section className="mt-6">
          <h3 className="text-sm font-medium text-slate-900">직장 위치</h3>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {WORKPLACE_PRESETS.map((w) => (
              <button
                key={w.name}
                onClick={() => setLocalWorkplace(w)}
                className={[
                  'rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                  workplace.name === w.name
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 text-slate-700 hover:border-slate-300',
                ].join(' ')}
              >
                {w.name}
              </button>
            ))}
          </div>
          <input
            value={addressInput}
            onChange={(e) => setAddressInput(e.target.value)}
            placeholder="또는 주소 직접 입력 (프로토타입: 지도 반영 안 됨)"
            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
          />
        </section>

        <section className="mt-6">
          <h3 className="text-sm font-medium text-slate-900">이동수단 · 소요시간</h3>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {(['transit', 'car'] as CommuteMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setLocalCommuteMode(mode)}
                className={[
                  'rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                  commuteMode === mode
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 text-slate-700 hover:border-slate-300',
                ].join(' ')}
              >
                {mode === 'transit' ? '🚇 대중교통' : '🚗 자차'}
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {MINUTE_OPTIONS.map((m) => (
              <button
                key={m}
                onClick={() => setLocalMaxMinutes(m)}
                className={[
                  'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                  maxMinutes === m
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 text-slate-700 hover:border-slate-300',
                ].join(' ')}
              >
                {m}분
              </button>
            ))}
          </div>
        </section>

        <section className="mt-6">
          <h3 className="text-sm font-medium text-slate-900">예산 (중복 선택 가능)</h3>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {(['매매', '전세', '월세'] as DealType[]).map((dt) => (
              <button
                key={dt}
                onClick={() => toggleDealType(dt)}
                className={[
                  'rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                  dealTypes.includes(dt)
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 text-slate-700 hover:border-slate-300',
                ].join(' ')}
              >
                {dt}
              </button>
            ))}
          </div>

          {selectedDealTypes.map((dt) => {
            const budget = budgets[dt] ?? defaultBudget(dt)
            return (
              <div
                key={dt}
                ref={(el) => {
                  sectionRefs.current[dt] = el
                }}
                className="mt-4 rounded-lg border border-slate-200 p-4"
              >
                <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                  {dt}
                </span>

                <div className="mt-3 flex items-center justify-between">
                  <label className="text-sm text-slate-500">{dt === '월세' ? '보증금' : '예산'} 범위</label>
                  <span className="text-sm font-medium text-slate-900">
                    {formatRangeLabel(budget.minPrice, budget.maxPrice, DEAL_TYPE_RANGES[dt].max, (v) => `${(v / 10000).toFixed(1)}억`)}
                  </span>
                </div>
                <div className="mt-4">
                  <RangeSlider
                    min={0}
                    max={DEAL_TYPE_RANGES[dt].max}
                    step={DEAL_TYPE_RANGES[dt].step}
                    valueMin={budget.minPrice}
                    valueMax={budget.maxPrice}
                    onChangeMin={(v) => setLocalBudgets((prev) => ({ ...prev, [dt]: { ...budget, minPrice: v } }))}
                    onChangeMax={(v) => setLocalBudgets((prev) => ({ ...prev, [dt]: { ...budget, maxPrice: v } }))}
                    formatTick={(v) => `${(v / 10000).toFixed(1)}억`}
                  />
                </div>

                {dt === '월세' && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between">
                      <label className="text-sm text-slate-500">월세 범위</label>
                      <span className="text-sm font-medium text-slate-900">
                        {formatRangeLabel(
                          budget.minMonthlyRent ?? 0,
                          budget.maxMonthlyRent ?? 100,
                          MONTHLY_RENT_RANGE.max,
                          (v) => `${v}만원`,
                        )}
                      </span>
                    </div>
                    <div className="mt-4">
                      <RangeSlider
                        min={MONTHLY_RENT_RANGE.min}
                        max={MONTHLY_RENT_RANGE.max}
                        step={MONTHLY_RENT_RANGE.step}
                        valueMin={budget.minMonthlyRent ?? 0}
                        valueMax={budget.maxMonthlyRent ?? 100}
                        onChangeMin={(v) =>
                          setLocalBudgets((prev) => ({ ...prev, [dt]: { ...budget, minMonthlyRent: v } }))
                        }
                        onChangeMax={(v) =>
                          setLocalBudgets((prev) => ({ ...prev, [dt]: { ...budget, maxMonthlyRent: v } }))
                        }
                        formatTick={(v) => `${Math.round(v)}만`}
                      />
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => toggleDetailsOpen(dt)}
                  className="mt-4 flex w-full items-center gap-3 text-xs font-medium text-slate-400 hover:text-slate-600"
                >
                  <span className="h-px flex-1 bg-slate-200" />
                  <span>상세설정 {detailsOpen[dt] ? '▲' : '▼'}</span>
                  <span className="h-px flex-1 bg-slate-200" />
                </button>

                {detailsOpen[dt] && (
                  <>
                    <div className="mt-4">
                      <label className="text-sm text-slate-500">주택 유형 (중복 선택 가능)</label>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {ALL_PROPERTY_TYPES.map((pt) => (
                          <button
                            key={pt}
                            onClick={() => togglePropertyType(dt, pt)}
                            className={[
                              'rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
                              budget.propertyTypes.includes(pt)
                                ? 'border-slate-900 bg-slate-900 text-white'
                                : 'border-slate-200 text-slate-700 hover:border-slate-300',
                            ].join(' ')}
                          >
                            {pt}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="mt-4">
                      <label className="text-sm text-slate-500">전용면적</label>
                      <div className="mt-2 space-y-3">
                        {ALL_PROPERTY_TYPES.filter((pt) => budget.propertyTypes.includes(pt)).map((pt) => {
                          const area = budget.areaRanges[pt]
                          return (
                            <div key={pt}>
                              <div className="flex items-center justify-between">
                                <span
                                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold text-white ${PROPERTY_TYPE_STYLES[pt].bg}`}
                                >
                                  {pt}
                                </span>
                                <span className="text-sm font-medium text-slate-900">
                                  {formatRangeLabel(area.min, area.max, AREA_RANGE.max, (v) => `${v}㎡`)}
                                </span>
                              </div>
                              <div className="mt-2">
                                <RangeSlider
                                  min={AREA_RANGE.min}
                                  max={AREA_RANGE.max}
                                  step={AREA_RANGE.step}
                                  valueMin={area.min}
                                  valueMax={area.max}
                                  onChangeMin={(v) => setAreaRange(dt, pt, { min: v })}
                                  onChangeMax={(v) => setAreaRange(dt, pt, { max: v })}
                                  formatTick={(v) => `${Math.round(v)}㎡`}
                                />
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </section>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-500 hover:border-slate-300 hover:bg-slate-50"
          >
            취소
          </button>
          <button
            onClick={apply}
            className="rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-emerald-500"
          >
            적용
          </button>
        </div>
      </div>
    </div>
  )
}
