// public/rail-routes.geojson을 새로 받아온다 (OSM 노선 색상은 거의 안 바뀌므로 자주 돌릴 필요는 없다)
// 실행: node scripts/fetch-rail-routes.mjs
import { writeFileSync } from 'node:fs'

const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
]
// 대한민국 영역 근사 사각형 — src/components/MapView.tsx의 KOREA_BOUNDS와 동일하게 맞춘다
const BOUNDS = { south: 33.0, west: 124.5, north: 38.65, east: 131.95 }
const ROUTE_TYPES = '^(subway|light_rail|tram)$'
const DEFAULT_COLOR = '#6b7280'
const OUTPUT_PATH = new URL('../public/rail-routes.geojson', import.meta.url)

// 수인분당선·경의중앙선·공항철도·GTX처럼 코레일이 운영하는 광역전철은 OSM에서 subway가 아니라
// route=train으로 태깅돼 있어서 위 목록만으로는 통째로 빠진다. 그렇다고 route=train을 전부 받으면
// KTX·SRT·무궁화 같은 도시간 열차까지 딸려오는데, 그런 노선은 ref와 colour가 비어 있는 반면
// 광역전철은 둘 다 갖고 있어서 이 두 태그의 유무로 가른다
// 경계 사각형의 남동쪽 모서리에 규슈(후쿠오카 130.4E/33.6N)가 걸려서, 사각형으로 받으면
// JR 규슈 노선까지 딸려온다. 나라 경계(ISO 3166-1 = KR)로 받아 한국 노선만 남긴다
const query = `[out:json][timeout:180];area["ISO3166-1"="KR"]->.kr;(relation["route"~"${ROUTE_TYPES}"](area.kr);relation["route"="train"]["ref"]["colour"](area.kr););out body;way(r)->.ways;.ways out geom;`

// Overpass는 User-Agent가 없거나 curl 기본값 같은 요청을 봇으로 보고 406으로 막는 경우가 있다.
// 요청마다 이 값을 붙여야 한다(Overpass 사용 정책이 요구하는 부분이기도 하다)
const FETCH_HEADERS = {
  'User-Agent': 'HW-commute-real-estate-app/1.0 (rail route data fetch script)',
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

function toDedupedGeoJSON(elements) {
  const wayGeometryById = new Map()
  const relations = []
  for (const el of elements) {
    if (el.type === 'way' && el.geometry) wayGeometryById.set(el.id, el.geometry)
    else if (el.type === 'relation') relations.push(el)
  }

  // 같은 물리 선로가 계통/방향별로 여러 relation에 중복 소속된 경우가 많아 (way, color) 기준으로 한 번만 남긴다
  const seen = new Map()
  for (const relation of relations) {
    const color = relation.tags?.colour || DEFAULT_COLOR
    const ref = relation.tags?.ref || ''
    for (const member of relation.members ?? []) {
      if (member.type !== 'way') continue
      const key = `${member.ref}:${color}`
      if (seen.has(key)) continue
      const geometry = wayGeometryById.get(member.ref)
      if (!geometry || geometry.length < 2) continue
      seen.set(key, {
        type: 'Feature',
        properties: { color, ref },
        geometry: { type: 'LineString', coordinates: geometry.map((pt) => [Math.round(pt.lon * 1e6) / 1e6, Math.round(pt.lat * 1e6) / 1e6]) },
      })
    }
  }
  return { type: 'FeatureCollection', features: [...seen.values()] }
}

const data = await fetchOverpass()
const geojson = toDedupedGeoJSON(data.elements)
writeFileSync(OUTPUT_PATH, JSON.stringify(geojson))
console.log(`${geojson.features.length}개 구간 저장 완료 → ${OUTPUT_PATH.pathname}`)
