/**
 * 온비드 OpenAPI 5종 응답 샘플 수집 — 노션 일정 11/17 "온비드 API 5종 응답 샘플 저장"
 *
 *   node scripts/fetch-onbid-samples.mjs
 *
 * .env 의 DATA_GO_KR_SERVICE_KEY 를 읽어 각 서비스를 한 번씩 호출하고
 * docs/api-samples/onbid/ 아래에 원본 응답을 저장한다.
 * 상세·입찰정보는 물건관리번호가 있어야 하므로 목록 응답에서 이어받는다.
 *
 * 주의 — 서비스키는 어떤 경우에도 출력하거나 파일에 저장하지 않는다.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = join(ROOT, 'docs', 'api-samples', 'onbid')

const BASE = 'https://apis.data.go.kr/B010003'
/** 포털 가이드상 10 TPS. 샘플 수집이라 넉넉히 둔다 */
const DELAY_MS = 300

function loadEnv() {
  const text = readFileSync(join(ROOT, '.env'), 'utf8')
  return Object.fromEntries(
    text
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const i = line.indexOf('=')
        return [line.slice(0, i).trim(), line.slice(i + 1).trim()]
      }),
  )
}

const env = loadEnv()
const SERVICE_KEY = env.DATA_GO_KR_SERVICE_KEY
if (!SERVICE_KEY) {
  console.error('.env 의 DATA_GO_KR_SERVICE_KEY 가 비어 있습니다.')
  process.exit(1)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * 응답 봉투가 세 종류다 (API_FINDINGS 기준).
 *   ① { header: { resultCode } , body }        정상/서비스 오류
 *   ② { OpenAPI_ServiceResponse.cmmMsgHeader } 게이트웨이 오류 (HTTP 400 동반 가능)
 *   ③ { result: { resultCode } }               데이터 없음 / 파라미터 오류
 * HTTP 200 에도 오류가 실려 오므로 상태코드만으로 성공을 판정하면 안 된다.
 */
function readEnvelope(json) {
  if (json?.OpenAPI_ServiceResponse) {
    const h = json.OpenAPI_ServiceResponse.cmmMsgHeader ?? {}
    return { ok: false, code: h.returnReasonCode ?? '?', msg: h.errMsg ?? h.returnAuthMsg ?? '?' }
  }
  if (json?.result && !json?.body && !json?.response) {
    const r = json.result
    return { ok: r.resultCode === '00', code: r.resultCode, msg: r.resultMsg }
  }
  const header = json?.header ?? json?.response?.header ?? {}
  const body = json?.body ?? json?.response?.body
  return { ok: header.resultCode === '00', code: header.resultCode ?? '?', msg: header.resultMsg ?? '?', body }
}

function itemsOf(body) {
  const items = body?.items
  if (Array.isArray(items)) return items
  if (Array.isArray(items?.item)) return items.item
  if (items?.item) return [items.item]
  return []
}

async function call(service, operation, params) {
  const url = new URL(`${BASE}/${service}/${operation}`)
  url.searchParams.set('serviceKey', SERVICE_KEY)
  url.searchParams.set('resultType', 'json')
  url.searchParams.set('pageNo', '1')
  url.searchParams.set('numOfRows', '5')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)

  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  const text = await res.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    /* XML 등 JSON 이 아닌 응답 */
  }
  return { status: res.status, text, json }
}

/** 저장 파일에 키가 섞여 들어가지 않도록 한 번 더 막는다 */
function assertNoKey(text) {
  if (text.includes(SERVICE_KEY)) throw new Error('응답에 서비스키가 포함되어 저장을 중단합니다.')
}

function save(name, payload) {
  const text = JSON.stringify(payload, null, 2)
  assertNoKey(text)
  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(join(OUT_DIR, `${name}.json`), text + '\n', 'utf8')
}

const ymd = (d) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
const shift = (days) => {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d
}

const results = []

async function run(label, name, service, operation, params) {
  process.stdout.write(`\n■ ${label}\n  ${service}/${operation}\n`)
  await sleep(DELAY_MS)

  let call_
  try {
    call_ = await call(service, operation, params)
  } catch (e) {
    process.stdout.write(`  ✗ 호출 실패: ${e.message}\n`)
    results.push({ label, service, operation, ok: false, note: e.message })
    return null
  }

  const { status, text, json } = call_
  if (!json) {
    process.stdout.write(`  ✗ HTTP ${status} · JSON 아님 (${text.length}ب)\n`)
    results.push({ label, service, operation, ok: false, note: `JSON 아님 (HTTP ${status})` })
    return null
  }

  const env_ = readEnvelope(json)
  const items = itemsOf(env_.body)
  const total = env_.body?.totalCount

  save(name, {
    _meta: {
      수집일시: new Date().toISOString(),
      서비스: service,
      오퍼레이션: operation,
      요청파라미터: { ...params, pageNo: '1', numOfRows: '5', resultType: 'json' },
      HTTP상태: status,
      비고: '서비스키는 제외하고 기록했습니다.',
    },
    응답: json,
  })

  const mark = env_.ok ? '✓' : '✗'
  process.stdout.write(`  ${mark} HTTP ${status} · resultCode=${env_.code} ${env_.msg}\n`)
  if (env_.ok) {
    process.stdout.write(`    totalCount=${total ?? '?'} · 이번 응답 ${items.length}건\n`)
    if (items[0]) process.stdout.write(`    필드(${Object.keys(items[0]).length}개): ${Object.keys(items[0]).join(', ')}\n`)
  }
  process.stdout.write(`    → docs/api-samples/onbid/${name}.json\n`)

  results.push({
    label,
    service,
    operation,
    ok: env_.ok,
    code: env_.code,
    msg: env_.msg,
    totalCount: total,
    fieldCount: items[0] ? Object.keys(items[0]).length : 0,
  })
  return items
}

// ─────────────────────────────────────────────────────────────
// 1. 부동산 물건목록 — 수집 본체. prptDivCd(재산유형)·pvctTrgtYn(수의계약가능) 필수
// ─────────────────────────────────────────────────────────────
const listItems = await run(
  '부동산 물건목록',
  '01-부동산-물건목록',
  'OnbidRlstListSrvc2',
  'getRlstCltrList2',
  { prptDivCd: '0005,0007', pvctTrgtYn: 'N' },
)

// 목록에서 물건관리번호를 받아 상세·입찰정보로 이어간다
const first = listItems?.[0] ?? {}
const cltrMngNo = first.CLTR_MNMT_NO ?? first.cltrMngNo ?? first.CLTR_MNG_NO ?? null
const pbctCdtnNo = first.PBCT_CDTN_NO ?? first.pbctCdtnNo ?? null

if (cltrMngNo) {
  process.stdout.write(`\n  (목록 첫 물건에서 이어받음) 물건관리번호=${cltrMngNo} 공매조건번호=${pbctCdtnNo ?? '없음'}\n`)
}

// ─────────────────────────────────────────────────────────────
// 2. 부동산 물건상세
// ─────────────────────────────────────────────────────────────
if (cltrMngNo) {
  await run('부동산 물건상세', '02-부동산-물건상세', 'OnbidRlstDtlSrvc2', 'getRlstDtlInf2', {
    cltrMngNo: String(cltrMngNo),
    ...(pbctCdtnNo ? { pbctCdtnNo: String(pbctCdtnNo) } : {}),
  })
} else {
  process.stdout.write('\n■ 부동산 물건상세 — 건너뜀 (물건관리번호를 못 얻음)\n')
  results.push({ label: '부동산 물건상세', ok: false, note: '물건관리번호 없음' })
}

// ─────────────────────────────────────────────────────────────
// 3. 물건상세 입찰정보 — 회차별 유찰 이력(prcnBidClgList)이 여기서 나온다
// ─────────────────────────────────────────────────────────────
if (cltrMngNo && pbctCdtnNo) {
  await run('물건상세 입찰정보', '03-물건상세-입찰정보', 'OnbidCltrBidDtlSrvc2', 'getCltrBidInf2', {
    cltrMngNo: String(cltrMngNo),
    pbctCdtnNo: String(pbctCdtnNo),
  })
} else {
  process.stdout.write('\n■ 물건상세 입찰정보 — 건너뜀 (물건관리번호·공매조건번호 필요)\n')
  results.push({ label: '물건상세 입찰정보', ok: false, note: '물건관리번호/공매조건번호 없음' })
}

// ─────────────────────────────────────────────────────────────
// 4. 공고목록 — 개찰일 구간이 필수다
// ─────────────────────────────────────────────────────────────
await run('공고목록', '04-공고목록', 'OnbidPbancListSrvc2', 'getPbancList2', {
  cltrTypeCd: '0001',
  prptDivCd: '0007',
  opbdDtStart: ymd(shift(-30)),
  opbdDtEnd: ymd(shift(30)),
})

// ─────────────────────────────────────────────────────────────
// 5. 코드 및 주소 — 공통코드(용도) 적재용. 11/18 "코드표 정리"의 원천
// ─────────────────────────────────────────────────────────────
await run('용도 공통코드', '05-용도-공통코드', 'OnbidCodeSrvc', 'getOnbidUsgCodeInfo', {})

// ─────────────────────────────────────────────────────────────
process.stdout.write('\n────────── 요약 ──────────\n')
for (const r of results) {
  const mark = r.ok ? '✓' : '✗'
  process.stdout.write(`${mark} ${r.label.padEnd(16)} ${r.ok ? `totalCount=${r.totalCount ?? '?'} 필드 ${r.fieldCount}개` : (r.note ?? `${r.code} ${r.msg}`)}\n`)
}
const okCount = results.filter((r) => r.ok).length
process.stdout.write(`\n성공 ${okCount} / ${results.length}\n`)
