import type { DealType, RegionResult } from '../types'
import { formatManwon } from '../utils/format'

interface RegionCardProps {
  region: RegionResult
  dealType: DealType
  selected?: boolean
  liked?: boolean
  disliked?: boolean
  onClick?: () => void
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  onToggleLike?: () => void
  onToggleDislike?: () => void
}

export function RegionCard({
  region,
  dealType,
  selected,
  liked,
  disliked,
  onClick,
  onMouseEnter,
  onMouseLeave,
  onToggleLike,
  onToggleDislike,
}: RegionCardProps) {
  const priceLabel =
    dealType === '매매'
      ? formatManwon(region.avgPrice)
      : dealType === '전세'
        ? formatManwon(region.avgDeposit)
        : `${formatManwon(region.avgDeposit)} / 월 ${region.avgMonthlyRent.toLocaleString()}만원`

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick?.()}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={[
        'w-full cursor-pointer rounded-lg border p-4 text-left transition-all',
        selected
          ? 'border-slate-900 bg-slate-50'
          : 'border-slate-200 bg-white hover:border-emerald-400 hover:shadow-[0_0_0_3px_rgba(16,185,129,0.12)]',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-medium text-slate-900">{region.regionName}</h3>
        <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
          {region.commuteMinutes}분
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-500">평균 {priceLabel}</p>
      <div className="mt-2 flex items-center justify-between">
        <p className="text-xs text-slate-400">최근 거래 {region.transactionCount}건</p>
        {(onToggleLike || onToggleDislike) && (
          <div className="flex items-center gap-1">
            {onToggleLike && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleLike()
                }}
                className={[
                  'cursor-pointer rounded-full border px-2 py-0.5 text-xs font-medium transition-colors',
                  liked
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                    : 'border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600',
                ].join(' ')}
              >
                좋아요
              </button>
            )}
            {onToggleDislike && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleDislike()
                }}
                className={[
                  'cursor-pointer rounded-full border px-2 py-0.5 text-xs font-medium transition-colors',
                  disliked
                    ? 'border-red-400 bg-red-50 text-red-500'
                    : 'border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600',
                ].join(' ')}
              >
                싫어요
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
