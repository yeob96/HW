import { useEffect, useRef, useState } from 'react'
import { PROPERTY_TYPE_STYLES } from '../data/dealTypeRanges'
import type { DealType, Transaction } from '../types'
import { formatDate, formatManwon, formatManwonCompact } from '../utils/format'

const SWIPE_THRESHOLD = 80
const MAX_DRAG = 110
const SWIPE_OUT_DISTANCE = 500
const REVEAL_THRESHOLD = 24

const GRID_COLS = 'grid-cols-[1fr_9rem] sm:grid-cols-[1fr_7rem_9rem]'

const clampDrag = (v: number) => Math.max(-MAX_DRAG, Math.min(MAX_DRAG, v))

interface TransactionRowProps {
  t: Transaction
  dealType: DealType
  liked: boolean
  onSwipeLike?: () => void
  onSwipeDislike?: () => void
}

/**
 * 행을 왼쪽으로 드래그하면 싫어요, 오른쪽으로 드래그하면 좋아요(상단 우선 정렬) 처리된다.
 * 실제 데이터는 흰 배경의 앞면 레이어(그리드)가 통째로 밀리면서, 뒤에 숨어있던 배경(빨강/파랑 + 아이콘)이 드러난다.
 */
function TransactionRow({ t, dealType, liked, onSwipeLike, onSwipeDislike }: TransactionRowProps) {
  const [dragX, setDragX] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [flyingOut, setFlyingOut] = useState(false)
  const startX = useRef(0)
  const draggable = !!(onSwipeLike || onSwipeDislike)

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggable) return
    startX.current = e.clientX
    setDragging(true)
  }

  useEffect(() => {
    if (!dragging) return
    const handleMove = (e: PointerEvent) => setDragX(clampDrag(e.clientX - startX.current))
    const handleUp = (e: PointerEvent) => {
      const delta = clampDrag(e.clientX - startX.current)
      setDragging(false)
      if (delta <= -SWIPE_THRESHOLD && onSwipeDislike) {
        setFlyingOut(true)
        setDragX(-SWIPE_OUT_DISTANCE)
        setTimeout(onSwipeDislike, 150)
      } else if (delta >= SWIPE_THRESHOLD && onSwipeLike) {
        setFlyingOut(true)
        setDragX(SWIPE_OUT_DISTANCE)
        setTimeout(() => {
          onSwipeLike()
          // 좋아요는 목록에서 사라지지 않고 맨 위로 재정렬되므로, 밀려난 위치를 되돌려놓는다
          setFlyingOut(false)
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

  const revealSide = flyingOut
    ? dragX > 0
      ? 'like'
      : 'dislike'
    : dragX > REVEAL_THRESHOLD
      ? 'like'
      : dragX < -REVEAL_THRESHOLD
        ? 'dislike'
        : null

  const priceLabel = (() => {
    if (dealType === '매매') {
      return (
        <>
          <span className="sm:hidden">{formatManwonCompact(t.price)}</span>
          <span className="hidden sm:inline">{formatManwon(t.price)}</span>
        </>
      )
    }
    if (dealType === '전세') {
      return (
        <>
          <span className="sm:hidden">{formatManwonCompact(t.deposit)}</span>
          <span className="hidden sm:inline">{formatManwon(t.deposit)}</span>
        </>
      )
    }
    return (
      <>
        <span className="sm:hidden">
          {formatManwonCompact(t.deposit)} / {t.monthlyRent.toLocaleString()}만원
        </span>
        <span className="hidden sm:inline">
          {formatManwon(t.deposit)} / {t.monthlyRent.toLocaleString()}만원
        </span>
      </>
    )
  })()

  return (
    <div role="row" className="relative">
      {revealSide && (
        <div
          className="absolute inset-0 flex items-center"
          style={{ backgroundColor: revealSide === 'like' ? '#ef4444' : '#3b82f6' }}
        >
          {revealSide === 'like' ? (
            <span className="pl-4 text-lg text-white">♥</span>
          ) : (
            <span className="ml-auto pr-4 text-lg text-white">👎</span>
          )}
        </div>
      )}
      <div
        onPointerDown={handlePointerDown}
        className={`relative grid ${GRID_COLS} items-center bg-white text-slate-700 ${
          draggable ? 'cursor-grab touch-pan-y select-none active:cursor-grabbing' : ''
        }`}
        style={{
          transform: dragX ? `translateX(${dragX}px)` : undefined,
          transition: dragging ? 'none' : 'transform 0.2s ease-out',
        }}
      >
        <div role="cell" className="px-4 py-2.5">
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
        </div>
        <div role="cell" className="hidden px-4 py-2.5 text-center whitespace-nowrap text-slate-500 sm:block">
          {formatDate(t.dealDate)}
        </div>
        <div role="cell" className="px-4 py-2.5 text-right font-medium text-slate-900">
          {priceLabel}
        </div>
      </div>
    </div>
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
      <div role="table" className="w-full text-sm">
        <div
          role="row"
          className={`sticky top-0 z-10 grid ${GRID_COLS} bg-slate-50 text-left text-xs text-slate-500`}
        >
          <div role="columnheader" className="px-4 py-2 font-medium">
            단지
          </div>
          <div role="columnheader" className="hidden px-4 py-2 text-center font-medium sm:block">
            거래일
          </div>
          <div role="columnheader" className="px-4 py-2 text-right font-medium">
            {dealType === '매매' ? '매매가' : dealType === '전세' ? '보증금' : '보증금 / 월세'}
          </div>
        </div>
        <div className="divide-y divide-slate-100">
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
        </div>
      </div>
    </div>
  )
}
