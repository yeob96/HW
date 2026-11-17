/**
 * 온비드 26종 중 서비스키가 어느 API 에 등록돼 있는지 전수 확인 — 노션 일정 11/17
 *
 *   node scripts/probe-onbid-services.mjs
 *
 * 공공데이터포털은 활용신청한 API 목록을 API 로 알려주지 않는다. 대신 응답 코드로 구분된다.
 *   30 SERVICE_KEY_IS_NOT_REGISTERED        → 신청 안 된 서비스
 *   11 NO_MANDATORY_REQUEST_PARAMETERS      → 신청됨 (필수 파라미터만 빠진 것)
 *   03 NODATA / 00 NORMAL                   → 신청됨
 *   12 NO_OPENAPI_SERVICE                   → 서비스명이 틀림
 *
 * 서비스명·오퍼레이션은 data.go.kr 각 서비스 상세 페이지의 Base URL 에서 가져왔다.
 * 키는 출력하지 않는다.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BASE = 'https://apis.data.go.kr/B010003'
const DELAY_MS = 250

const env = Object.fromEntries(
  readFileSync(join(ROOT, '.env'), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
)
const SERVICE_KEY = env.DATA_GO_KR_SERVICE_KEY
if (!SERVICE_KEY) {
  console.error('.env 의 DATA_GO_KR_SERVICE_KEY 가 비어 있습니다.')
  process.exit(1)
}

/** [한글명, 서비스명, 오퍼레이션] */
const SERVICES = [
  ['부동산 물건목록', 'OnbidRlstListSrvc2', 'getRlstCltrList2'],
  ['부동산 물건상세', 'OnbidRlstDtlSrvc2', 'getRlstDtlInf2'],
  ['물건 입찰결과목록', 'OnbidCltrBidRsltListSrvc2', 'getCltrBidRsltList2'],
  ['물건 입찰결과상세', 'OnbidCltrBidRsltDtlSrvc2', 'getCltrBidRsltDtl2'],
  ['물건상세 입찰정보', 'OnbidCltrBidDtlSrvc2', 'getCltrBidInf2'],
  ['공고목록', 'OnbidPbancListSrvc2', 'getPbancList2'],
  ['공고상세 물건정보', 'OnbidPbancCltrDtlSrvc2', 'getPbancCltrInf2'],
  ['공고상세', 'OnbidPbancDtlnfSrvc2', 'getPbancDtlInf2'],
  ['공고상세 입찰정보', 'OnbidPbancBidDtlSrvc2', 'getPbancBidInf2'],
  ['공고 입찰결과목록', 'OnbidPbancBidRsltListSrvc2', 'getPbancBidRsltList2'],
  ['공고 입찰결과상세', 'OnbidPbancBidRsltDtlSrvc2', 'getPbancBidRsltDtl2'],
  ['동산 물건목록', 'OnbidMvastListSrvc2', 'getMvastCltrList2'],
  ['동산 물건상세', 'OnbidMvastDtlSrvc2', 'getMvastDtlInf2'],
  ['차량 물건목록', 'OnbidCarListSrvc2', 'getCarCltrList2'],
  ['차량 물건상세', 'OnbidCarDtlSrvc2', 'getCarDtlInf2'],
  ['코드 및 주소', 'OnbidCodeSrvc', 'getOnbidUsgCodeInfo'],
  ['지역별 입찰 통계', 'OnbidClarBidStatsSrvc', 'getKamcoCltrClarStats'],
  ['용도별 입찰 통계', 'OnbidUsgBidStatsSrvc', 'getKamcoCltrUsgStats'],
  ['순위 - 조회수', 'OnbidInqRnkClgSrvc', 'getInqRnkClg'],
  ['순위 - 관심물건', 'OnbidItrsCltrRnkClgSrvc', 'getItrsCltrRnkClg'],
  ['순위 - 저감률', 'Onbid50PctDecrCltrSrvc', 'get50PctDecrCltr'],
  ['유가증권 상세정보', 'OnbidSctDtlInfSrvc', 'getSctDtlInf'],
  ['정부재산 - 불용품', 'OnbidDisuseCmdtyInfSrvc', 'getDisuseCmdtyInf'],
  ['정부재산 - 국유일반', 'OnbidGvwsGnrPrptInfSrvc', 'getGvwsGnrPrptInf'],
  ['정부재산 - 공유일반', 'OnbidPbownGnrPrptInfSrvc', 'getPbownGnrPrptInf'],
  ['정부재산 - 친일귀속', 'OnbidPjpnBlnPrptInfSrvc', 'getPjpnBlnPrptInf'],
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** 응답에서 코드와 메시지를 꺼낸다. 봉투가 세 종류다 */
function readCode(json) {
  if (json?.OpenAPI_ServiceResponse) {
    const h = json.OpenAPI_ServiceResponse.cmmMsgHeader ?? {}
    return { code: String(h.returnReasonCode ?? '?'), msg: h.errMsg ?? h.returnAuthMsg ?? '?' }
  }
  if (json?.result && !json?.body && !json?.response) {
    return { code: String(json.result.resultCode ?? '?'), msg: json.result.resultMsg ?? '?' }
  }
  const header = json?.header ?? json?.response?.header ?? {}
  const body = json?.body ?? json?.response?.body
  return {
    code: String(header.resultCode ?? '?'),
    msg: header.resultMsg ?? '?',
    totalCount: body?.totalCount,
  }
}

const REGISTERED = new Set(['00', '03', '11'])

const results = []
for (const [label, service, operation] of SERVICES) {
  await sleep(DELAY_MS)
  const url = new URL(`${BASE}/${service}/${operation}`)
  url.searchParams.set('serviceKey', SERVICE_KEY)
  url.searchParams.set('resultType', 'json')
  url.searchParams.set('pageNo', '1')
  url.searchParams.set('numOfRows', '1')

  let code = '?'
  let msg = ''
  let totalCount
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    const text = await res.text()
    try {
      const parsed = readCode(JSON.parse(text))
      code = parsed.code
      msg = parsed.msg
      totalCount = parsed.totalCount
    } catch {
      code = 'XML'
      msg = text.slice(0, 60).replace(/\s+/g, ' ')
    }
  } catch (e) {
    code = 'ERR'
    msg = e.message
  }

  const registered = REGISTERED.has(code)
  const wrongName = code === '12'
  results.push({ label, service, operation, code, msg, registered, wrongName, totalCount })

  const mark = registered ? '✅' : wrongName ? '❓' : '⛔'
  console.log(`${mark} ${label.padEnd(18)} ${code.padStart(3)}  ${msg}`)
}

const yes = results.filter((r) => r.registered)
const no = results.filter((r) => !r.registered && !r.wrongName)
const unknown = results.filter((r) => r.wrongName)

console.log('\n' + '─'.repeat(60))
console.log(`신청됨 ${yes.length}종 / 미신청 ${no.length}종${unknown.length ? ` / 이름확인필요 ${unknown.length}종` : ''}`)

console.log('\n■ 신청된 서비스')
for (const r of yes) console.log(`   ${r.label} (${r.service}/${r.operation})`)

console.log('\n■ 신청 안 된 서비스')
for (const r of no) console.log(`   ${r.label} (${r.service})`)

if (unknown.length) {
  console.log('\n■ 서비스명 확인 필요')
  for (const r of unknown) console.log(`   ${r.label} (${r.service}/${r.operation})`)
}
