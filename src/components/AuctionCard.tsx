import type { AuctionItem, AuctionStatus } from '../types'
import { daysUntilSale, discountRate, isRisky, marketGapRate, saleDateLabel } from '../data/mockAuctions'
import { formatDate, formatManwon } from '../utils/format'

const STATUS_STYLE: Record<AuctionStatus, string> = {
  신건: 'bg-sky-50 text-sky-700',
  유찰: 'bg-amber-50 text-amber-700',
  재매각: 'bg-orange-50 text-orange-700',
  변경: 'bg-slate-100 text-slate-500',
  매각: 'bg-slate-100 text-slate-400',
}

interface AuctionCardProps {
  item: AuctionItem
  liked?: boolean
  onClick?: () => void
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  onToggleLike?: () => void
}

export function AuctionCard({ item, liked, onClick, onMouseEnter, onMouseLeave, onToggleLike }: AuctionCardProps) {
  const discount = discountRate(item)
  const gap = marketGapRate(item)
  const risky = isRisky(item)
  const closed = item.status === '매각'
  const days = daysUntilSale(item)
  const urgent = !closed && days >= 0 && days <= 7

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onClick?.()}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={[
        'relative w-full cursor-pointer rounded-lg border p-4 text-left transition-all',
        closed
          ? 'border-slate-200 bg-slate-50 opacity-70 hover:opacity-100'
          : liked
            ? 'border-pink-300 bg-white hover:border-pink-400 hover:shadow-[0_0_0_3px_rgba(244,114,182,0.15)]'
            : 'border-slate-200 bg-white hover:border-emerald-400 hover:shadow-[0_0_0_3px_rgba(16,185,129,0.12)]',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
            {item.propertyType}
          </span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[item.status]}`}>
            {item.status}
            {item.failedCount > 0 && item.status === '유찰' ? ` ${item.failedCount}회` : ''}
          </span>
          {risky && (
            <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">권리분석 필요</span>
          )}
        </div>
        {onToggleLike && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggleLike()
            }}
            aria-label={liked ? '관심물건 해제' : '관심물건 등록'}
            className="shrink-0 cursor-pointer text-lg leading-none"
          >
            {liked ? <span className="text-red-500">♥</span> : <span className="text-slate-300 hover:text-slate-400">♡</span>}
          </button>
        )}
      </div>

      <h3 className="mt-2 truncate font-medium text-slate-900">{item.buildingName}</h3>
      <p className="mt-0.5 truncate text-xs text-slate-400">
        {item.caseNo}
        {item.itemNo > 1 ? ` (${item.itemNo})` : ''} · {item.court}
      </p>
      <p className="mt-1 truncate text-sm text-slate-500">{item.address}</p>

      <div className="mt-3 flex items-end justify-between gap-2">
        <div>
          <p className="text-xs text-slate-400">
            감정가 <span className="line-through">{formatManwon(item.appraisalPrice)}</span>
          </p>
          <p className="mt-0.5 flex items-baseline gap-1.5">
            <span className={`text-lg font-semibold ${closed ? 'text-slate-500' : 'text-emerald-700'}`}>
              {formatManwon(item.minimumPrice)}
            </span>
            {discount > 0 && (
              <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-xs font-medium text-emerald-700">
                -{discount}%
              </span>
            )}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className={`text-sm font-medium ${urgent ? 'text-red-600' : 'text-slate-600'}`}>{saleDateLabel(item)}</p>
          <p className="mt-0.5 text-xs text-slate-400">{formatDate(item.saleDate)}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-100 pt-2 text-xs text-slate-400">
        <span>
          {item.propertyType === '토지'
            ? `토지 ${item.landArea}㎡`
            : `전용 ${item.exclusiveArea}㎡ · 대지 ${item.landArea}㎡`}
        </span>
        <span className={gap > 0 ? 'text-emerald-600' : 'text-slate-400'}>
          시세 대비 {gap > 0 ? `${gap}% 저렴` : `${Math.abs(gap)}% 높음`}
        </span>
      </div>
    </div>
  )
}
