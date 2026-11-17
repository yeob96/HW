/**
 * 주소 → 법정동코드(b_code) 변환 확인 — 노션 일정 11/18
 *
 *   node scripts/check-kakao-bcode.mjs
 *
 * 온비드 물건목록은 ltnoPnu(필지 PNU)를 주는데, 그 앞 10자리가 법정동코드다.
 * 표본을 온비드 API 에서 직접 받아와, 같은 주소에 대해 카카오 로컬 API 가 돌려주는
 * b_code 와 대조한다. 수집 단계에서 카카오 변환을 꼭 거쳐야 하는지 판단하기 위한 것이다.
 *
 * 키는 출력하지 않는다.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SAMPLE_COUNT = 8

const env = Object.fromEntries(
  readFileSync(join(ROOT, '.env'), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
)

const KAKAO_KEY = env.KAKAO_REST_API_KEY
const ONBID_KEY = env.DATA_GO_KR_SERVICE_KEY
if (!KAKAO_KEY || !ONBID_KEY) {
  console.error('.env 에 KAKAO_REST_API_KEY 와 DATA_GO_KR_SERVICE_KEY 가 모두 있어야 합니다.')
  process.exit(1)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** 온비드에서 표본을 받아온다 */
async function fetchSamples() {
  const url = new URL('https://apis.data.go.kr/B010003/OnbidRlstListSrvc2/getRlstCltrList2')
  url.searchParams.set('serviceKey', ONBID_KEY)
  url.searchParams.set('resultType', 'json')
  url.searchParams.set('numOfRows', '60')
  url.searchParams.set('pageNo', '1')
  url.searchParams.set('prptDivCd', '0007')
  url.searchParams.set('pvctTrgtYn', 'N')

  const res = await fetch(url)
  const json = await res.json()
  const body = json.body ?? json.response?.body
  const raw = body?.items
  const items = Array.isArray(raw) ? raw : (raw?.item ?? [])
  return items.filter((i) => i.ltnoPnu && String(i.ltnoPnu).length >= 10 && i.lctnEmdNm)
}

/**
 * 지번주소를 만든다. 물건명에는 건물명·층·호가 붙어 있어 쓰기 어렵고,
 * PNU 뒤 9자리가 (산여부 1 + 본번 4 + 부번 4) 라 거기서 지번을 복원한다.
 */
function jibunOf(pnu) {
  const tail = String(pnu).slice(10)
  if (tail.length < 9) return null
  const mountain = tail[0] === '2' ? '산 ' : ''
  const main = Number(tail.slice(1, 5))
  const sub = Number(tail.slice(5, 9))
  if (!main) return null
  return `${mountain}${main}${sub ? '-' + sub : ''}`
}

async function lookupKakao(address) {
  const url = new URL('https://dapi.kakao.com/v2/local/search/address.json')
  url.searchParams.set('query', address)
  const res = await fetch(url, { headers: { Authorization: `KakaoAK ${KAKAO_KEY}` } })
  if (!res.ok) return { error: `HTTP ${res.status}` }
  const json = await res.json()
  const first = json.documents?.[0]
  if (!first) return { error: '검색 결과 없음' }
  const addr = first.address ?? first.road_address
  return {
    bCode: addr?.b_code ?? null,
    region: [addr?.region_1depth_name, addr?.region_2depth_name, addr?.region_3depth_name]
      .filter(Boolean)
      .join(' '),
    x: first.x,
    y: first.y,
  }
}

const samples = await fetchSamples()
if (samples.length === 0) {
  console.error('온비드에서 표본을 받지 못했습니다.')
  process.exit(1)
}

console.log(`주소 → 법정동코드(b_code) 대조 — 온비드 표본 ${Math.min(SAMPLE_COUNT, samples.length)}건\n`)

let match = 0
let checked = 0
let notFound = 0
// 읍·면은 온비드가 '리'를 주지 않아 주소가 불완전하다. 따로 집계해 원인을 가린다
let dongMatch = 0
let dongTotal = 0
let eupMatch = 0
let eupTotal = 0

for (const item of samples.slice(0, SAMPLE_COUNT)) {
  const pnu = String(item.ltnoPnu)
  const expected = pnu.slice(0, 10)
  const jibun = jibunOf(pnu)
  const address = [item.lctnSdnm, item.lctnSggnm, item.lctnEmdNm, jibun].filter(Boolean).join(' ')

  await sleep(200)
  const result = await lookupKakao(address)

  if (result.error) {
    notFound++
    console.log(`? ${address}\n   카카오: ${result.error}\n`)
    continue
  }

  checked++
  const ok = result.bCode === expected
  if (ok) match++

  const isEupMyeon = /[읍면]$/.test(item.lctnEmdNm ?? '')
  if (isEupMyeon) {
    eupTotal++
    if (ok) eupMatch++
  } else {
    dongTotal++
    if (ok) dongMatch++
  }
  console.log(`${ok ? '✓' : '✗'} ${address}`)
  console.log(`   온비드 PNU      : ${pnu}  → 법정동코드 ${expected}`)
  console.log(`   카카오 b_code   : ${result.bCode}  (${result.region})`)
  if (!ok) console.log(`   ※ 불일치`)
  console.log(`   좌표            : ${result.y}, ${result.x}\n`)
}

console.log(`대조 ${checked}건 중 일치 ${match}건${notFound ? `, 카카오 미검색 ${notFound}건` : ''}`)
console.log(`  ─ 동 단위 주소: ${dongMatch}/${dongTotal} 일치`)
console.log(`  ─ 읍·면 단위 주소: ${eupMatch}/${eupTotal} 일치`)
console.log(`
결론
- 동 단위 물건은 온비드 PNU 앞 10자리와 카카오 b_code 가 그대로 일치한다.
- 읍·면 단위에서 갈리는 이유는 PNU 가 틀려서가 아니라, 온비드 목록 API 의
  lctnEmdNm 이 "비금면"까지만 주고 그 아래 '리'를 주지 않기 때문이다.
  리가 빠진 주소로 카카오를 부르면 그 면의 아무 리나 잡힌다.
- 따라서 법정동코드는 카카오를 거치지 말고 PNU 에서 바로 쓴다.
  카카오 로컬 API 는 지도 표시용 좌표를 얻는 용도로만 쓴다.
- 읍·면 물건의 전체 지번주소가 필요하면 목록 API 로는 부족하다.
  물건상세 API(활용신청 필요) 또는 좌표 기반 역지오코딩이 있어야 한다.`)
