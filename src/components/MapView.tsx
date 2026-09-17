import { Fragment, useEffect, useRef, useState } from 'react'
import { AttributionControl, Map as MapLibreMap, NavigationControl, ScaleControl } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'
const DEFAULT_CENTER: [number, number] = [127.1086, 37.3606] // 성남시 분당구 정자동
const DEFAULT_ZOOM = 15

// 좌하단 축척이 "1 km"로 표시되는 지점(zoom 약 12.6)부터 산지 등 색 있는 영역을 숨긴다
const GREEN_HIDE_MAX_ZOOM = 12.6
// 좌하단 축척이 "3 km"로 표시되는 지점(zoom 약 11)부터 일반(노란) 도로를 숨긴다
const MID_ZOOM_MAX = 11.1
// 좌하단 축척이 "5 km"로 표시되는 지점(이 위도 기준 zoom 약 10.25~10.5 사이)부터는 고속도로/철도/건물까지 숨긴다
const ROAD_HIDE_MAX_ZOOM = 10.3
// 시/군/구 경계선(admin_level 3~6)의 기본 스타일과, 도로가 숨겨졌을 때 더 도드라지게 보여줄 스타일
const CITY_BOUNDARY_LAYER = 'boundary_3'
const CITY_BOUNDARY_DEFAULT_PAINT = {
  'line-color': 'hsl(0, 0%, 70%)',
  'line-dasharray': [1, 1],
  'line-width': ['interpolate', ['linear', 1], ['zoom'], 7, 1, 11, 2],
}
const CITY_BOUNDARY_EMPHASIZED_PAINT = {
  'line-color': '#64748b',
  'line-dasharray': [1, 0], // gap 0 → 점선이 아닌 얇은 실선으로 보인다
  'line-width': 1,
}
// 1km 기준으로 산지/숲/공원/공동묘지/학교/운동장/주거지 등의 색이 있는 영역을 숨겨서
// 평지와 구분 없이 보이게 한다 (배경색 #f8f4f0이 그대로 드러나 밝은 회색 계열 평지처럼 보인다)
const COLORED_AREA_LAYER_IDS = [
  'landcover_wood',
  'landcover_grass',
  'park',
  'park_outline',
  'landuse_cemetery',
  'landuse_pitch',
  'landuse_track',
  'landuse_school',
  'landcover_wetland',
  'landuse_residential', // 시가지/주거지 음영 — 축소했을 때 보이던 회색 얼룩의 정체
  'aeroway_fill',
]

// building-3d 레이어의 minzoom과 동일 — 이 zoom부터 건물이 입체로 표시될 수 있다
const BUILDING_3D_MIN_ZOOM = 14

// 지도에 10초간 동작이 없으면 도로에 무지개색이 흐르는 LED 효과를 켠다
const RAINBOW_IDLE_MS = 10000
const RAINBOW_HUE_CYCLE_MS = 4000
const RAINBOW_DASH_STEP_MS = 80
// 대시 패턴을 프레임마다 조금씩 밀어서 빛이 이동하는 것처럼 보이게 하는 시퀀스
const RAINBOW_DASH_SEQUENCE = [
  [0, 4, 3],
  [0.5, 4, 2.5],
  [1, 4, 2],
  [1.5, 4, 1.5],
  [2, 4, 1],
  [2.5, 4, 0.5],
  [3, 4, 0],
  [0, 0.5, 3, 3.5],
  [0, 1, 3, 3],
  [0, 1.5, 3, 2.5],
  [0, 2, 3, 2],
  [0, 2.5, 3, 1.5],
  [0, 3, 3, 1],
  [0, 3.5, 3, 0.5],
]

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
  const [show3DToggle, setShow3DToggle] = useState(false)
  const [buildings3DOn, setBuildings3DOn] = useState(false)

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    let idleTimer: ReturnType<typeof setTimeout> | null = null
    let rainbowFrame: number | null = null

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
      // "위례신도시"(suburb), "헌인마을"(hamlet) 등 시/군/구보다 작은 동네 이름은
      // label_other 레이어(도시/국가/주/읍면동/촌락 등 큰 단위를 제외한 나머지)에서 나온다
      map.setLayoutProperty('label_other', 'visibility', 'none')

      // 학교 부지가 연두색이라 공원/산지 초록색과 헷갈려서, 연한 노란색으로 바꾼다
      map.setPaintProperty('landuse_school', 'fill-color', '#fef9c3')

      // 학교/관공서/보건소 등 주요시설은 남기고, 상가(각종 상점/식당/카페 등)와 버스정류장만 숨긴다
      const HIDDEN_POI_CLASSES = [
        'shop',
        'grocery',
        'restaurant',
        'bakery',
        'fast_food',
        'clothing_store',
        'cafe',
        'bar',
        'bank',
        'laundry',
        'lodging',
        'fuel',
        'car',
        'bicycle',
        'veterinary',
        'telephone',
        'office',
        'bus',
        'waste_basket',
        'ice_cream',
        'butcher',
        'hairdresser',
        'beer',
        'alcohol_shop',
        'atm',
        'music',
        'billiards',
        'escape_game',
        'bicycle_rental',
        'information',
        'shelter',
        'viewpoint',
        'parking',
      ]
      for (const id of ['poi_r1', 'poi_r7', 'poi_r20', 'poi_transit']) {
        const filter = map.getFilter(id)
        if (filter) {
          map.setFilter(id, ['all', filter, ['!', ['in', ['get', 'class'], ['literal', HIDDEN_POI_CLASSES]]]])
        }
        // 남아있는 POI도 동그라미 아이콘(휠체어 마크 등)은 지우고 이름 글자만 남긴다
        map.setPaintProperty(id, 'icon-opacity', 0)
      }

      // 하천 데이터가 강/천 구분 없이 모두 class: river로 들어와 있어, 이름 끝 글자가
      // "천"으로 끝나는 것만 라벨을 숨기고 "강"으로 끝나는 이름(한강 등)은 남긴다
      const waterwayLabelFilter = map.getFilter('waterway_line_label')
      if (waterwayLabelFilter) {
        map.setFilter('waterway_line_label', [
          'all',
          waterwayLabelFilter,
          [
            'case',
            ['has', 'name'],
            ['!=', ['slice', ['get', 'name'], ['-', ['length', ['get', 'name']], 1]], '천'],
            true,
          ],
        ])
      }

      // 도로/철도(선), 건물(면)을 두 단계로 나눠 모은다
      // - yellowRoadLayerIds: 고속도로(motorway)를 제외한 일반 도로(국도/간선/링크) — 3km부터 숨김
      // - hideAt5kmLayerIds: 고속도로, 철도, 건물 — 5km부터 숨김 (더 축소해야 사라짐)
      const yellowRoadLayerIds: string[] = []
      const motorwayLayerIds: string[] = []
      const hideAt5kmLayerIds: string[] = []
      for (const layer of map.getStyle()?.layers ?? []) {
        if (/shield|highway-name/i.test(layer.id)) {
          map.setLayoutProperty(layer.id, 'visibility', 'none')
          continue
        }
        const textField = layer.layout?.['text-field']
        if (Array.isArray(textField) && JSON.stringify(textField).includes('name:nonlatin')) {
          // 지명 라벨을 "영문\n한글" 대신 한글(nonlatin)만 표시하도록 덮어쓴다
          map.setLayoutProperty(layer.id, 'text-field', ['coalesce', ['get', 'name:nonlatin'], ['get', 'name']])
        }
        if (layer.type === 'line' && /^(road|bridge|tunnel)_/.test(layer.id)) {
          const isMotorway = /motorway/.test(layer.id)
          const isYellowRoad = !isMotorway && (/trunk_primary|secondary_tertiary/.test(layer.id) || /^(road|bridge|tunnel)_link(_casing)?$/.test(layer.id))
          if (isMotorway) motorwayLayerIds.push(layer.id)
          if (isYellowRoad) yellowRoadLayerIds.push(layer.id)
          else hideAt5kmLayerIds.push(layer.id)
        }
        if (layer.type === 'fill' && layer.id === 'building') {
          // building-3d는 여기 포함하지 않는다 — 3D on/off 토글이 그 visibility를 독립적으로 관리하는데,
          // 여기 포함시키면 5km 밖으로 나갔다 들어올 때 무조건 'visible'로 되돌려써서 토글 상태를 무시해버린다
          hideAt5kmLayerIds.push(layer.id)
        }
      }

      // 고속도로/국도/간선·보조간선(원래 주황·노란색)을 항상 어두운 회색으로 표시한다
      const DARK_GRAY_ROAD_COLOR = '#cbd5e1'
      const DARK_GRAY_ROAD_CASING_COLOR = '#94a3b8'
      for (const id of [...motorwayLayerIds, ...yellowRoadLayerIds]) {
        const color = /_casing$/.test(id) ? DARK_GRAY_ROAD_CASING_COLOR : DARK_GRAY_ROAD_COLOR
        map.setPaintProperty(id, 'line-color', color)
      }

      // 10초간 지도에 동작이 없으면 도로에 무지개색 LED가 흐르는 듯한 효과를 준다
      const allRoadLayerIds = [...motorwayLayerIds, ...yellowRoadLayerIds]
      const mainRoadLayerIds = allRoadLayerIds.filter((id) => !/_casing$/.test(id))
      const casingRoadLayerIds = allRoadLayerIds.filter((id) => /_casing$/.test(id))

      let rainbowStartTime = 0
      let dashIndex = -1

      const stepRainbow = (timestamp: number) => {
        if (!rainbowStartTime) rainbowStartTime = timestamp
        const elapsed = timestamp - rainbowStartTime
        const hue = ((elapsed / RAINBOW_HUE_CYCLE_MS) * 360) % 360
        for (const id of mainRoadLayerIds) map.setPaintProperty(id, 'line-color', `hsl(${hue}, 90%, 60%)`)
        for (const id of casingRoadLayerIds) map.setPaintProperty(id, 'line-color', `hsl(${hue}, 90%, 40%)`)

        const stepIndex = Math.floor(elapsed / RAINBOW_DASH_STEP_MS) % RAINBOW_DASH_SEQUENCE.length
        if (stepIndex !== dashIndex) {
          dashIndex = stepIndex
          for (const id of mainRoadLayerIds) map.setPaintProperty(id, 'line-dasharray', RAINBOW_DASH_SEQUENCE[dashIndex])
        }

        rainbowFrame = requestAnimationFrame(stepRainbow)
      }

      const startRainbow = () => {
        if (rainbowFrame) return
        rainbowStartTime = 0
        dashIndex = -1
        rainbowFrame = requestAnimationFrame(stepRainbow)
      }

      const stopRainbow = () => {
        if (rainbowFrame) {
          cancelAnimationFrame(rainbowFrame)
          rainbowFrame = null
        }
        for (const id of mainRoadLayerIds) {
          map.setPaintProperty(id, 'line-color', DARK_GRAY_ROAD_COLOR)
          map.setPaintProperty(id, 'line-dasharray', undefined)
        }
        for (const id of casingRoadLayerIds) map.setPaintProperty(id, 'line-color', DARK_GRAY_ROAD_CASING_COLOR)
      }

      const resetIdleTimer = () => {
        stopRainbow()
        if (idleTimer) clearTimeout(idleTimer)
        idleTimer = setTimeout(startRainbow, RAINBOW_IDLE_MS)
      }

      resetIdleTimer()
      map.on('movestart', resetIdleTimer)
      map.on('zoomstart', resetIdleTimer)
      map.getContainer().addEventListener('pointerdown', resetIdleTimer)

      let greenHidden = false
      let midTierHidden = false
      let roadsHidden = false
      const applyZoomDependentStyle = () => {
        const zoom = map.getZoom()
        const shouldHideGreen = zoom <= GREEN_HIDE_MAX_ZOOM
        const shouldHideMidTier = zoom <= MID_ZOOM_MAX
        const shouldHideRoads = zoom <= ROAD_HIDE_MAX_ZOOM

        if (shouldHideGreen !== greenHidden) {
          greenHidden = shouldHideGreen
          const visibility = shouldHideGreen ? 'none' : 'visible'
          for (const id of COLORED_AREA_LAYER_IDS) map.setLayoutProperty(id, 'visibility', visibility)
        }

        if (shouldHideMidTier !== midTierHidden) {
          midTierHidden = shouldHideMidTier
          const visibility = shouldHideMidTier ? 'none' : 'visible'
          for (const id of yellowRoadLayerIds) map.setLayoutProperty(id, 'visibility', visibility)
        }

        if (shouldHideRoads !== roadsHidden) {
          roadsHidden = shouldHideRoads
          const visibility = shouldHideRoads ? 'none' : 'visible'
          for (const id of hideAt5kmLayerIds) map.setLayoutProperty(id, 'visibility', visibility)

          const boundaryPaint = shouldHideRoads ? CITY_BOUNDARY_EMPHASIZED_PAINT : CITY_BOUNDARY_DEFAULT_PAINT
          for (const [prop, value] of Object.entries(boundaryPaint)) {
            map.setPaintProperty(CITY_BOUNDARY_LAYER, prop, value)
          }
        }
      }
      applyZoomDependentStyle()
      map.on('zoom', applyZoomDependentStyle)

      let toggleVisible = false
      const checkBuilding3DToggleVisibility = () => {
        const inRange = map.getZoom() >= BUILDING_3D_MIN_ZOOM
        if (inRange === toggleVisible) return
        toggleVisible = inRange
        setShow3DToggle(inRange)
      }
      checkBuilding3DToggleVisibility()
      map.on('zoom', checkBuilding3DToggleVisibility)

      // 기본값은 3D Off — 입체 대신 평면 건물 채우기를 보여준다
      map.setLayoutProperty('building-3d', 'visibility', 'none')
      map.setLayerZoomRange('building', 13, 24)
    })

    mapRef.current = map

    return () => {
      if (idleTimer) clearTimeout(idleTimer)
      if (rainbowFrame) cancelAnimationFrame(rainbowFrame)
      map.remove()
      mapRef.current = null
    }
  }, [])

  const toggleBuildings3D = () => {
    const map = mapRef.current
    if (!map) return
    const next = !buildings3DOn
    setBuildings3DOn(next)
    if (next) {
      map.setLayoutProperty('building-3d', 'visibility', 'visible')
      map.setLayerZoomRange('building', 13, 14)
    } else {
      // 3D를 끄면 입체 대신 평면 건물 채우기를 계속 보여준다
      map.setLayoutProperty('building-3d', 'visibility', 'none')
      map.setLayerZoomRange('building', 13, 24)
    }
  }

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
          <Fragment key={label}>
            {label === '숨김' && show3DToggle && (
              <button
                onClick={toggleBuildings3D}
                className={`flex w-16 cursor-pointer flex-col items-center gap-1 border-b border-slate-100 px-2 py-3 text-[11px] last:border-b-0 ${
                  buildings3DOn ? 'bg-blue-600 text-white hover:bg-blue-700' : 'text-slate-400 hover:bg-slate-50'
                }`}
              >
                <span className="text-sm font-bold leading-none">3D</span>
                <span className="leading-none">{buildings3DOn ? '(On)' : '(Off)'}</span>
              </button>
            )}
            <button className="flex w-16 cursor-pointer flex-col items-center gap-1 border-b border-slate-100 px-2 py-3 text-[11px] text-slate-500 last:border-b-0 hover:bg-slate-50">
              <span className="text-lg">{icon}</span>
              {label}
            </button>
          </Fragment>
        ))}
      </div>

      {/* chat bubble */}
      <button className="absolute bottom-24 right-4 flex h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-indigo-600 text-lg text-white shadow-xl hover:bg-indigo-700">
        💬
      </button>
    </div>
  )
}
