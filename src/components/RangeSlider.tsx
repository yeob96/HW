interface RangeSliderProps {
  min: number
  max: number
  step: number
  valueMin: number
  valueMax: number
  onChangeMin: (v: number) => void
  onChangeMax: (v: number) => void
}

const THUMB_CLASS = [
  '[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4',
  '[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2',
  '[&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:bg-slate-900 [&::-webkit-slider-thumb]:shadow',
  '[&::-webkit-slider-thumb]:cursor-pointer',
  '[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4',
  '[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white',
  '[&::-moz-range-thumb]:bg-slate-900 [&::-moz-range-thumb]:shadow [&::-moz-range-thumb]:cursor-pointer',
].join(' ')

/** 하나의 트랙 위에서 최소·최대 두 개의 손잡이로 범위를 지정하는 슬라이더 (겹친 range input 2개 트릭) */
export function RangeSlider({ min, max, step, valueMin, valueMax, onChangeMin, onChangeMax }: RangeSliderProps) {
  const percent = (v: number) => (max === min ? 0 : ((v - min) / (max - min)) * 100)
  const nearTop = valueMin > min + (max - min) * 0.9

  return (
    <div className="relative flex h-4 w-full items-center">
      <div className="pointer-events-none absolute h-1.5 w-full rounded-full bg-slate-200" />
      <div
        className="pointer-events-none absolute h-1.5 rounded-full bg-slate-900"
        style={{ left: `${percent(valueMin)}%`, right: `${100 - percent(valueMax)}%` }}
      />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={valueMin}
        onChange={(e) => onChangeMin(Math.min(Number(e.target.value), valueMax))}
        className={`pointer-events-none absolute h-4 w-full cursor-pointer appearance-none bg-transparent ${THUMB_CLASS}`}
        style={{ zIndex: nearTop ? 5 : 3 }}
      />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={valueMax}
        onChange={(e) => onChangeMax(Math.max(Number(e.target.value), valueMin))}
        className={`pointer-events-none absolute h-4 w-full cursor-pointer appearance-none bg-transparent ${THUMB_CLASS}`}
        style={{ zIndex: 4 }}
      />
    </div>
  )
}
