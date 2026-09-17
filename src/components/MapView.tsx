import { useEffect, useRef, useState } from 'react'
import { AttributionControl, Map as MapLibreMap, NavigationControl, ScaleControl } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'
const DEFAULT_CENTER: [number, number] = [127.1086, 37.3606] // 성남시 분당구 정자동
const DEFAULT_ZOOM = 15

const FILTERS = ['매매', '유형', '평형', '가격']

const CATEGORY_TABS = ['분양', '이야기', '재건축', '경매', '뉴스', '오늘']

const CATEGORY_CHIPS = [
  '학원가',
  '가격변동',
  '개발호재',
  '상권',
  '경사/고도',
  '거래량',
  '신고가',
  '직장인연봉',
  '인구',
  '공급',
  '출근',
  '분위지도',
  '외지인비율',
  '하락거래',
  '미분양',
  '역세권',
  '배송생활권',
]

const SIDE_ICONS = [
  { label: '지도', icon: '🗺️' },
  { label: '필터', icon: '🎛️' },
  { label: '주변', icon: '📍' },
  { label: '거리', icon: '📐' },
  { label: '정책', icon: '📋' },
  { label: '숨김', icon: '🙈' },
]

export function MapView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)

  const [tab, setTab] = useState<'단지' | '매물'>('단지')
  const [activeCategoryTab, setActiveCategoryTab] = useState<string | null>(null)
  const [activeChip, setActiveChip] = useState<string | null>(null)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = new MapLibreMap({
      container: containerRef.current,
      style: MAP_STYLE_URL,
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      attributionControl: false,
    })

    map.addControl(new NavigationControl({ showCompass: false }), 'bottom-right')
    map.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-left')
    map.addControl(new AttributionControl({ compact: true }), 'bottom-left')

    map.on('load', () => {
      for (const layer of map.getStyle()?.layers ?? []) {
        if (/shield|highway-name/i.test(layer.id)) map.setLayoutProperty(layer.id, 'visibility', 'none')
      }
    })

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="absolute inset-0">
        <div ref={containerRef} className="h-full w-full" />
      </div>

      {/* top-left search / filter panel */}
      <div className="absolute left-4 top-4 flex w-[380px] max-w-[92vw] flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <span className="text-base">🏠</span>
          </div>
          <div className="flex rounded-full bg-slate-100 p-1 text-sm font-medium">
            {(['단지', '매물'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`cursor-pointer rounded-full px-4 py-1.5 transition-colors ${
                  tab === t ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="px-4 pt-3">
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2">
            <span className="text-slate-400">🔍</span>
            <input
              type="text"
              placeholder="아파트, 지역 또는 학교명으로 검색"
              className="w-full text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 px-4 pt-3 text-xs">
          <span className="rounded-md border border-rose-200 px-1.5 py-0.5 font-semibold text-rose-500">실시간</span>
          <span className="text-slate-500">2 병점역아이파크캐슬 1,475명</span>
        </div>

        <div className="flex items-center gap-2 px-4 py-3 text-sm text-slate-600">
          {FILTERS.map((f) => (
            <button
              key={f}
              className="flex cursor-pointer items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1.5 hover:border-slate-300"
            >
              {f} <span className="text-[10px] text-slate-400">▾</span>
            </button>
          ))}
          <button className="ml-auto cursor-pointer text-slate-400">›</button>
        </div>

        <div className="flex items-center gap-4 border-t border-slate-100 px-4 py-2.5 text-sm">
          {CATEGORY_TABS.map((c) => (
            <button
              key={c}
              onClick={() => setActiveCategoryTab(c)}
              className={`cursor-pointer whitespace-nowrap pb-1 ${
                activeCategoryTab === c
                  ? 'border-b-2 border-indigo-600 font-semibold text-indigo-600'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-4 gap-2 px-4 pb-4 pt-1">
          {CATEGORY_CHIPS.map((chip) => (
            <button
              key={chip}
              onClick={() => setActiveChip((prev) => (prev === chip ? null : chip))}
              className={`cursor-pointer rounded-lg border px-2 py-2 text-center text-xs font-medium transition-colors ${
                activeChip === chip
                  ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      {/* right-side icon rail */}
      <div className="absolute right-4 top-4 flex flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        {SIDE_ICONS.map(({ label, icon }) => (
          <button
            key={label}
            className="flex w-16 cursor-pointer flex-col items-center gap-1 border-b border-slate-100 px-2 py-3 text-[11px] text-slate-500 last:border-b-0 hover:bg-slate-50"
          >
            <span className="text-lg">{icon}</span>
            {label}
          </button>
        ))}
      </div>

      {/* chat bubble */}
      <button className="absolute bottom-24 right-4 flex h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-indigo-600 text-lg text-white shadow-xl hover:bg-indigo-700">
        💬
      </button>
    </div>
  )
}
