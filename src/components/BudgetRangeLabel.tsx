import { formatBudgetBounds } from '../utils/format'

interface BudgetRangeLabelProps {
  min: number
  max: number
  rangeMax: number
  format: (v: number) => string
}

/** 예산 범위를 "최소금액 ~ 최대금액"으로 표시하되, 각 영역을 고정 너비로 중앙정렬해
 * 슬라이더를 움직일 때 해당 영역의 값만 바뀌고 다른 영역은 밀리지 않게 한다. */
export function BudgetRangeLabel({ min, max, rangeMax, format }: BudgetRangeLabelProps) {
  const { isFull, minLabel, maxLabel } = formatBudgetBounds(min, max, rangeMax, format)

  if (isFull) {
    return <span className="text-sm font-medium text-slate-900">전체</span>
  }

  const isMinUnset = min <= 0
  const isMaxUnset = max >= rangeMax

  return (
    <div className="flex items-center gap-1.5 text-sm font-medium text-slate-900">
      <span className={`w-24 text-center ${isMinUnset ? 'text-xs' : ''}`}>{minLabel}</span>
      <span className="text-slate-400">~</span>
      <span className={`w-24 text-center ${isMaxUnset ? 'text-xs' : ''}`}>{maxLabel}</span>
    </div>
  )
}
