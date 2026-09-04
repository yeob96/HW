import { useRef } from 'react'
import type { DealType, RegionResult } from '../types'
import { formatManwon } from '../utils/format'

const LONG_PRESS_MS = 600

interface RegionCardProps {
  region: RegionResult
  dealType: DealType
  selected?: boolean
  liked?: boolean
  onClick?: () => void
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  onToggleLike?: () => void
  /** 아이폰 앱 삭제모드처럼 흔들리는 중인지 (결과 목록 전체가 함께 켜진다) */
  jiggling?: boolean
  jiggleVariant?: 'a' | 'b'
  /** 꾹 누르기(길게 클릭/터치)로 흔들기 모드를 켜달라는 요청 */
  onLongPressStart?: () => void
  /** 흔들기 모드에서 X 배지나 카드 자체를 눌렀을 때 — 싫어요(제외) 확인을 띄워달라는 요청 */
  onRequestExclude?: () => void
}

export function RegionCard({
  region,
  dealType,
  selected,
  liked,
  onClick,
  onMouseEnter,
  onMouseLeave,
  onToggleLike,
  jiggling,
  jiggleVariant = 'a',
  onLongPressStart,
  onRequestExclude,
}: RegionCardProps) {
  const priceLabel =
    dealType === '매매'
      ? formatManwon(region.avgPrice)
      : dealType === '전세'
        ? formatManwon(region.avgDeposit)
        : `${formatManwon(region.avgDeposit)} / 월 ${region.avgMonthlyRent.toLocaleString()}만원`

  const pressTimer = useRef<number | null>(null)
  /** 방금 꾹 누르기로 흔들기 모드가 켜졌는지 — 그 손을 뗄 때 딸려오는 클릭 한 번은 무시한다 */
  const justLongPressed = useRef(false)

  const startPress = () => {
    if (jiggling || !onLongPressStart) return
    pressTimer.current = window.setTimeout(() => {
      justLongPressed.current = true
      onLongPressStart()
      pressTimer.current = null
    }, LONG_PRESS_MS)
  }

  const cancelPress = () => {
    if (pressTimer.current !== null) {
      clearTimeout(pressTimer.current)
      pressTimer.current = null
    }
  }

  const handleClick = () => {
    if (justLongPressed.current) {
      justLongPressed.current = false
      return
    }
    if (jiggling) {
      onRequestExclude?.()
      return
    }
    onClick?.()
  }

  return (
    <div
      role="button"
      tabIndex={0}
      data-jiggle-exempt
      onClick={handleClick}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleClick()}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onPointerDown={startPress}
      onPointerUp={cancelPress}
      onPointerLeave={cancelPress}
      onPointerCancel={cancelPress}
      onContextMenu={(e) => e.preventDefault()}
      className={[
        'relative w-full cursor-pointer touch-manipulation rounded-lg border p-4 text-left transition-all select-none',
        jiggling ? (jiggleVariant === 'a' ? 'jiggle-a' : 'jiggle-b') : '',
        selected
          ? 'border-slate-900 bg-slate-50'
          : liked
            ? 'border-pink-300 bg-white hover:border-pink-400 hover:shadow-[0_0_0_3px_rgba(244,114,182,0.15)]'
            : 'border-slate-200 bg-white hover:border-emerald-400 hover:shadow-[0_0_0_3px_rgba(16,185,129,0.12)]',
      ].join(' ')}
    >
      {jiggling && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRequestExclude?.()
          }}
          aria-label="검색 결과에서 제외"
          className="absolute -top-2 -right-2 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white shadow hover:bg-red-600"
        >
          ✕
        </button>
      )}

      <div className="flex items-start justify-between gap-2">
        <h3 className="font-medium text-slate-900">{region.regionName}</h3>
        <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
          {region.commuteMinutes}분
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-500">평균 {priceLabel}</p>
      <div className="mt-2 flex items-end justify-between">
        <p className="text-xs text-slate-400">최근 거래 {region.transactionCount}건</p>
        {onToggleLike && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggleLike()
            }}
            aria-label={liked ? '좋아요 취소' : '좋아요'}
            className="cursor-pointer text-lg leading-none"
          >
            {liked ? (
              <span className="text-red-500">♥</span>
            ) : (
              <span className="text-slate-300 hover:text-slate-400">♡</span>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
