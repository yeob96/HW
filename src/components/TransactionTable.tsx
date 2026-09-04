import { PROPERTY_TYPE_STYLES } from '../data/dealTypeRanges'
import type { DealType, Transaction } from '../types'
import { formatDate, formatManwon, formatManwonCompact } from '../utils/format'

interface TransactionTableProps {
  transactions: Transaction[]
  dealType: DealType
  likedIds?: string[]
  dislikedIds?: string[]
  onToggleLike?: (id: string) => void
  onToggleDislike?: (id: string) => void
}

export function TransactionTable({
  transactions,
  dealType,
  likedIds,
  dislikedIds,
  onToggleLike,
  onToggleDislike,
}: TransactionTableProps) {
  const showActions = !!(onToggleLike || onToggleDislike)

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 lg:max-h-[712px] lg:overflow-y-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs text-slate-500">
          <tr>
            <th className="px-4 py-2 text-left font-medium">단지</th>
            <th className="hidden whitespace-nowrap px-4 py-2 text-center font-medium sm:table-cell sm:w-28">거래일</th>
            <th className="px-4 py-2 text-right font-medium">
              {dealType === '매매' ? '매매가' : dealType === '전세' ? '보증금' : '보증금 / 월세'}
            </th>
            {showActions && <th className="w-16 px-2 py-2 text-center font-medium">관심</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {transactions.map((t) => (
            <tr key={t.id} className="text-slate-700">
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-1.5 font-medium text-slate-900">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${PROPERTY_TYPE_STYLES[t.propertyType].bg}`} />
                  {t.aptName} ({t.area}㎡)
                </div>
                <div className="pl-4 text-xs text-slate-400">{t.address}</div>
              </td>
              <td className="hidden whitespace-nowrap px-4 py-2.5 text-center text-slate-500 sm:table-cell">
                {formatDate(t.dealDate)}
              </td>
              <td className="px-4 py-2.5 text-right font-medium text-slate-900">
                {dealType === '매매' && (
                  <>
                    <span className="sm:hidden">{formatManwonCompact(t.price)}</span>
                    <span className="hidden sm:inline">{formatManwon(t.price)}</span>
                  </>
                )}
                {dealType === '전세' && (
                  <>
                    <span className="sm:hidden">{formatManwonCompact(t.deposit)}</span>
                    <span className="hidden sm:inline">{formatManwon(t.deposit)}</span>
                  </>
                )}
                {dealType === '월세' && (
                  <>
                    <span className="sm:hidden">
                      {formatManwonCompact(t.deposit)} / {t.monthlyRent.toLocaleString()}만원
                    </span>
                    <span className="hidden sm:inline">
                      {formatManwon(t.deposit)} / {t.monthlyRent.toLocaleString()}만원
                    </span>
                  </>
                )}
              </td>
              {showActions && (
                <td className="px-2 py-2.5">
                  <div className="flex items-center justify-center gap-1">
                    {onToggleLike && (
                      <button
                        onClick={() => onToggleLike(t.id)}
                        aria-label="매물 좋아요"
                        className={[
                          'h-6 w-6 shrink-0 cursor-pointer rounded-full border text-xs leading-none transition-colors',
                          likedIds?.includes(t.id)
                            ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                            : 'border-slate-200 text-slate-300 hover:border-slate-300 hover:text-slate-500',
                        ].join(' ')}
                      >
                        ♥
                      </button>
                    )}
                    {onToggleDislike && (
                      <button
                        onClick={() => onToggleDislike(t.id)}
                        aria-label="매물 싫어요"
                        className={[
                          'h-6 w-6 shrink-0 cursor-pointer rounded-full border text-xs leading-none transition-colors',
                          dislikedIds?.includes(t.id)
                            ? 'border-red-400 bg-red-50 text-red-500'
                            : 'border-slate-200 text-slate-300 hover:border-slate-300 hover:text-slate-500',
                        ].join(' ')}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
