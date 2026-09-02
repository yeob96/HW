import type { DealType, RegionResult } from '../types'
import { formatManwon } from '../utils/format'

interface RegionCardProps {
  region: RegionResult
  dealType: DealType
  selected?: boolean
  onClick?: () => void
}

export function RegionCard({ region, dealType, selected, onClick }: RegionCardProps) {
  const priceLabel =
    dealType === '매매'
      ? formatManwon(region.avgPrice)
      : dealType === '전세'
        ? formatManwon(region.avgDeposit)
        : `${formatManwon(region.avgDeposit)} / 월 ${region.avgMonthlyRent.toLocaleString()}만원`

  return (
    <button
      onClick={onClick}
      className={[
        'w-full rounded-lg border p-4 text-left transition-colors',
        selected ? 'border-slate-900 bg-slate-50' : 'border-slate-200 bg-white hover:border-slate-300',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-medium text-slate-900">{region.regionName}</h3>
        <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
          {region.commuteMinutes}분
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-500">평균 {priceLabel}</p>
      <p className="mt-2 text-xs text-slate-400">최근 거래 {region.transactionCount}건</p>
    </button>
  )
}
