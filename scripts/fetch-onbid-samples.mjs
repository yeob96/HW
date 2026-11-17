/**
 * 온비드 OpenAPI 5종 응답 샘플 수집 — 노션 일정 11/17
 *
 *   node scripts/fetch-onbid-samples.mjs
 *
 * 여기서 다루는 5종은 "많이 쓸 것 같은 5종"이 아니라, 서비스키에 **실제로 활용신청된** 5종이다.
 * 어느 API 에 등록돼 있는지는 scripts/probe-onbid-services.mjs 로 전수 확인했다.
 *
 *   1. 부동산 물건목록      OnbidRlstListSrvc2/getRlstCltrList2
 *   2. 공고목록             OnbidPbancListSrvc2/getPbancList2
 *   3. 공고상세 물건정보    OnbidPbancCltrDtlSrvc2/getPbancCltrInf2
 *   4. 공고 입찰결과목록    OnbidPbancBidRsltListSrvc2/getPbancBidRsltList2
 *   5. 물건 입찰결과상세    OnbidCltrBidRsltDtlSrvc2/getCltrBidRsltDtl2
 *
 * 상세 계열은 키가 필요해서 목록 응답에서 이어받는다.
 * 서비스키는 출력하지도, 저장하지도 않는다.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = join(ROOT, 'docs', 'api-samples', 'onbid')
const BASE = 'https://apis.data.go.kr/B010003'
const DELAY_MS = 300

const env = Object.fromEntries(
  readFileSync(join(ROOT, '.env'), 'utf8')
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const i = line.indexOf('=')
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()]
    }),
)
const SERVICE_KEY = env.DATA_GO_KR_SERVICE_KEY
if (!SERVICE_KEY) {
  console.error('.env 의 DATA_GO_KR_SERVICE_KEY 가 비어 있습니다.')
  process.exit(1)
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const ymd = (offsetDays) => {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}

/**
 * 응답 봉투가 세 종류다 (실측).
 *   ① { header, body }                        정상/서비스 오류
 *   ② { OpenAPI_ServiceResponse.cmmMsgHeader } 게이트웨이 오류 (HTTP 400 동반 가능)
 *   ③ { result }                               파라미터 오류 / 데이터 없음
 * HTTP 200 에도 오류가 실려 오므로 상태코드만으로 성공을 판정하면 안 된다.
 */
function readEnvelope(json) {
  if (json?.OpenAPI_ServiceResponse) {
    const h = json.OpenAPI_ServiceResponse.cmmMsgHeader ?? {}
    return { ok: false, code: String(h.returnReasonCode ?? '?'), msg: h.errMsg ?? '?' }
  }
  if (json?.result && !json?.body && !json?.response) {
    const r = json.result
    return { ok: r.resultCode === '00', code: String(r.resultCode ?? '?'), msg: r.resultMsg ?? '?' }
  }
  const header = json?.header ?? json?.response?.header ?? {}
  const body = json?.body ?? json?.response?.body
  return { ok: header.resultCode === '00', code: String(header.resultCode ?? '?'), msg: header.resultMsg ?? '?', body }
}

function itemsOf(body) {
  const items = body?.items
  if (Array.isArray(items)) return items
  if (Array.isArray(items?.item)) return items.item
  if (items?.item) return [items.item]
  return []
}

function assertNoKey(text) {
  if (text.includes(SERVICE_KEY)) throw new Error('응답에 서비스키가 포함되어 저장을 중단합니다.')
}

const results = []

async function run(label, filename, service, operation, params) {
  process.stdout.write(`\n■ ${label}\n  ${service}/${operation}\n`)
  await sleep(DELAY_MS)

  const url = new URL(`${BASE}/${service}/${operation}`)
  url.searchParams.set('serviceKey', SERVICE_KEY)
  url.searchParams.set('resultType', 'json')
  url.searchParams.set('pageNo', '1')
  url.searchParams.set('numOfRows', '5')
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)

  let status
  let json = null
  let text = ''
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    status = res.status
    text = await res.text()
    json = JSON.parse(text)
  } catch (e) {
    process.stdout.write(`  ✗ ${e.message}\n`)
    results.push({ label, service, operation, ok: false, note: e.message })
    return null
  }

  const env_ = readEnvelope(json)
  const items = itemsOf(env_.body)

  const payload = {
    _meta: {
      수집일시: new Date().toISOString(),
      서비스: service,
      오퍼레이션: operation,
      요청파라미터: { ...params, pageNo: '1', numOfRows: '5', resultType: 'json' },
      HTTP상태: status,
      비고: '서비스키는 제외하고 기록했습니다.',
    },
    응답: json,
  }
  const serialized = JSON.stringify(payload, null, 2)
  assertNoKey(serialized)
  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(join(OUT_DIR, `${filename}.json`), serialized + '\n', 'utf8')

  process.stdout.write(`  ${env_.ok ? '✓' : '✗'} HTTP ${status} · resultCode=${env_.code} ${env_.msg}\n`)
  if (env_.ok) {
    process.stdout.write(`    totalCount=${env_.body?.totalCount ?? '?'} · 이번 응답 ${items.length}건\n`)
    if (items[0]) {
      process.stdout.write(`    필드 ${Object.keys(items[0]).length}개: ${Object.keys(items[0]).slice(0, 12).join(', ')}…\n`)
    }
  }
  process.stdout.write(`    → docs/api-samples/onbid/${filename}.json\n`)

  results.push({
    label,
    service,
    operation,
    ok: env_.ok,
    code: env_.code,
    msg: env_.msg,
    totalCount: env_.body?.totalCount,
    fieldCount: items[0] ? Object.keys(items[0]).length : 0,
  })
  return items
}

const pick = (items, ...keys) => {
  for (const item of items ?? []) {
    for (const key of keys) {
      if (item?.[key]) return String(item[key])
    }
  }
  return null
}

// 1. 부동산 물건목록 — prptDivCd(재산유형), pvctTrgtYn(수의계약가능) 필수
const listItems = await run('부동산 물건목록', '01-부동산-물건목록', 'OnbidRlstListSrvc2', 'getRlstCltrList2', {
  prptDivCd: '0005,0007',
  pvctTrgtYn: 'N',
})

// 2. 공고목록 — 물건유형·재산유형·개찰일 구간 필수
const pbancItems = await run('공고목록', '02-공고목록', 'OnbidPbancListSrvc2', 'getPbancList2', {
  cltrTypeCd: '0001',
  prptDivCd: '0007',
  opbdDtStart: ymd(-30),
  opbdDtEnd: ymd(30),
})

// 3. 공고상세 물건정보 — 공고관리번호(pbancMngNo) 필수. 공고목록에서 이어받는다
const pbancMngNo = pick(pbancItems, 'pbancMngNo')
if (pbancMngNo) {
  process.stdout.write(`\n  (공고목록에서 이어받음) 공고관리번호=${pbancMngNo}\n`)
  await run('공고상세 물건정보', '03-공고상세-물건정보', 'OnbidPbancCltrDtlSrvc2', 'getPbancCltrInf2', {
    pbancMngNo,
  })
} else {
  process.stdout.write('\n■ 공고상세 물건정보 — 건너뜀 (공고관리번호를 못 얻음)\n')
  results.push({ label: '공고상세 물건정보', ok: false, note: '공고관리번호 없음' })
}

// 4. 공고 입찰결과목록 — 개찰이 끝난 구간이어야 결과가 있다
const bidResults = await run(
  '공고 입찰결과목록',
  '04-공고-입찰결과목록',
  'OnbidPbancBidRsltListSrvc2',
  'getPbancBidRsltList2',
  { cltrTypeCd: '0001', prptDivCd: '0007', opbdDtStart: ymd(-60), opbdDtEnd: ymd(-1) },
)

// 5. 물건 입찰결과상세 — 물건관리번호(cltrMngNo) 필수.
//    개찰이 끝난 물건이어야 결과가 있으므로 입찰결과목록에서 먼저 찾고, 없으면 물건목록에서 가져온다
const cltrMngNo = pick(bidResults, 'cltrMngNo') ?? pick(listItems, 'cltrMngNo')
if (cltrMngNo) {
  process.stdout.write(`\n  (이어받음) 물건관리번호=${cltrMngNo}\n`)
  await run('물건 입찰결과상세', '05-물건-입찰결과상세', 'OnbidCltrBidRsltDtlSrvc2', 'getCltrBidRsltDtl2', {
    cltrMngNo,
  })
} else {
  process.stdout.write('\n■ 물건 입찰결과상세 — 건너뜀 (물건관리번호를 못 얻음)\n')
  results.push({ label: '물건 입찰결과상세', ok: false, note: '물건관리번호 없음' })
}

process.stdout.write('\n────────── 요약 ──────────\n')
for (const r of results) {
  const mark = r.ok ? '✓' : '✗'
  const detail = r.ok
    ? `totalCount=${r.totalCount ?? '?'} 필드 ${r.fieldCount}개`
    : (r.note ?? `${r.code} ${r.msg}`)
  process.stdout.write(`${mark} ${r.label.padEnd(16)} ${detail}\n`)
}
process.stdout.write(`\n성공 ${results.filter((r) => r.ok).length} / ${results.length}\n`)
