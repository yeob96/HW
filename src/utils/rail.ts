// 지하철 노선/역/출입구 GeoJSON을 지도에 그리기 좋은 형태로 가공한다.
// 순수 함수만 두어 브라우저 없이도 실제 데이터로 검증할 수 있게 분리했다
// (scripts/check-rail-geometry.ts 참고)

// 출입구가 지도 위에 홀로 떠 있으면 무엇의 출구인지 알 수 없어서, 가장 가까운 역과 잇는
// 연결선을 그려 노선에서 뻗어 나온 것처럼 보이게 한다. 이 거리 안에 역이 없는 출입구
// (OSM에 해당 노선이 없는 경우 등)는 연결선 없이 지금처럼 단독으로 표시된다
// 노선 색이 비어 있는 경우의 기본값 — fetch 스크립트의 DEFAULT_COLOR와 같다
const FALLBACK_LINE_COLOR = '#6b7280'
const EXIT_CONNECTOR_MAX_DISTANCE_M = 400
// 가까운 역만 비교하도록 위경도를 이 크기(약 1.1km)의 격자로 나눠 색인한다 —
// 연결 반경보다 넉넉히 커서 인접 3x3 칸만 보면 후보를 놓치지 않는다
const STATION_GRID_DEG = 0.01
// 역은 노선 위에 얹힌 굵은 막대(승강장)로 표시한다. 역 중심에서 이 거리 안에서
// 해당 호선의 선형을 찾아 그 위에 막대를 올린다
const PLATFORM_ANCHOR_MAX_DISTANCE_M = 300
// 막대 길이의 절반 — 실제 지하철 승강장(약 200m)에 맞췄다
const PLATFORM_HALF_LENGTH_M = 100

export type Coordinate = [lon: number, lat: number]

export interface RailStationFeatureProperties {
  kind: 'badge' | 'label' | 'exit' | 'connector' | 'platform'
  ref?: string
  color?: string
  name?: string
  offset?: [number, number]
}

interface StationPoint {
  lon: number
  lat: number
  color: string
}

// 위경도 차이를 미터로 환산한다 — 한 역 주변(수백 m)만 다루므로 평면 근사로 충분하다
function approxDistanceMeters(aLon: number, aLat: number, bLon: number, bLat: number): number {
  const EARTH_RADIUS_M = 6371000
  const toRad = Math.PI / 180
  const midLat = ((aLat + bLat) / 2) * toRad
  const dx = (aLon - bLon) * Math.cos(midLat) * toRad * EARTH_RADIUS_M
  const dy = (aLat - bLat) * toRad * EARTH_RADIUS_M
  return Math.hypot(dx, dy)
}

const gridKey = (lon: number, lat: number) => `${Math.floor(lon / STATION_GRID_DEG)},${Math.floor(lat / STATION_GRID_DEG)}`

// 각 출입구를 가장 가까운 역과 잇는 선 feature를 만든다.
// 색은 그 역의 첫 번째 호선 색을 쓴다 — 환승역은 출입구가 어느 호선 소속인지 OSM 태그에
// 없어서 호선별로 나눌 수 없고, 어느 역의 출구인지만 드러나면 목적은 달성된다
export function buildExitConnectors(features: GeoJSON.Feature[]): GeoJSON.Feature[] {
  const grid = new Map<string, StationPoint[]>()
  for (const feature of features) {
    const props = feature.properties as RailStationFeatureProperties
    if (props.kind !== 'badge' || feature.geometry.type !== 'Point') continue
    const [lon, lat] = feature.geometry.coordinates
    const key = gridKey(lon, lat)
    const cell = grid.get(key)
    // 환승역은 같은 좌표에 배지가 여러 개다 — 첫 번째(=첫 호선 색)만 남긴다
    if (cell) {
      if (!cell.some((s) => s.lon === lon && s.lat === lat)) cell.push({ lon, lat, color: props.color ?? FALLBACK_LINE_COLOR })
    } else {
      grid.set(key, [{ lon, lat, color: props.color ?? FALLBACK_LINE_COLOR }])
    }
  }

  const connectors: GeoJSON.Feature[] = []
  for (const feature of features) {
    const props = feature.properties as RailStationFeatureProperties
    if (props.kind !== 'exit' || feature.geometry.type !== 'Point') continue
    const [lon, lat] = feature.geometry.coordinates

    let nearest: StationPoint | null = null
    let nearestDistance = EXIT_CONNECTOR_MAX_DISTANCE_M
    const cx = Math.floor(lon / STATION_GRID_DEG)
    const cy = Math.floor(lat / STATION_GRID_DEG)
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const station of grid.get(`${cx + dx},${cy + dy}`) ?? []) {
          const distance = approxDistanceMeters(lon, lat, station.lon, station.lat)
          if (distance < nearestDistance) {
            nearestDistance = distance
            nearest = station
          }
        }
      }
    }
    if (!nearest) continue

    connectors.push({
      type: 'Feature',
      properties: { kind: 'connector', color: nearest.color },
      geometry: { type: 'LineString', coordinates: [[nearest.lon, nearest.lat], [lon, lat]] },
    })
  }
  return connectors
}

interface RouteLine {
  ref: string
  color: string
  coordinates: Coordinate[]
  // [서, 남, 동, 북] — 역 주변에 없는 노선을 투영 계산 전에 걸러내기 위한 사각형
  bounds: [number, number, number, number]
}

interface PolylineAnchor {
  distance: number
  index: number // 이 꼭짓점과 다음 꼭짓점 사이의 선분
  t: number // 그 선분에서의 위치(0~1)
}

// 점에서 폴리라인까지 가장 가까운 지점을 찾는다. 노선 좌표는 꼭짓점 간격이 최대 2km까지
// 벌어져 있어서 가장 가까운 "꼭짓점"을 고르면 크게 빗나간다 — 선분에 수직으로 투영해야 한다.
// 역 주변 수백 m만 다루므로 위경도를 미터로 바꾼 평면에서 계산한다
function projectOntoPolyline(lon: number, lat: number, coordinates: Coordinate[]): PolylineAnchor | null {
  if (coordinates.length < 2) return null
  const metersPerDegLat = 111320
  const metersPerDegLon = 111320 * Math.cos(lat * (Math.PI / 180))

  let best: PolylineAnchor | null = null
  for (let i = 0; i + 1 < coordinates.length; i++) {
    const ax = (coordinates[i][0] - lon) * metersPerDegLon
    const ay = (coordinates[i][1] - lat) * metersPerDegLat
    const bx = (coordinates[i + 1][0] - lon) * metersPerDegLon
    const by = (coordinates[i + 1][1] - lat) * metersPerDegLat
    const dx = bx - ax
    const dy = by - ay
    const lengthSq = dx * dx + dy * dy
    // 선분 밖으로 나가지 않도록 0~1로 자른다 (양 끝점 너머는 끝점이 가장 가깝다)
    const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSq))
    const distance = Math.hypot(ax + t * dx, ay + t * dy)
    if (!best || distance < best.distance) best = { distance, index: i, t }
  }
  return best
}

const interpolate = (from: Coordinate, to: Coordinate, ratio: number): Coordinate => [
  from[0] + (to[0] - from[0]) * ratio,
  from[1] + (to[1] - from[1]) * ratio,
]

// anchor 지점에서 노선을 따라 앞뒤로 halfLength 미터씩 걸어가며 좌표를 모은다.
// 선형을 그대로 따라가므로 막대는 언제나 노선 위에 정확히 얹힌다
function sliceAroundAnchor(coordinates: Coordinate[], anchor: PolylineAnchor, halfLengthM: number): Coordinate[] {
  const origin = interpolate(coordinates[anchor.index], coordinates[anchor.index + 1], anchor.t)

  const walk = (step: -1 | 1): Coordinate[] => {
    const collected: Coordinate[] = []
    let current = origin
    let remaining = halfLengthM
    // 뒤로 갈 때는 anchor가 놓인 선분의 시작점부터, 앞으로 갈 때는 끝점부터 훑는다
    for (let i = step === -1 ? anchor.index : anchor.index + 1; i >= 0 && i < coordinates.length && remaining > 0; i += step) {
      const next = coordinates[i]
      const segmentLength = approxDistanceMeters(current[0], current[1], next[0], next[1])
      if (segmentLength <= remaining) {
        collected.push(next)
        remaining -= segmentLength
        current = next
      } else {
        // 남은 길이만큼만 선분 중간에서 끊는다
        collected.push(interpolate(current, next, remaining / segmentLength))
        remaining = 0
      }
    }
    return collected
  }

  return [...walk(-1).reverse(), origin, ...walk(1)]
}

const endpointKey = (coordinate: Coordinate) => `${coordinate[0]},${coordinate[1]}`

const boundsOf = (coordinates: Coordinate[]): [number, number, number, number] => {
  let west = Infinity
  let south = Infinity
  let east = -Infinity
  let north = -Infinity
  for (const [lon, lat] of coordinates) {
    if (lon < west) west = lon
    if (lon > east) east = lon
    if (lat < south) south = lat
    if (lat > north) north = lat
  }
  return [west, south, east, north]
}

// 노선은 짧은 조각(길이 중앙값 340m) 여러 개로 나뉘어 들어온다. 조각을 그대로 두면
// 역이 조각 끝부분에 걸렸을 때 막대가 200m를 못 채우고 잘린다. 조각들의 끝점은 91%가
// 정확히 일치하므로, 끝점이 맞물리는 조각끼리 이어 붙여 긴 선으로 만든다
function stitchRouteLines(lines: RouteLine[]): RouteLine[] {
  const byEndpoint = new Map<string, number[]>()
  lines.forEach((line, index) => {
    for (const coordinate of [line.coordinates[0], line.coordinates[line.coordinates.length - 1]]) {
      const key = endpointKey(coordinate)
      const bucket = byEndpoint.get(key)
      if (bucket) bucket.push(index)
      else byEndpoint.set(key, [index])
    }
  })

  const used = new Array<boolean>(lines.length).fill(false)
  const stitched: RouteLine[] = []

  for (let seed = 0; seed < lines.length; seed++) {
    if (used[seed]) continue
    used[seed] = true
    let coordinates = [...lines[seed].coordinates]

    // 꼬리 쪽으로 이어붙이고, 그 다음 머리 쪽으로 이어붙인다
    for (const atTail of [true, false]) {
      for (;;) {
        const end = atTail ? coordinates[coordinates.length - 1] : coordinates[0]
        const candidates = byEndpoint.get(endpointKey(end)) ?? []
        const nextIndex = candidates.find((i) => !used[i])
        if (nextIndex === undefined) break
        used[nextIndex] = true

        const next = lines[nextIndex].coordinates
        // 맞물리는 쪽이 조각의 끝점이면 뒤집어서 방향을 맞춘다
        const forward = endpointKey(next[0]) === endpointKey(end)
        const ordered = forward ? next : [...next].reverse()
        // 맞물린 좌표가 두 번 들어가지 않게 첫 점은 뺀다
        if (atTail) coordinates = [...coordinates, ...ordered.slice(1)]
        else coordinates = [...[...ordered].reverse().slice(0, -1), ...coordinates]
      }
    }

    stitched.push({ ref: lines[seed].ref, color: lines[seed].color, coordinates, bounds: boundsOf(coordinates) })
  }
  return stitched
}

// 역마다 호선별로 노선 위에 얹을 막대(승강장) feature를 만든다.
// 호선은 ref로 맞추고, ref가 비어 있는 일부 노선(공항 셔틀트레인 등)은 색으로 보완한다
export function buildStationPlatforms(stationFeatures: GeoJSON.Feature[], routeFeatures: GeoJSON.Feature[]): GeoJSON.Feature[] {
  // 같은 호선(ref+색)끼리 모아 조각을 이어 붙인 뒤, ref와 색으로 각각 찾을 수 있게 색인한다
  const groups = new Map<string, RouteLine[]>()
  for (const feature of routeFeatures) {
    if (feature.geometry.type !== 'LineString') continue
    const { ref, color } = (feature.properties ?? {}) as { ref?: string; color?: string }
    if (!color || feature.geometry.coordinates.length < 2) continue
    const coordinates = feature.geometry.coordinates as Coordinate[]
    const line: RouteLine = { ref: ref ?? '', color, coordinates, bounds: boundsOf(coordinates) }
    const key = `${line.ref}|${color}`
    const group = groups.get(key)
    if (group) group.push(line)
    else groups.set(key, [line])
  }

  const byRef = new Map<string, RouteLine[]>()
  const byColor = new Map<string, RouteLine[]>()
  for (const group of groups.values()) {
    for (const line of stitchRouteLines(group)) {
      if (line.ref) {
        const bucket = byRef.get(line.ref)
        if (bucket) bucket.push(line)
        else byRef.set(line.ref, [line])
      }
      const colorBucket = byColor.get(line.color)
      if (colorBucket) colorBucket.push(line)
      else byColor.set(line.color, [line])
    }
  }

  // 역 좌표별로 그 역을 지나는 호선 목록을 모은다 (환승역은 배지가 여러 개)
  const stations = new Map<string, { lon: number; lat: number; lines: { ref: string; color: string }[] }>()
  for (const feature of stationFeatures) {
    const props = feature.properties as RailStationFeatureProperties
    if (props.kind !== 'badge' || feature.geometry.type !== 'Point') continue
    const [lon, lat] = feature.geometry.coordinates
    const key = `${lon},${lat}`
    const station = stations.get(key)
    if (station) station.lines.push({ ref: props.ref ?? '', color: props.color ?? '' })
    else stations.set(key, { lon, lat, lines: [{ ref: props.ref ?? '', color: props.color ?? '' }] })
  }

  const platforms: GeoJSON.Feature[] = []
  for (const station of stations.values()) {
    const latitudeMargin = PLATFORM_ANCHOR_MAX_DISTANCE_M / 111320
    const longitudeMargin = latitudeMargin / Math.max(Math.cos(station.lat * (Math.PI / 180)), 0.01)

    for (const line of station.lines) {
      // ref로 찾고, 그래도 없으면 같은 색 노선에서 찾는다
      const candidateSets = [byRef.get(line.ref), byColor.get(line.color)]
      let bestLine: RouteLine | null = null
      let bestAnchor: PolylineAnchor | null = null

      for (const candidates of candidateSets) {
        for (const candidate of candidates ?? []) {
          const [west, south, east, north] = candidate.bounds
          if (
            station.lon < west - longitudeMargin ||
            station.lon > east + longitudeMargin ||
            station.lat < south - latitudeMargin ||
            station.lat > north + latitudeMargin
          ) {
            continue
          }
          const anchor = projectOntoPolyline(station.lon, station.lat, candidate.coordinates)
          if (!anchor || anchor.distance > PLATFORM_ANCHOR_MAX_DISTANCE_M) continue
          if (!bestAnchor || anchor.distance < bestAnchor.distance) {
            bestAnchor = anchor
            bestLine = candidate
          }
        }
        // ref로 이미 찾았으면 색으로 또 찾지 않는다 (같은 막대가 겹쳐 그려지는 것을 막는다)
        if (bestAnchor) break
      }

      if (!bestLine || !bestAnchor) continue
      platforms.push({
        type: 'Feature',
        properties: { kind: 'platform', color: line.color },
        geometry: { type: 'LineString', coordinates: sliceAroundAnchor(bestLine.coordinates, bestAnchor, PLATFORM_HALF_LENGTH_M) },
      })
    }
  }
  return platforms
}

