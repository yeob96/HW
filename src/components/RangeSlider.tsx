interface RangeSliderProps {
  min: number
  max: number
  step: number
  valueMin: number
  valueMax: number
  onChangeMin: (v: number) => void
  onChangeMax: (v: number) => void
  /** 눈금 위 숫자 표시 형식 (미지정 시 반올림한 값 그대로 표시) */
  formatTick?: (v: number) => string
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

const TICK_COUNT = 5

/** 하나의 트랙 위에서 최소·최대 두 개의 손잡이로 범위를 지정하는 슬라이더 (겹친 range input 2개 트릭) */
export function RangeSlider({
  min,
  max,
  step,
  valueMin,
  valueMax,
  onChangeMin,
  onChangeMax,
  formatTick,
}: RangeSliderProps) {
  const percent = (v: number) => (max === min ? 0 : ((v - min) / (max - min)) * 100)
  const nearTop = valueMin > min + (max - min) * 0.9
  const format = formatTick ?? ((v: number) => `${Math.round(v)}`)
  const ticks = Array.from({ length: TICK_COUNT }, (_, i) => {
    const ratio = i / (TICK_COUNT - 1)
    return { pos: ratio * 100, value: min + ratio * (max - min) }
  })

  return (
    <div>
      <div className="relative h-8 w-full text-[10px] text-slate-400">
        {ticks.map((t, i) => (
          <span
            key={i}
            className="absolute top-0 whitespace-nowrap"
            style={{
              left: `${t.pos}%`,
              transform: i === 0 ? 'translateX(0)' : i === ticks.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)',
            }}
          >
            {format(t.value)}
          </span>
        ))}
        {ticks.map((t, i) => (
          <span
            key={i}
            className="absolute bottom-0 w-px bg-slate-300"
            style={{ left: `${t.pos}%`, height: i === 0 || i === ticks.length - 1 ? '6px' : '4px' }}
          />
        ))}
      </div>
      <div className="relative mt-1 flex h-4 w-full items-center">
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
    </div>
  )
}
