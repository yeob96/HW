// public/rail-stations.geojson을 새로 받아온다 — 역(호선 배지+이름)과 출입구(번호)
// 실행: node scripts/fetch-rail-stations.mjs
import { writeFileSync } from 'node:fs'

const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
]
// src/components/MapView.tsx의 KOREA_BOUNDS와 동일
const BOUNDS = { south: 33.0, west: 124.5, north: 38.65, east: 131.95 }
const ROUTE_TYPES = '^(subway|light_rail|tram)$'
const DEFAULT_COLOR = '#6b7280'
// 역 이름이 같아도 도시가 다르면(예: 여러 도시의 "중앙역") 같은 역으로 합치지 않도록,
// 이 거리(도 단위, 약 800m) 안에 있을 때만 같은 역으로 묶는다
const CLUSTER_RADIUS_DEG = 0.008
const BADGE_SPACING_PX = 20
const OUTPUT_PATH = new URL('../public/rail-stations.geojson', import.meta.url)

const query = `[out:json][timeout:180];relation["route"~"${ROUTE_TYPES}"](${BOUNDS.south},${BOUNDS.west},${BOUNDS.north},${BOUNDS.east})->.routes;.routes out body;node(r.routes)->.stopnodes;.stopnodes out body;node["railway"="subway_entrance"](${BOUNDS.south},${BOUNDS.west},${BOUNDS.north},${BOUNDS.east})->.entrances;.entrances out body;`

// Overpass는 User-Agent가 없거나 curl 기본값 같은 요청을 봇으로 보고 406으로 막는 경우가 있다.
// 요청마다 이 값을 붙여야 한다(Overpass 사용 정책이 요구하는 부분이기도 하다)
const FETCH_HEADERS = {
  'User-Agent': 'HW-commute-real-estate-app/1.0 (rail station data fetch script)',
  'Content-Type': 'text/plain',
  Accept: 'application/json',
}
const RETRY_DELAY_MS = 15000

async function fetchOnce(url) {
  const res = await fetch(url, { method: 'POST', headers: FETCH_HEADERS, body: query })
  if (res.status === 429) {
    console.warn(`  429 (사용량 초과) — ${RETRY_DELAY_MS / 1000}초 후 한 번 더 시도`)
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS))
    const retry = await fetch(url, { method: 'POST', headers: FETCH_HEADERS, body: query })
    if (!retry.ok) throw new Error(`HTTP ${retry.status}`)
    return retry.json()
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

async function fetchOverpass() {
  for (const url of OVERPASS_URLS) {
    try {
      console.log(`Trying ${url} ...`)
      return await fetchOnce(url)
    } catch (err) {
      console.warn(`  failed: ${err.message}`)
    }
  }
  throw new Error('모든 Overpass 미러가 실패했습니다')
}

const STOP_ROLES = new Set(['stop', 'stop_entry_only', 'stop_exit_only'])

function buildStationClusters(elements) {
  const nodesById = new Map()
  const relations = []
  for (const el of elements) {
    if (el.type === 'node') nodesById.set(el.id, el)
    else if (el.type === 'relation') relations.push(el)
  }

  // clusters: [{ name, lat, lon, count, lines: Map<ref, color> }]
  const clusters = []
  for (const relation of relations) {
    const color = relation.tags?.colour || DEFAULT_COLOR
    const ref = relation.tags?.ref || relation.tags?.name || ''
    for (const member of relation.members ?? []) {
      if (member.type !== 'node' || !STOP_ROLES.has(member.role)) continue
      const node = nodesById.get(member.ref)
      const name = node?.tags?.['name:ko'] || node?.tags?.name
      if (!node || !name) continue

      let cluster = clusters.find((c) => c.name === name && Math.hypot(c.lat - node.lat, c.lon - node.lon) < CLUSTER_RADIUS_DEG)
      if (!cluster) {
        cluster = { name, lat: node.lat, lon: node.lon, count: 0, lines: new Map() }
        clusters.push(cluster)
      }
      // 누적 평균으로 중심 좌표를 갱신한다 (플랫폼마다 좌표가 조금씩 다르므로)
      cluster.lat = (cluster.lat * cluster.count + node.lat) / (cluster.count + 1)
      cluster.lon = (cluster.lon * cluster.count + node.lon) / (cluster.count + 1)
      cluster.count += 1
      if (!cluster.lines.has(ref)) cluster.lines.set(ref, color)
    }
  }
  return clusters
}

function clustersToFeatures(clusters) {
  const features = []
  for (const cluster of clusters) {
    const lines = [...cluster.lines.entries()] // [ref, color][]
    const n = lines.length
    lines.forEach(([ref, color], i) => {
      features.push({
        type: 'Feature',
        properties: {
          kind: 'badge',
          ref,
          color,
          offset: [(i - (n - 1) / 2) * BADGE_SPACING_PX, 0],
        },
        geometry: { type: 'Point', coordinates: [cluster.lon, cluster.lat] },
      })
    })
    features.push({
      type: 'Feature',
      properties: { kind: 'label', name: cluster.name },
      geometry: { type: 'Point', coordinates: [cluster.lon, cluster.lat] },
    })
  }
  return features
}

function entrancesToFeatures(elements) {
  const features = []
  for (const el of elements) {
    if (el.type !== 'node' || el.tags?.railway !== 'subway_entrance') continue
    const ref = el.tags?.ref
    if (!ref) continue
    features.push({
      type: 'Feature',
      properties: { kind: 'exit', ref },
      geometry: { type: 'Point', coordinates: [el.lon, el.lat] },
    })
  }
  return features
}

const data = await fetchOverpass()
const clusters = buildStationClusters(data.elements)
const features = [...clustersToFeatures(clusters), ...entrancesToFeatures(data.elements)]
const geojson = { type: 'FeatureCollection', features }
writeFileSync(OUTPUT_PATH, JSON.stringify(geojson))
console.log(`역 ${clusters.length}개, 출입구 ${features.filter((f) => f.properties.kind === 'exit').length}개 저장 완료 → ${OUTPUT_PATH.pathname}`)
