import { useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Tooltip } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { RegionResult, Workplace } from '../types'
import { formatManwon } from '../utils/format'

interface MapPlaceholderProps {
  workplace: Workplace
  regions: RegionResult[]
  selectedDongCode?: string
  hoveredDongCode?: string
  onSelect?: (dongCode: string) => void
}

const workplaceIcon = L.divIcon({
  className: '',
  html: '<div style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:9999px;border:2px solid white;background:#0f172a;font-size:16px;box-shadow:0 2px 6px rgba(0,0,0,.35)">🏢</div>',
  iconSize: [32, 32],
  iconAnchor: [16, 16],
})

export function MapPlaceholder({ workplace, regions, selectedDongCode, hoveredDongCode, onSelect }: MapPlaceholderProps) {
  const prices = regions.map((r) => (r.avgPrice || r.avgDeposit || r.avgMonthlyRent) as number)
  const minPrice = Math.min(...prices, 0)
  const maxPrice = Math.max(...prices, 1)

  const bounds = useMemo(() => {
    const points: [number, number][] = [
      [workplace.lat, workplace.lng],
      ...regions.map((r) => [r.lat, r.lng] as [number, number]),
    ]
    return L.latLngBounds(points).pad(0.3)
  }, [workplace, regions])

  return (
    <div className="relative z-0 h-full w-full overflow-hidden rounded-xl border border-slate-200">
      <MapContainer bounds={bounds} scrollWheelZoom={false} className="h-full w-full">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <Marker position={[workplace.lat, workplace.lng]} icon={workplaceIcon}>
          <Tooltip direction="top" offset={[0, -16]} permanent>
            {workplace.name}
          </Tooltip>
        </Marker>

        {regions.map((r) => {
          const value = (r.avgPrice || r.avgDeposit || r.avgMonthlyRent) as number
          const ratio = maxPrice === minPrice ? 0.5 : (value - minPrice) / (maxPrice - minPrice)
          const baseDiameter = Math.round(26 + ratio * 18)
          const selected = r.dongCode === selectedDongCode
          const hovered = r.dongCode === hoveredDongCode
          const highlighted = selected || hovered
          const diameter = highlighted ? baseDiameter + 6 : baseDiameter
          const icon = L.divIcon({
            className: '',
            html: `<div style="display:flex;align-items:center;justify-content:center;width:${diameter}px;height:${diameter}px;border-radius:9999px;border:2px solid ${
              highlighted ? '#0f172a' : '#ffffff'
            };background:${highlighted ? '#34d399' : '#10b981'};color:#fff;font-size:11px;font-weight:700;line-height:1;box-shadow:${
              hovered ? '0 0 0 6px rgba(16,185,129,0.28), 0 2px 6px rgba(0,0,0,.35)' : '0 2px 6px rgba(0,0,0,.35)'
            };cursor:pointer;transition:box-shadow .15s ease">${r.transactionCount}</div>`,
            iconSize: [diameter, diameter],
            iconAnchor: [diameter / 2, diameter / 2],
          })
          return (
            <Marker
              key={r.dongCode}
              position={[r.lat, r.lng]}
              icon={icon}
              eventHandlers={{ click: () => onSelect?.(r.dongCode) }}
            >
              <Tooltip direction="top" offset={[0, -diameter / 2]}>
                {r.regionName} · {formatManwon(value)} · {r.commuteMinutes}분 · 최근 거래 {r.transactionCount}건
              </Tooltip>
            </Marker>
          )
        })}
      </MapContainer>

      <div className="pointer-events-none absolute left-2 top-2 rounded-md bg-white/90 px-2 py-1 text-[11px] text-slate-400 shadow-sm">
        프로토타입 지도 (OpenStreetMap) — 실제 네이버지도 미연동
      </div>
    </div>
  )
}
