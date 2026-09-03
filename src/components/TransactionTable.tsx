import type { DealType, Transaction } from '../types'
import { formatDate, formatManwon } from '../utils/format'

interface TransactionTableProps {
  transactions: Transaction[]
  dealType: DealType
}

export function TransactionTable({ transactions, dealType }: TransactionTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs text-slate-500">
          <tr>
            <th className="px-4 py-2 font-medium">단지</th>
            <th className="px-4 py-2 font-medium">유형</th>
            <th className="px-4 py-2 font-medium">면적</th>
            <th className="px-4 py-2 font-medium">거래일</th>
            <th className="px-4 py-2 font-medium text-right">
              {dealType === '매매' ? '매매가' : dealType === '전세' ? '보증금' : '보증금 / 월세'}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {transactions.map((t) => (
            <tr key={t.id} className="text-slate-700">
              <td className="px-4 py-2.5">
                <div className="font-medium text-slate-900">{t.aptName}</div>
                <div className="text-xs text-slate-400">{t.address}</div>
              </td>
              <td className="px-4 py-2.5 text-slate-500">{t.propertyType}</td>
              <td className="px-4 py-2.5 text-slate-500">{t.area}㎡</td>
              <td className="px-4 py-2.5 text-slate-500">{formatDate(t.dealDate)}</td>
              <td className="px-4 py-2.5 text-right font-medium text-slate-900">
                {dealType === '매매' && formatManwon(t.price)}
                {dealType === '전세' && formatManwon(t.deposit)}
                {dealType === '월세' && `${formatManwon(t.deposit)} / ${t.monthlyRent.toLocaleString()}만원`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
