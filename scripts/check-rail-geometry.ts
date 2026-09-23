// src/utils/rail.ts의 실제 함수를 그대로 불러 public/의 실제 데이터로 검증한다.
// 지도를 띄우지 않고 좌표 계산이 맞는지 확인하는 용도다.
// 실행: node scripts/check-rail-geometry.ts
import { readFileSync } from 'node:fs'
import { buildExitConnectors, buildStationPlatforms } from '../src/utils/rail.ts'

const EXIT_CONNECTOR_MAX_DISTANCE_M = 400 // rail.ts와 같은 값
const PLATFORM_ANCHOR_MAX_DISTANCE_M = 300
const PLATFORM_HALF_LENGTH_M = 100

function meters(aLon: number, aLat: number, bLon: number, bLat: number): number {
  const R = 6371000
  const toRad = Math.PI / 180
  const midLat = ((aLat + bLat) / 2) * toRad
  return Math.hypot((aLon - bLon) * Math.cos(midLat) * toRad * R, (aLat - bLat) * toRad * R)
}

const lineLength = (coordinates: number[][]): number => {
  let total = 0
  for (let i = 1; i < coordinates.length; i++) {
    total += meters(coordinates[i - 1][0], coordinates[i - 1][1], coordinates[i][0], coordinates[i][1])
  }
  return total
}

const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
const stations = read('../public/rail-stations.geojson')
const routes = read('../public/rail-routes.geojson')

const badges = stations.features.filter((f: any) => f.properties.kind === 'badge')
const exits = stations.features.filter((f: any) => f.properties.kind === 'exit')

let failures = 0
const check = (label: string, ok: boolean, detail: string) => {
  console.log(`  ${ok ? 'OK  ' : 'FAIL'}  ${label}: ${detail}`)
  if (!ok) failures++
}

// ---------- 출입구 연결선 ----------
console.log(`\n[출입구 연결선]  출입구 ${exits.length}개, 역 ${badges.length}개 배지`)
let t0 = performance.now()
const connectors = buildExitConnectors(stations.features)
const connectorMs = performance.now() - t0

// brute-force로 같은 답이 나오는지 (격자 색인이 후보를 놓치지 않는지)
const stationPoints = [...new Map(badges.map((b: any) => [b.geometry.coordinates.join(','), b.properties.color])).keys()].map((k: any) => k.split(',').map(Number))
let bruteCount = 0
for (const e of exits) {
  const [lon, lat] = e.geometry.coordinates
  let best = EXIT_CONNECTOR_MAX_DISTANCE_M
  for (const [sLon, sLat] of stationPoints) {
    const d = meters(lon, lat, sLon, sLat)
    if (d < best) best = d
  }
  if (best < EXIT_CONNECTOR_MAX_DISTANCE_M) bruteCount++
}
check('격자 색인 = brute-force', connectors.length === bruteCount, `${connectors.length}개 vs ${bruteCount}개`)

const overLength = connectors.filter((c: any) => lineLength(c.geometry.coordinates) > EXIT_CONNECTOR_MAX_DISTANCE_M + 0.5)
check('모든 연결선이 반경 이내', overLength.length === 0, `초과 ${overLength.length}개`)
check('연결선마다 색이 있음', connectors.every((c: any) => /^#[0-9a-f]{6}$/i.test(c.properties.color)), `${new Set(connectors.map((c: any) => c.properties.color)).size}가지 색`)
console.log(`  (${connectors.length}/${exits.length}개 연결, ${Math.round(connectorMs)}ms)`)

// ---------- 역 막대 ----------
console.log(`\n[역 막대]`)
t0 = performance.now()
const platforms = buildStationPlatforms(stations.features, routes.features)
const platformMs = performance.now() - t0

check('배지 수를 넘지 않음', platforms.length <= badges.length, `막대 ${platforms.length}개 / 배지 ${badges.length}개`)

const lengths = platforms.map((p: any) => lineLength(p.geometry.coordinates)).sort((a: number, b: number) => a - b)
const target = PLATFORM_HALF_LENGTH_M * 2
// 막대는 선형을 따라 걷지 않고 곧게 뻗으므로 모두 정확히 목표 길이여야 한다
check('목표 길이를 넘지 않음', lengths[lengths.length - 1] <= target + 1, `최대 ${Math.round(lengths[lengths.length - 1])}m (목표 ${target}m)`)
// 목표보다 짧은 막대는 노선이 그 지점에서 끝나는 경우(종착역 등)뿐이어야 한다
const routeEndpoints = new Set<string>()
for (const f of routes.features) {
  if (f.geometry.type !== 'LineString') continue
  const c = f.geometry.coordinates
  routeEndpoints.add(c[0].join(','))
  routeEndpoints.add(c[c.length - 1].join(','))
}
const shortBars = (platforms as any[]).filter((p) => lineLength(p.geometry.coordinates) < target - 1)
const shortNotAtEnd = shortBars.filter((p) => {
  const c = p.geometry.coordinates
  return !routeEndpoints.has(c[0].join(',')) && !routeEndpoints.has(c[c.length - 1].join(','))
})
check('짧은 막대는 노선 끝에서만', shortNotAtEnd.length === 0, `짧은 막대 ${shortBars.length}개 중 노선 끝이 아닌 것 ${shortNotAtEnd.length}개`)

// 각 막대가 자기 역 근처에 붙어 있는지 — 막대 위 아무 점이나 역에서 반경 안이어야 한다
const stationsByColor = new Map<string, number[][]>()
for (const b of badges) {
  const list = stationsByColor.get(b.properties.color) ?? []
  list.push(b.geometry.coordinates)
  stationsByColor.set(b.properties.color, list)
}
let detached = 0
for (const p of platforms as any[]) {
  const nearby = stationsByColor.get(p.properties.color) ?? []
  const anyClose = p.geometry.coordinates.some(([lon, lat]: number[]) =>
    nearby.some(([sLon, sLat]) => meters(lon, lat, sLon, sLat) <= PLATFORM_ANCHOR_MAX_DISTANCE_M + PLATFORM_HALF_LENGTH_M + 1),
  )
  if (!anyClose) detached++
}
check('막대가 자기 역에 붙어 있음', detached === 0, `떨어진 막대 ${detached}개`)

const routeColors = new Set(routes.features.map((f: any) => f.properties.color))
check('막대 색이 실제 노선 색', platforms.every((p: any) => routeColors.has(p.properties.color)), `${new Set(platforms.map((p: any) => p.properties.color)).size}가지 색`)

// 막대는 곧게 뻗으므로 선로가 휜 구간에서는 그려진 노선을 벗어날 수 있다.
// 막대 끝점이 같은 색 노선에서 얼마나 떨어지는지 재서, 눈에 띄게 벗어나지 않는지 본다
interface CheckRoute {
  coordinates: number[][]
  bounds: [number, number, number, number]
}
const routesByColor = new Map<string, CheckRoute[]>()
for (const f of routes.features) {
  if (f.geometry.type !== 'LineString') continue
  const coordinates = f.geometry.coordinates as number[][]
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
  const list = routesByColor.get(f.properties.color) ?? []
  list.push({ coordinates, bounds: [west, south, east, north] })
  routesByColor.set(f.properties.color, list)
}
const pointToPolyline = (lon: number, lat: number, coordinates: number[][]): number => {
  const mLat = 111320
  const mLon = 111320 * Math.cos(lat * (Math.PI / 180))
  let best = Infinity
  for (let i = 0; i + 1 < coordinates.length; i++) {
    const ax = (coordinates[i][0] - lon) * mLon
    const ay = (coordinates[i][1] - lat) * mLat
    const bx = (coordinates[i + 1][0] - lon) * mLon
    const by = (coordinates[i + 1][1] - lat) * mLat
    const dx = bx - ax
    const dy = by - ay
    const lengthSq = dx * dx + dy * dy
    const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSq))
    const d = Math.hypot(ax + t * dx, ay + t * dy)
    if (d < best) best = d
  }
  return best
}
const deviations: number[] = []
for (const p of platforms as any[]) {
  const candidates = routesByColor.get(p.properties.color) ?? []
  for (const [lon, lat] of p.geometry.coordinates) {
    let best = Infinity
    // 0.01도(약 1.1km) 여유를 둔 bbox 안에 있는 노선만 실제로 잰다
    const margin = 0.01
    for (const { coordinates, bounds } of candidates) {
      const [west, south, east, north] = bounds
      if (lon < west - margin || lon > east + margin || lat < south - margin || lat > north + margin) continue
      const d = pointToPolyline(lon, lat, coordinates)
      if (d < best) best = d
    }
    if (best < Infinity) deviations.push(best)
  }
}
deviations.sort((a, b) => a - b)
const p99 = deviations[Math.floor(deviations.length * 0.99)]
check('막대 끝이 노선 위에 붙어 있음', p99 < 10, `끝점 이탈 중앙값 ${deviations[deviations.length >> 1].toFixed(1)}m, 99% ${p99.toFixed(1)}m, 최대 ${deviations[deviations.length - 1].toFixed(1)}m`)
console.log(`  (${platforms.length}개 생성, ${Math.round(platformMs)}ms)`)

// ---------- 잠실역 (사용자가 준 레퍼런스 이미지) ----------
console.log(`\n[잠실역]`)
const jamsil = stations.features.find((f: any) => f.properties.kind === 'label' && f.properties.name === '잠실')
const [jLon, jLat] = jamsil.geometry.coordinates
const jamsilBadges = badges.filter((b: any) => b.geometry.coordinates.join() === jamsil.geometry.coordinates.join())
console.log(`  호선: ${jamsilBadges.map((b: any) => `${b.properties.ref}(${b.properties.color})`).join(', ')}`)

const jamsilPlatforms = (platforms as any[]).filter((p: any) =>
  p.geometry.coordinates.some(([lon, lat]: number[]) => meters(lon, lat, jLon, jLat) < 250),
)
check('호선마다 막대 하나씩', jamsilPlatforms.length === jamsilBadges.length, `막대 ${jamsilPlatforms.length}개 / 호선 ${jamsilBadges.length}개`)
for (const p of jamsilPlatforms) {
  const c = p.geometry.coordinates
  const [aLon, aLat] = c[0]
  const [bLon, bLat] = c[c.length - 1]
  // 막대가 뻗은 방향 (0=북, 90=동)
  const bearing = Math.round((Math.atan2((bLon - aLon) * Math.cos(jLat * (Math.PI / 180)), bLat - aLat) * 180) / Math.PI)
  console.log(`  ${p.properties.color}  길이 ${Math.round(lineLength(c))}m  방위 ${((bearing % 180) + 180) % 180}도  좌표점 ${c.length}개`)
}
const jamsilColors = new Set(jamsilPlatforms.map((p: any) => p.properties.color))
check('2호선/8호선 색이 각각 나옴', jamsilColors.size === 2, [...jamsilColors].join(', '))

console.log(`\n${failures === 0 ? '전부 통과' : failures + '건 실패'}`)
process.exit(failures === 0 ? 0 : 1)
