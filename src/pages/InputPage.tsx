import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, type Variants } from 'framer-motion'
import { AreaRangeLabel } from '../components/AreaRangeLabel'
import { BudgetRangeLabel } from '../components/BudgetRangeLabel'
import { RangeSlider } from '../components/RangeSlider'
import { StepIndicator } from '../components/StepIndicator'
import {
  ALL_DEAL_TYPES,
  ALL_PROPERTY_TYPES,
  AREA_RANGE,
  DEAL_TYPE_RANGES,
  MONTHLY_RENT_RANGE,
  PROPERTY_TYPE_STYLES,
} from '../data/dealTypeRanges'
import { WORKPLACE_PRESETS } from '../data/workplaces'
import { useCurrentUser } from '../store/authStore'
import { useSearchStore } from '../store/searchStore'
import type { CommuteMode, DealType } from '../types'
import { formatEokTick, formatEokTickBound, formatRangeLabel } from '../utils/format'

const STEPS = ['직장 위치', '출퇴근 조건', '예산 조건']
const MINUTE_OPTIONS = [20, 30, 40, 50, 60, 90]
const ITEM_STAGGER = 0.045

// 부모(스텝 컨테이너)는 자체 트랜스폼 없이 자식들의 enter/center/exit 상태만 전파한다.
const containerVariants: Variants = {
  enter: {},
  center: {},
  exit: {},
}

const itemVariants: Variants = {
  enter: (direction: number) => ({ opacity: 0, x: direction > 0 ? 32 : -32 }),
  center: { opacity: 1, x: 0 },
  exit: (direction: number) => ({ opacity: 0, x: direction > 0 ? -32 : 32 }),
}

function useShuffledRanks(length: number, seedKey: string | number) {
  return useMemo(() => {
    const ranks = Array.from({ length }, (_, i) => i)
    for (let i = ranks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[ranks[i], ranks[j]] = [ranks[j], ranks[i]]
    }
    return ranks
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [length, seedKey])
}

export function InputPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [direction, setDirection] = useState(1)

  const user = useCurrentUser()
  const hasSearched = useSearchStore((s) => s.hasSearched)

  useEffect(() => {
    if (user && hasSearched) navigate('/results', { replace: true })
  }, [user, hasSearched, navigate])

  const workplace = useSearchStore((s) => s.workplace)
  const setWorkplace = useSearchStore((s) => s.setWorkplace)
  const commuteMode = useSearchStore((s) => s.commuteMode)
  const setCommuteMode = useSearchStore((s) => s.setCommuteMode)
  const maxMinutes = useSearchStore((s) => s.maxMinutes)
  const setMaxMinutes = useSearchStore((s) => s.setMaxMinutes)
  const dealTypes = useSearchStore((s) => s.dealTypes)
  const toggleDealType = useSearchStore((s) => s.toggleDealType)
  const budgets = useSearchStore((s) => s.budgets)
  const setBudget = useSearchStore((s) => s.setBudget)
  const togglePropertyType = useSearchStore((s) => s.togglePropertyType)
  const setAreaRange = useSearchStore((s) => s.setAreaRange)
  const detailsOpen = useSearchStore((s) => s.detailsOpen)
  const toggleDetailsOpen = useSearchStore((s) => s.toggleDetailsOpen)
  const runSearch = useSearchStore((s) => s.runSearch)

  const [addressInput, setAddressInput] = useState('')

  const selectedDealTypes = ALL_DEAL_TYPES.filter((dt) => dealTypes.includes(dt))

  const goNext = () => {
    setDirection(1)
    setStep((s) => Math.min(3, s + 1))
  }

  const goPrev = () => {
    setDirection(-1)
    setStep((s) => Math.max(1, s - 1))
  }

  const goResults = () => {
    runSearch()
    navigate('/results')
  }

  const dealTypeSectionItems = selectedDealTypes.length
  const itemCount =
    step === 1
      ? 2 + WORKPLACE_PRESETS.length + 1
      : step === 2
        ? 5 + MINUTE_OPTIONS.length
        : 5 + dealTypeSectionItems
  const ranks = useShuffledRanks(itemCount, step)
  const delayFor = (i: number) => (ranks[i] ?? i) * ITEM_STAGGER

  if (user && hasSearched) return null

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col overflow-x-hidden px-6 py-12">
      <header className="mb-10">
        <p className="text-sm font-medium text-emerald-600">출퇴근 기반 부동산 검색</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">살 수 있는 지역을 찾아드려요</h1>
        <p className="mt-2 text-sm text-slate-500">
          직장 위치와 출퇴근 시간, 예산만 입력하면 조건에 맞는 지역을 계산해드립니다.
        </p>
      </header>

      <StepIndicator steps={STEPS} current={step} />

      <div className="relative mt-10 flex-1">
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          {step === 1 && (
            <motion.section
              key="step-1"
              custom={direction}
              variants={containerVariants}
              initial="enter"
              animate="center"
              exit="exit"
            >
              <motion.h2
                custom={direction}
                variants={itemVariants}
                transition={{ duration: 0.3, ease: 'easeOut', delay: delayFor(0) }}
                className="text-lg font-medium text-slate-900"
              >
                직장 위치를 선택하세요
              </motion.h2>
              <motion.p
                custom={direction}
                variants={itemVariants}
                transition={{ duration: 0.3, ease: 'easeOut', delay: delayFor(1) }}
                className="mt-1 text-sm text-slate-400"
              >
                프로토타입에서는 실제 지오코딩 대신 주요 거점 중에서 선택합니다.
              </motion.p>
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {WORKPLACE_PRESETS.map((w, i) => (
                  <motion.button
                    key={w.name}
                    custom={direction}
                    variants={itemVariants}
                    transition={{ duration: 0.3, ease: 'easeOut', delay: delayFor(2 + i) }}
                    onClick={() => setWorkplace(w)}
                    className={[
                      'cursor-pointer rounded-lg border px-4 py-3 text-sm font-medium transition-colors',
                      workplace.name === w.name
                        ? 'border-slate-900 bg-slate-900 text-white hover:bg-slate-800'
                        : 'border-slate-200 text-slate-700 hover:border-slate-300',
                    ].join(' ')}
                  >
                    {w.name}
                  </motion.button>
                ))}
              </div>
              <motion.div
                custom={direction}
                variants={itemVariants}
                transition={{ duration: 0.3, ease: 'easeOut', delay: delayFor(2 + WORKPLACE_PRESETS.length) }}
                className="mt-6"
              >
                <label className="text-sm text-slate-500">또는 주소 직접 입력 (프로토타입: 지도 반영 안 됨)</label>
                <input
                  value={addressInput}
                  onChange={(e) => setAddressInput(e.target.value)}
                  placeholder="예: 서울시 강남구 테헤란로 123"
                  className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-slate-400"
                />
              </motion.div>
            </motion.section>
          )}

          {step === 2 && (
            <motion.section
              key="step-2"
              custom={direction}
              variants={containerVariants}
              initial="enter"
              animate="center"
              exit="exit"
            >
              <motion.h2
                custom={direction}
                variants={itemVariants}
                transition={{ duration: 0.3, ease: 'easeOut', delay: delayFor(0) }}
                className="text-lg font-medium text-slate-900"
              >
                출퇴근 조건을 입력하세요
              </motion.h2>
              <div className="mt-6">
                <motion.label
                  custom={direction}
                  variants={itemVariants}
                  transition={{ duration: 0.3, ease: 'easeOut', delay: delayFor(1) }}
                  className="block text-sm text-slate-500"
                >
                  이동수단
                </motion.label>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  {(['transit', 'car'] as CommuteMode[]).map((mode, i) => (
                    <motion.button
                      key={mode}
                      custom={direction}
                      variants={itemVariants}
                      transition={{ duration: 0.3, ease: 'easeOut', delay: delayFor(2 + i) }}
                      onClick={() => setCommuteMode(mode)}
                      className={[
                        'cursor-pointer rounded-lg border px-4 py-3 text-sm font-medium transition-colors',
                        commuteMode === mode
                          ? 'border-slate-900 bg-slate-900 text-white hover:bg-slate-800'
                          : 'border-slate-200 text-slate-700 hover:border-slate-300',
                      ].join(' ')}
                    >
                      {mode === 'transit' ? '대중교통' : '자차'}
                    </motion.button>
                  ))}
                </div>
              </div>
              <div className="mt-6">
                <motion.label
                  custom={direction}
                  variants={itemVariants}
                  transition={{ duration: 0.3, ease: 'easeOut', delay: delayFor(4) }}
                  className="block text-sm text-slate-500"
                >
                  최대 소요시간
                </motion.label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {MINUTE_OPTIONS.map((m, i) => (
                    <motion.button
                      key={m}
                      custom={direction}
                      variants={itemVariants}
                      transition={{ duration: 0.3, ease: 'easeOut', delay: delayFor(5 + i) }}
                      onClick={() => setMaxMinutes(m)}
                      className={[
                        'cursor-pointer rounded-full border px-4 py-2 text-sm font-medium transition-colors',
                        maxMinutes === m
                          ? 'border-slate-900 bg-slate-900 text-white hover:bg-slate-800'
                          : 'border-slate-200 text-slate-700 hover:border-slate-300',
                      ].join(' ')}
                    >
                      {m}분
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.section>
          )}

          {step === 3 && (
            <motion.section
              key="step-3"
              custom={direction}
              variants={containerVariants}
              initial="enter"
              animate="center"
              exit="exit"
            >
              <motion.h2
                custom={direction}
                variants={itemVariants}
                transition={{ duration: 0.3, ease: 'easeOut', delay: delayFor(0) }}
                className="text-lg font-medium text-slate-900"
              >
                예산 조건을 입력하세요
              </motion.h2>
              <div className="mt-6">
                <motion.label
                  custom={direction}
                  variants={itemVariants}
                  transition={{ duration: 0.3, ease: 'easeOut', delay: delayFor(1) }}
                  className="block text-sm text-slate-500"
                >
                  거래유형 (중복 선택 가능)
                </motion.label>
                <div className="mt-2 grid grid-cols-3 gap-3">
                  {(['매매', '전세', '월세'] as DealType[]).map((dt, i) => (
                    <motion.button
                      key={dt}
                      custom={direction}
                      variants={itemVariants}
                      transition={{ duration: 0.3, ease: 'easeOut', delay: delayFor(2 + i) }}
                      onClick={() => toggleDealType(dt)}
                      className={[
                        'cursor-pointer rounded-lg border px-4 py-3 text-sm font-medium transition-colors',
                        dealTypes.includes(dt)
                          ? 'border-slate-900 bg-slate-900 text-white hover:bg-slate-800'
                          : 'border-slate-200 text-slate-700 hover:border-slate-300',
                      ].join(' ')}
                    >
                      {dt}
                    </motion.button>
                  ))}
                </div>
              </div>

              {selectedDealTypes.map((dt, sectionIdx) => {
                const budget = budgets[dt]
                return (
                  <motion.div
                    key={dt}
                    custom={direction}
                    variants={itemVariants}
                    transition={{ duration: 0.3, ease: 'easeOut', delay: delayFor(5 + sectionIdx) }}
                    className="mt-6 rounded-lg border border-slate-200 p-4"
                  >
                    <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                      {dt}
                    </span>

                    <div className="mt-3 flex items-center justify-between">
                      <label className="text-sm text-slate-500">{dt === '월세' ? '보증금' : '예산'} 범위</label>
                      <BudgetRangeLabel
                        min={budget.minPrice}
                        max={budget.maxPrice}
                        rangeMax={DEAL_TYPE_RANGES[dt].max}
                        format={(v) => formatEokTick(v)}
                      />
                    </div>
                    <div className="mt-4">
                      <RangeSlider
                        min={0}
                        max={DEAL_TYPE_RANGES[dt].max}
                        step={DEAL_TYPE_RANGES[dt].step}
                        valueMin={budget.minPrice}
                        valueMax={budget.maxPrice}
                        onChangeMin={(v) => setBudget(dt, { minPrice: v })}
                        onChangeMax={(v) => setBudget(dt, { maxPrice: v })}
                        formatTick={(v) => formatEokTickBound(v, DEAL_TYPE_RANGES[dt].max)}
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
                            onChangeMin={(v) => setBudget(dt, { minMonthlyRent: v })}
                            onChangeMax={(v) => setBudget(dt, { maxMonthlyRent: v })}
                            formatTick={(v) => `${Math.round(v)}만`}
                          />
                        </div>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => toggleDetailsOpen(dt)}
                      className="mt-4 flex w-full cursor-pointer items-center gap-3 text-xs font-medium text-slate-400 hover:text-slate-600"
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
                                  'cursor-pointer rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
                                  budget.propertyTypes.includes(pt)
                                    ? 'border-slate-900 bg-slate-900 text-white hover:bg-slate-800'
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
                                    <AreaRangeLabel
                                      min={area.min}
                                      max={area.max}
                                      rangeMax={AREA_RANGE.max}
                                      format={(v) => `${v}㎡`}
                                    />
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
                  </motion.div>
                )
              })}
            </motion.section>
          )}
        </AnimatePresence>
      </div>

      <footer className="mt-10 flex items-center justify-between border-t border-slate-100 pt-6">
        <button
          onClick={goPrev}
          disabled={step === 1}
          className="cursor-pointer rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-500 hover:border-slate-300 hover:bg-slate-50 disabled:cursor-default disabled:opacity-0"
        >
          이전
        </button>
        {step < 3 ? (
          <button
            onClick={goNext}
            className="cursor-pointer rounded-lg bg-slate-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            다음
          </button>
        ) : (
          <button
            onClick={goResults}
            className="cursor-pointer rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-emerald-500"
          >
            결과 보기
          </button>
        )}
      </footer>
    </div>
  )
}
