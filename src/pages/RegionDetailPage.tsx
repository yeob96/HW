import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { MapPlaceholder } from '../components/MapPlaceholder'
import { PriceTrendChart } from '../components/PriceTrendChart'
import { TransactionTable } from '../components/TransactionTable'
import { ALL_PROPERTY_TYPES, PROPERTY_TYPE_STYLES } from '../data/dealTypeRanges'
import { filterTransactions, generateTransactions, getPriceTrend } from '../data/mockTransactions'
import { useSearchStore } from '../store/searchStore'
import type { PropertyType } from '../types'
import { formatManwon } from '../utils/format'

export function RegionDetailPage() {
  const { dongCode } = useParams<{ dongCode: string }>()
  const navigate = useNavigate()
  const workplace = useSearchStore((s) => s.workplace)
  const commuteMode = useSearchStore((s) => s.commuteMode)
  const activeDealType = useSearchStore((s) => s.activeDealType)
  const budgets = useSearchStore((s) => s.budgets)
  const resultsByType = useSearchStore((s) => s.resultsByType)
  const hasSearched = useSearchStore((s) => s.hasSearched)
  const getRegionResult = useSearchStore((s) => s.getRegionResult)

  const region = dongCode ? getRegionResult(dongCode) : undefined
  const [activePropertyType, setActivePropertyType] = useState<PropertyType | '전체'>('전체')

  useEffect(() => {
    if (!hasSearched) navigate('/', { replace: true })
    else if (!region) navigate('/results', { replace: true })
  }, [hasSearched, region, navigate])

  useEffect(() => {
    setActivePropertyType('전체')
  }, [dongCode, activeDealType])

  const budget = budgets[activeDealType]
  const transactions = useMemo(
    () => (region ? filterTransactions(generateTransactions(region, activeDealType, 40), budget) : []),
    [region, activeDealType, budget],
  )
  const trend = useMemo(
    () => (region ? getPriceTrend(region, activeDealType, budget) : []),
    [region, activeDealType, budget],
  )
  const filteredTransactions = useMemo(
    () =>
      activePropertyType === '전체'
        ? transactions
        : transactions.filter((t) => t.propertyType === activePropertyType),
    [transactions, activePropertyType],
  )

  if (!region) return null

  const priceLabel =
    activeDealType === '매매'
      ? formatManwon(region.avgPrice)
      : activeDealType === '전세'
        ? formatManwon(region.avgDeposit)
        : `${formatManwon(region.avgDeposit)} / 월 ${region.avgMonthlyRent.toLocaleString()}만원`

  return (
    <div className="flex min-h-screen flex-col">
      <header className="shrink-0 border-b border-slate-100 px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <button
            onClick={() => navigate('/results')}
            className="cursor-pointer rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:border-slate-300"
          >
            ← 목록
          </button>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
            {activeDealType}
          </span>
          <h1 className="text-lg font-semibold text-slate-900">{region.regionName}</h1>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 gap-6 px-6 py-6 lg:grid-cols-5 lg:min-h-0">
        <div className="lg:col-span-2 lg:space-y-6 lg:min-h-0 lg:overflow-y-auto">
          <div className="h-64 lg:h-64">
            <MapPlaceholder
              workplace={workplace}
              regions={resultsByType[activeDealType] ?? []}
              selectedDongCode={region.dongCode}
              onSelect={(dc) => navigate(`/results/${dc}`)}
            />
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 lg:mt-0">
            <div className="rounded-lg border border-slate-200 p-4">
              <p className="text-xs text-slate-400">평균 {activeDealType === '매매' ? '매매가' : activeDealType === '전세' ? '보증금' : '월세'}</p>
              <p className="mt-1 text-base font-semibold text-slate-900">{priceLabel}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <p className="text-xs text-slate-400">최근 거래 건수</p>
              <p className="mt-1 text-base font-semibold text-slate-900">{region.transactionCount}건</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <p className="text-xs text-slate-400">{workplace.name}까지 ({commuteMode === 'transit' ? '대중교통' : '자차'})</p>
              <p className="mt-1 text-base font-semibold text-slate-900">{region.commuteMinutes}분</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <p className="text-xs text-slate-400">대중교통 / 자차</p>
              <p className="mt-1 text-base font-semibold text-slate-900">
                {region.transitMinutes}분 / {region.carMinutes}분
              </p>
            </div>
          </div>

          <div className="mt-6 lg:mt-6">
            <h2 className="mb-3 text-sm font-medium text-slate-700">가격 추이 (최근 12개월)</h2>
            <div className="rounded-lg border border-slate-200 p-4">
              <PriceTrendChart data={trend} />
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col lg:col-span-3 lg:mt-0 lg:self-start">
          <h2 className="mb-3 shrink-0 text-sm font-medium text-slate-700">최근 실거래 내역</h2>
          <div className="mb-3 flex shrink-0 items-center gap-2 border-b border-slate-100 sm:gap-4">
            <button
              onClick={() => setActivePropertyType('전체')}
              className={[
                '-mb-px cursor-pointer whitespace-nowrap border-b-2 px-0.5 py-2 text-xs font-medium transition-colors sm:px-1 sm:text-sm',
                activePropertyType === '전체'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-400 hover:text-slate-600',
              ].join(' ')}
            >
              전체
            </button>
            {ALL_PROPERTY_TYPES.map((pt) => (
              <button
                key={pt}
                onClick={() => setActivePropertyType(pt)}
                className={[
                  '-mb-px flex cursor-pointer items-center gap-1 whitespace-nowrap border-b-2 px-0.5 py-2 text-xs font-medium transition-colors sm:gap-1.5 sm:px-1 sm:text-sm',
                  activePropertyType === pt
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-slate-400 hover:text-slate-600',
                ].join(' ')}
              >
                <span className={`h-2 w-2 shrink-0 rounded-full ${PROPERTY_TYPE_STYLES[pt].bg}`} />
                {pt}
              </button>
            ))}
          </div>
          <TransactionTable transactions={filteredTransactions} dealType={activeDealType} />
        </div>
      </main>
    </div>
  )
}
