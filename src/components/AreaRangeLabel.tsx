interface AreaRangeLabelProps {
  min: number
  max: number
  rangeMax: number
  format: (v: number) => string
}

/** 전용면적 범위를 "최소 ~ 최대"로 표시하되, 각 영역을 고정 너비로 중앙정렬해
 * 슬라이더를 움직일 때 해당 영역의 값만 바뀌고 다른 영역은 밀리지 않게 한다. */
export function AreaRangeLabel({ min, max, rangeMax, format }: AreaRangeLabelProps) {
  const isFull = min <= 0 && max >= rangeMax

  if (isFull) {
    return <span className="text-sm font-medium text-slate-900">전체</span>
  }

  const maxLabel = max >= rangeMax ? `${format(max)} 초과` : format(max)

  return (
    <div className="flex items-center gap-1 text-sm font-medium text-slate-900">
      <span className="w-14 text-center">{format(min)}</span>
      <span className="text-slate-400">~</span>
      <span className="w-20 text-center">{maxLabel}</span>
    </div>
  )
}
