import { useEffect, useState } from 'react'
import { WORKPLACE_PRESETS } from '../data/workplaces'
import { useSearchStore } from '../store/searchStore'
import type { BudgetCondition, CommuteMode, DealType, Workplace } from '../types'

const MINUTE_OPTIONS = [20, 30, 40, 50, 60, 90]

const DEAL_TYPE_RANGES: Record<DealType, { max: number; step: number }> = {
  매매: { max: 300000, step: 5000 },
  전세: { max: 200000, step: 5000 },
  월세: { max: 20000, step: 500 },
}

interface ConditionModalProps {
  open: boolean
  onClose: () => void
}

export function ConditionModal({ open, onClose }: ConditionModalProps) {
  const storeWorkplace = useSearchStore((s) => s.workplace)
  const storeCommuteMode = useSearchStore((s) => s.commuteMode)
  const storeMaxMinutes = useSearchStore((s) => s.maxMinutes)
  const storeBudget = useSearchStore((s) => s.budget)
  const setWorkplace = useSearchStore((s) => s.setWorkplace)
  const setCommuteMode = useSearchStore((s) => s.setCommuteMode)
  const setMaxMinutes = useSearchStore((s) => s.setMaxMinutes)
  const setBudget = useSearchStore((s) => s.setBudget)
  const runSearch = useSearchStore((s) => s.runSearch)

  const [workplace, setLocalWorkplace] = useState<Workplace>(storeWorkplace)
  const [addressInput, setAddressInput] = useState('')
  const [commuteMode, setLocalCommuteMode] = useState<CommuteMode>(storeCommuteMode)
  const [maxMinutes, setLocalMaxMinutes] = useState(storeMaxMinutes)
  const [budget, setLocalBudget] = useState<BudgetCondition>(storeBudget)

  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (open) {
      setLocalWorkplace(storeWorkplace)
      setAddressInput('')
      setLocalCommuteMode(storeCommuteMode)
      setLocalMaxMinutes(storeMaxMinutes)
      setLocalBudget(storeBudget)
    }
  }, [open, storeWorkplace, storeCommuteMode, storeMaxMinutes, storeBudget])

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

  if (!mounted) return null

  const handleDealType = (dealType: DealType) => {
    const range = DEAL_TYPE_RANGES[dealType]
    setLocalBudget({
      dealType,
      minPrice: 0,
      maxPrice: Math.round(range.max * 0.6),
      maxMonthlyRent: dealType === '월세' ? 100 : undefined,
    })
  }

  const apply = () => {
    setWorkplace(workplace)
    setCommuteMode(commuteMode)
    setMaxMinutes(maxMinutes)
    setBudget(budget)
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
          'w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl',
          'transition duration-200 ease-out',
          visible ? 'translate-y-0 scale-100 opacity-100' : '-translate-y-2 scale-95 opacity-0',
        ].join(' ')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">조건 변경</h2>
          <button
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

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
          <h3 className="text-sm font-medium text-slate-900">예산</h3>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {(['매매', '전세', '월세'] as DealType[]).map((dt) => (
              <button
                key={dt}
                onClick={() => handleDealType(dt)}
                className={[
                  'rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                  budget.dealType === dt
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 text-slate-700 hover:border-slate-300',
                ].join(' ')}
              >
                {dt}
              </button>
            ))}
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between">
              <label className="text-sm text-slate-500">{budget.dealType === '월세' ? '최대 보증금' : '최대 예산'}</label>
              <span className="text-sm font-medium text-slate-900">{(budget.maxPrice / 10000).toFixed(1)}억</span>
            </div>
            <input
              type="range"
              min={0}
              max={DEAL_TYPE_RANGES[budget.dealType].max}
              step={DEAL_TYPE_RANGES[budget.dealType].step}
              value={budget.maxPrice}
              onChange={(e) => setLocalBudget({ ...budget, maxPrice: Number(e.target.value) })}
              className="mt-2 w-full accent-slate-900"
            />
          </div>

          {budget.dealType === '월세' && (
            <div className="mt-4">
              <div className="flex items-center justify-between">
                <label className="text-sm text-slate-500">최대 월세</label>
                <span className="text-sm font-medium text-slate-900">{budget.maxMonthlyRent ?? 100}만원</span>
              </div>
              <input
                type="range"
                min={0}
                max={300}
                step={10}
                value={budget.maxMonthlyRent ?? 100}
                onChange={(e) => setLocalBudget({ ...budget, maxMonthlyRent: Number(e.target.value) })}
                className="mt-2 w-full accent-slate-900"
              />
            </div>
          )}
        </section>

        <div className="mt-8 flex items-center justify-end gap-2 border-t border-slate-100 pt-6">
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
