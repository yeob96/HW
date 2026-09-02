import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { StepIndicator } from '../components/StepIndicator'
import { WORKPLACE_PRESETS } from '../data/workplaces'
import { useSearchStore } from '../store/searchStore'
import type { CommuteMode, DealType } from '../types'

const STEPS = ['직장 위치', '출퇴근 조건', '예산 조건']
const MINUTE_OPTIONS = [20, 30, 40, 50, 60, 90]

export function InputPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)

  const workplace = useSearchStore((s) => s.workplace)
  const setWorkplace = useSearchStore((s) => s.setWorkplace)
  const commuteMode = useSearchStore((s) => s.commuteMode)
  const setCommuteMode = useSearchStore((s) => s.setCommuteMode)
  const maxMinutes = useSearchStore((s) => s.maxMinutes)
  const setMaxMinutes = useSearchStore((s) => s.setMaxMinutes)
  const budget = useSearchStore((s) => s.budget)
  const setBudget = useSearchStore((s) => s.setBudget)
  const runSearch = useSearchStore((s) => s.runSearch)

  const [addressInput, setAddressInput] = useState('')

  const dealTypeRanges: Record<DealType, { max: number; step: number; unit: string }> = {
    매매: { max: 300000, step: 5000, unit: '만원' },
    전세: { max: 200000, step: 5000, unit: '만원' },
    월세: { max: 20000, step: 500, unit: '만원' },
  }

  const handleDealType = (dealType: DealType) => {
    const range = dealTypeRanges[dealType]
    setBudget({
      dealType,
      minPrice: 0,
      maxPrice: Math.round(range.max * 0.6),
      maxMonthlyRent: dealType === '월세' ? 100 : undefined,
    })
  }

  const goResults = () => {
    runSearch()
    navigate('/results')
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-6 py-12">
      <header className="mb-10">
        <p className="text-sm font-medium text-emerald-600">출퇴근 기반 부동산 검색</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">살 수 있는 지역을 찾아드려요</h1>
        <p className="mt-2 text-sm text-slate-500">
          직장 위치와 출퇴근 시간, 예산만 입력하면 조건에 맞는 지역을 계산해드립니다.
        </p>
      </header>

      <StepIndicator steps={STEPS} current={step} />

      <div className="mt-10 flex-1">
        {step === 1 && (
          <section>
            <h2 className="text-lg font-medium text-slate-900">직장 위치를 선택하세요</h2>
            <p className="mt-1 text-sm text-slate-400">
              프로토타입에서는 실제 지오코딩 대신 주요 거점 중에서 선택합니다.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {WORKPLACE_PRESETS.map((w) => (
                <button
                  key={w.name}
                  onClick={() => setWorkplace(w)}
                  className={[
                    'rounded-lg border px-4 py-3 text-sm font-medium transition-colors',
                    workplace.name === w.name
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-200 text-slate-700 hover:border-slate-300',
                  ].join(' ')}
                >
                  {w.name}
                </button>
              ))}
            </div>
            <div className="mt-6">
              <label className="text-sm text-slate-500">또는 주소 직접 입력 (프로토타입: 지도 반영 안 됨)</label>
              <input
                value={addressInput}
                onChange={(e) => setAddressInput(e.target.value)}
                placeholder="예: 서울시 강남구 테헤란로 123"
                className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-slate-400"
              />
            </div>
          </section>
        )}

        {step === 2 && (
          <section>
            <h2 className="text-lg font-medium text-slate-900">출퇴근 조건을 입력하세요</h2>
            <div className="mt-6">
              <label className="text-sm text-slate-500">이동수단</label>
              <div className="mt-2 grid grid-cols-2 gap-3">
                {(['transit', 'car'] as CommuteMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setCommuteMode(mode)}
                    className={[
                      'rounded-lg border px-4 py-3 text-sm font-medium transition-colors',
                      commuteMode === mode
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 text-slate-700 hover:border-slate-300',
                    ].join(' ')}
                  >
                    {mode === 'transit' ? '🚇 대중교통' : '🚗 자차'}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-6">
              <label className="text-sm text-slate-500">최대 소요시간</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {MINUTE_OPTIONS.map((m) => (
                  <button
                    key={m}
                    onClick={() => setMaxMinutes(m)}
                    className={[
                      'rounded-full border px-4 py-2 text-sm font-medium transition-colors',
                      maxMinutes === m
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 text-slate-700 hover:border-slate-300',
                    ].join(' ')}
                  >
                    {m}분
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        {step === 3 && (
          <section>
            <h2 className="text-lg font-medium text-slate-900">예산 조건을 입력하세요</h2>
            <div className="mt-6">
              <label className="text-sm text-slate-500">거래유형</label>
              <div className="mt-2 grid grid-cols-3 gap-3">
                {(['매매', '전세', '월세'] as DealType[]).map((dt) => (
                  <button
                    key={dt}
                    onClick={() => handleDealType(dt)}
                    className={[
                      'rounded-lg border px-4 py-3 text-sm font-medium transition-colors',
                      budget.dealType === dt
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 text-slate-700 hover:border-slate-300',
                    ].join(' ')}
                  >
                    {dt}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between">
                <label className="text-sm text-slate-500">
                  {budget.dealType === '월세' ? '최대 보증금' : '최대 예산'}
                </label>
                <span className="text-sm font-medium text-slate-900">
                  {(budget.maxPrice / 10000).toFixed(1)}억
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={dealTypeRanges[budget.dealType].max}
                step={dealTypeRanges[budget.dealType].step}
                value={budget.maxPrice}
                onChange={(e) => setBudget({ ...budget, maxPrice: Number(e.target.value) })}
                className="mt-3 w-full accent-slate-900"
              />
            </div>

            {budget.dealType === '월세' && (
              <div className="mt-6">
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
                  onChange={(e) => setBudget({ ...budget, maxMonthlyRent: Number(e.target.value) })}
                  className="mt-3 w-full accent-slate-900"
                />
              </div>
            )}
          </section>
        )}
      </div>

      <footer className="mt-10 flex items-center justify-between border-t border-slate-100 pt-6">
        <button
          onClick={() => setStep((s) => Math.max(1, s - 1))}
          disabled={step === 1}
          className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-500 hover:border-slate-300 hover:bg-slate-50 disabled:opacity-0"
        >
          이전
        </button>
        {step < 3 ? (
          <button
            onClick={() => setStep((s) => Math.min(3, s + 1))}
            className="rounded-lg bg-slate-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            다음
          </button>
        ) : (
          <button
            onClick={goResults}
            className="rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-emerald-500"
          >
            결과 보기
          </button>
        )}
      </footer>
    </div>
  )
}
