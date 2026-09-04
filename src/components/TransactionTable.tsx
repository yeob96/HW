import { PROPERTY_TYPE_STYLES } from '../data/dealTypeRanges'
import type { DealType, Transaction } from '../types'
import { formatDate, formatManwon, formatManwonCompact } from '../utils/format'

interface TransactionTableProps {
  transactions: Transaction[]
  dealType: DealType
}

export function TransactionTable({ transactions, dealType }: TransactionTableProps) {
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
