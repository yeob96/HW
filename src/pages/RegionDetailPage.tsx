import { useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { MapPlaceholder } from '../components/MapPlaceholder'
import { PriceTrendChart } from '../components/PriceTrendChart'
import { TransactionTable } from '../components/TransactionTable'
import { generateTransactions, getPriceTrend } from '../data/mockTransactions'
import { useSearchStore } from '../store/searchStore'
import { formatManwon } from '../utils/format'

export function RegionDetailPage() {
  const { dongCode } = useParams<{ dongCode: string }>()
  const navigate = useNavigate()
  const workplace = useSearchStore((s) => s.workplace)
  const commuteMode = useSearchStore((s) => s.commuteMode)
  const budget = useSearchStore((s) => s.budget)
  const results = useSearchStore((s) => s.results)
  const hasSearched = useSearchStore((s) => s.hasSearched)
  const getRegionResult = useSearchStore((s) => s.getRegionResult)

  const region = dongCode ? getRegionResult(dongCode) : undefined

  useEffect(() => {
    if (!hasSearched) navigate('/', { replace: true })
    else if (!region) navigate('/results', { replace: true })
  }, [hasSearched, region, navigate])

  const transactions = useMemo(() => (region ? generateTransactions(region, budget.dealType, 12) : []), [region, budget.dealType])
  const trend = useMemo(() => (region ? getPriceTrend(region, budget.dealType) : []), [region, budget.dealType])

  if (!region) return null

  const priceLabel =
    budget.dealType === '매매'
      ? formatManwon(region.avgPrice)
      : budget.dealType === '전세'
        ? formatManwon(region.avgDeposit)
        : `${formatManwon(region.avgDeposit)} / 월 ${region.avgMonthlyRent.toLocaleString()}만원`

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-100 px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <button
            onClick={() => navigate('/results')}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:border-slate-300"
          >
            ← 목록
          </button>
          <h1 className="text-lg font-semibold text-slate-900">{region.regionName}</h1>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 gap-6 px-6 py-6 lg:grid-cols-5">
        <div className="lg:col-span-2 lg:space-y-6">
          <div className="h-64 lg:h-64">
            <MapPlaceholder workplace={workplace} regions={results} selectedDongCode={region.dongCode} />
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 lg:mt-0">
            <div className="rounded-lg border border-slate-200 p-4">
              <p className="text-xs text-slate-400">평균 {budget.dealType === '매매' ? '매매가' : budget.dealType === '전세' ? '보증금' : '월세'}</p>
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
        </div>

        <div className="lg:col-span-3">
          <h2 className="mb-3 text-sm font-medium text-slate-700">가격 추이 (최근 12개월)</h2>
          <div className="rounded-lg border border-slate-200 p-4">
            <PriceTrendChart data={trend} />
          </div>

          <h2 className="mb-3 mt-6 text-sm font-medium text-slate-700">최근 실거래 내역</h2>
          <TransactionTable transactions={transactions} dealType={budget.dealType} />
        </div>
      </main>
    </div>
  )
}
