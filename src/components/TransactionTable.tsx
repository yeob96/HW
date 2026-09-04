import { useEffect, useRef, useState } from 'react'
import { PROPERTY_TYPE_STYLES } from '../data/dealTypeRanges'
import type { DealType, Transaction } from '../types'
import { formatDate, formatManwon, formatManwonCompact } from '../utils/format'

const SWIPE_THRESHOLD = 80
const SWIPE_OUT_DISTANCE = 500

interface TransactionRowProps {
  t: Transaction
  dealType: DealType
  liked: boolean
  onSwipeLike?: () => void
  onSwipeDislike?: () => void
}

/** 행을 왼쪽으로 드래그하면 싫어요, 오른쪽으로 드래그하면 좋아요(상단 우선 정렬) 처리된다. */
function TransactionRow({ t, dealType, liked, onSwipeLike, onSwipeDislike }: TransactionRowProps) {
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const startX = useRef(0)
  const draggable = !!(onSwipeLike || onSwipeDislike)

  const handlePointerDown = (e: React.PointerEvent<HTMLTableRowElement>) => {
    if (!draggable) return
    startX.current = e.clientX
    setDragging(true)
  }

  useEffect(() => {
    if (!dragging) return
    const handleMove = (e: PointerEvent) => setDragX(e.clientX - startX.current)
    const handleUp = (e: PointerEvent) => {
      const delta = e.clientX - startX.current
      setDragging(false)
      if (delta <= -SWIPE_THRESHOLD && onSwipeDislike) {
        setDragX(-SWIPE_OUT_DISTANCE)
        setTimeout(onSwipeDislike, 150)
      } else if (delta >= SWIPE_THRESHOLD && onSwipeLike) {
        setDragX(SWIPE_OUT_DISTANCE)
        setTimeout(() => {
          onSwipeLike()
          // 좋아요는 목록에서 사라지지 않고 맨 위로 재정렬되므로, 밀려난 위치를 되돌려놓는다
          setDragX(0)
        }, 150)
      } else {
        setDragX(0)
      }
    }
    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    return () => {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }
  }, [dragging, onSwipeDislike, onSwipeLike])

  return (
    <tr
      onPointerDown={handlePointerDown}
      className={`text-slate-700 ${draggable ? 'cursor-grab touch-pan-y select-none active:cursor-grabbing' : ''}`}
      style={{
        transform: dragX ? `translateX(${dragX}px)` : undefined,
        transition: dragging ? 'none' : 'transform 0.2s ease-out, background-color 0.2s ease-out',
        backgroundColor: dragX > 24 ? 'rgba(244,63,94,0.06)' : dragX < -24 ? 'rgba(100,116,139,0.08)' : undefined,
      }}
    >
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-1.5 font-medium text-slate-900">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${PROPERTY_TYPE_STYLES[t.propertyType].bg}`} />
          {t.aptName} ({t.area}㎡)
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          {liked ? (
            <span className="flex h-2.5 w-2.5 shrink-0 items-center justify-center text-[9px] leading-none text-red-500">
              ♥
            </span>
          ) : (
            <span className="h-2.5 w-2.5 shrink-0" />
          )}
          {t.address}
        </div>
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
  )
}

interface TransactionTableProps {
  transactions: Transaction[]
  dealType: DealType
  likedIds?: string[]
  onToggleLike?: (id: string) => void
  onToggleDislike?: (id: string) => void
}

export function TransactionTable({ transactions, dealType, likedIds, onToggleLike, onToggleDislike }: TransactionTableProps) {
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
            <TransactionRow
              key={t.id}
              t={t}
              dealType={dealType}
              liked={!!likedIds?.includes(t.id)}
              onSwipeLike={onToggleLike ? () => onToggleLike(t.id) : undefined}
              onSwipeDislike={onToggleDislike ? () => onToggleDislike(t.id) : undefined}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}
