import type { RegionResult, Workplace } from '../types'
import { formatManwon } from '../utils/format'

interface MapPlaceholderProps {
  workplace: Workplace
  regions: RegionResult[]
  selectedDongCode?: string
  onSelect?: (dongCode: string) => void
}

export function MapPlaceholder({ workplace, regions, selectedDongCode, onSelect }: MapPlaceholderProps) {
  const lats = [workplace.lat, ...regions.map((r) => r.lat)]
  const lngs = [workplace.lng, ...regions.map((r) => r.lng)]
  const pad = 0.02
  const minLat = Math.min(...lats) - pad
  const maxLat = Math.max(...lats) + pad
  const minLng = Math.min(...lngs) - pad
  const maxLng = Math.max(...lngs) + pad

  const toPos = (lat: number, lng: number) => ({
    left: `${((lng - minLng) / (maxLng - minLng)) * 100}%`,
    top: `${((maxLat - lat) / (maxLat - minLat)) * 100}%`,
  })

  const prices = regions.map((r) => (r.avgPrice || r.avgDeposit || r.avgMonthlyRent) as number)
  const minPrice = Math.min(...prices, 0)
  const maxPrice = Math.max(...prices, 1)

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'linear-gradient(to right, #e2e8f0 1px, transparent 1px), linear-gradient(to bottom, #e2e8f0 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />
      <div className="absolute left-2 top-2 rounded-md bg-white/90 px-2 py-1 text-[11px] text-slate-400 shadow-sm">
        프로토타입 지도 — 실제 카카오맵 미연동
      </div>

      {regions.map((r) => {
        const value = (r.avgPrice || r.avgDeposit || r.avgMonthlyRent) as number
        const ratio = maxPrice === minPrice ? 0.5 : (value - minPrice) / (maxPrice - minPrice)
        const size = 14 + ratio * 16
        const pos = toPos(r.lat, r.lng)
        const selected = r.dongCode === selectedDongCode
        return (
          <button
            key={r.dongCode}
            onClick={() => onSelect?.(r.dongCode)}
            className="group absolute -translate-x-1/2 -translate-y-1/2"
            style={pos}
          >
            <span
              className={[
                'block rounded-full border-2 shadow-md transition-transform group-hover:scale-110',
                selected ? 'border-slate-900 bg-emerald-400' : 'border-white bg-emerald-500',
              ].join(' ')}
              style={{ width: size, height: size }}
            />
            <span className="pointer-events-none absolute left-1/2 top-full z-10 mt-1 w-max -translate-x-1/2 rounded-md bg-slate-900 px-2 py-1 text-[11px] text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
              {r.regionName} · {formatManwon(value)} · {r.commuteMinutes}분
            </span>
          </button>
        )
      })}

      <div className="absolute -translate-x-1/2 -translate-y-1/2" style={toPos(workplace.lat, workplace.lng)}>
        <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-slate-900 text-sm shadow-lg">
          🏢
        </div>
        <div className="mt-1 -translate-x-1/2 whitespace-nowrap rounded bg-slate-900 px-1.5 py-0.5 text-[11px] text-white">
          {workplace.name}
        </div>
      </div>
    </div>
  )
}
