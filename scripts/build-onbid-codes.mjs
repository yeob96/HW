/**
 * 온비드 공통코드표 생성 — 노션 일정 11/18 "코드표 정리 (재산유형, 물건유형, 처분방식)"
 *
 *   node scripts/build-onbid-codes.mjs
 *
 * 코드 및 주소 API(OnbidCodeSrvc)는 현재 서비스키에 활용신청이 안 되어 있다.
 * 다행히 부동산 물건목록 응답이 모든 코드 필드를 "코드 + 명칭" 쌍으로 주므로,
 * 전량을 훑어 실제로 쓰이는 코드값을 역으로 뽑아낸다.
 * 활용신청이 승인되면 공식 코드표와 대조해 빠진 값이 있는지 확인하면 된다.
 *
 * 결과: docs/api-samples/onbid/codes.json · docs/onbid-codes.md
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SAMPLE_DIR = join(ROOT, 'docs', 'api-samples', 'onbid')
const DOCS_DIR = join(ROOT, 'docs')

const BASE = 'https://apis.data.go.kr/B010003/OnbidRlstListSrvc2/getRlstCltrList2'
const PAGE_SIZE = 5000
/** 10 TPS 제한. 넉넉히 둔다 */
const DELAY_MS = 400
/** 개발계정 일일 호출 한도를 생각해 호출 수를 묶어 둔다 */
const MAX_CALLS = 20

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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** 코드 ↔ 명칭이 쌍으로 오는 필드들 */
const CODE_PAIRS = [
  ['재산유형', 'prptDivCd', 'prptDivNm'],
  ['처분방식', 'dspsMthodCd', 'dspsMthodNm'],
  ['입찰구분', 'bidDivCd', 'bidDivNm'],
  ['낙찰방식', 'bidMthodCd', 'bidMthodNm'],
  ['경쟁방식', 'cptnMthodCd', 'cptnMthodNm'],
  ['총액단가구분', 'totalamtUnpcDivCd', 'totalamtUnpcDivNm'],
  ['용도 대분류', 'cltrUsgLclsCtgrId', 'cltrUsgLclsCtgrNm'],
  ['용도 중분류', 'cltrUsgMclsCtgrId', 'cltrUsgMclsCtgrNm'],
  ['용도 소분류', 'cltrUsgSclsCtgrId', 'cltrUsgSclsCtgrNm'],
  ['입찰상태', 'pbctStatCd', 'pbctStatNm'],
]
/** 명칭 없이 코드만 오는 필드 — 값 분포만 기록한다 */
const CODE_ONLY = [['물건상태관리', 'cltrStatMngCd']]

const tables = new Map(CODE_PAIRS.map(([label]) => [label, new Map()]))
const onlyTables = new Map(CODE_ONLY.map(([label]) => [label, new Map()]))
/** 용도 대>중>소 계층 관계 */
const usageTree = new Map()
let scanned = 0
let calls = 0

async function fetchPage(pvctTrgtYn, pageNo) {
  const url = new URL(BASE)
  url.searchParams.set('serviceKey', SERVICE_KEY)
  url.searchParams.set('resultType', 'json')
  url.searchParams.set('numOfRows', String(PAGE_SIZE))
  url.searchParams.set('pageNo', String(pageNo))
  url.searchParams.set('prptDivCd', '0001,0002,0003,0004,0005,0006,0007,0008,0009,0010')
  url.searchParams.set('pvctTrgtYn', pvctTrgtYn)

  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  const json = await res.json()
  const body = json?.body ?? json?.response?.body
  const header = json?.header ?? json?.response?.header ?? {}
  if (header.resultCode !== '00') {
    throw new Error(`resultCode=${header.resultCode} ${header.resultMsg ?? JSON.stringify(json).slice(0, 160)}`)
  }
  const raw = body?.items
  const items = Array.isArray(raw) ? raw : Array.isArray(raw?.item) ? raw.item : raw?.item ? [raw.item] : []
  return { items, totalCount: Number(body?.totalCount ?? 0) }
}

function absorb(item) {
  scanned++
  for (const [label, codeKey, nameKey] of CODE_PAIRS) {
    const code = item[codeKey]
    if (code === null || code === undefined || code === '') continue
    const table = tables.get(label)
    const entry = table.get(String(code)) ?? { name: item[nameKey] ?? null, count: 0 }
    entry.count++
    if (!entry.name && item[nameKey]) entry.name = item[nameKey]
    table.set(String(code), entry)
  }
  for (const [label, codeKey] of CODE_ONLY) {
    const code = item[codeKey]
    if (code === null || code === undefined || code === '') continue
    const table = onlyTables.get(label)
    table.set(String(code), (table.get(String(code)) ?? 0) + 1)
  }
  const l = item.cltrUsgLclsCtgrId
  const m = item.cltrUsgMclsCtgrId
  const s = item.cltrUsgSclsCtgrId
  if (l && m && s) {
    const key = `${l}>${m}>${s}`
    if (!usageTree.has(key)) {
      usageTree.set(key, {
        대분류: `${l} ${item.cltrUsgLclsCtgrNm ?? ''}`.trim(),
        중분류: `${m} ${item.cltrUsgMclsCtgrNm ?? ''}`.trim(),
        소분류: `${s} ${item.cltrUsgSclsCtgrNm ?? ''}`.trim(),
        건수: 0,
      })
    }
    usageTree.get(key).건수++
  }
}

for (const pvctTrgtYn of ['N', 'Y']) {
  let pageNo = 1
  let total = Infinity
  while ((pageNo - 1) * PAGE_SIZE < total && calls < MAX_CALLS) {
    await sleep(DELAY_MS)
    calls++
    process.stdout.write(`호출 ${calls}: pvctTrgtYn=${pvctTrgtYn} page=${pageNo} … `)
    const { items, totalCount } = await fetchPage(pvctTrgtYn, pageNo)
    total = totalCount
    items.forEach(absorb)
    process.stdout.write(`${items.length}건 (총 ${totalCount})\n`)
    if (items.length === 0) break
    pageNo++
  }
}

process.stdout.write(`\n훑은 물건 ${scanned.toLocaleString()}건 · 호출 ${calls}회\n`)

// ── 저장 ──
const asObject = (table) =>
  Object.fromEntries(
    [...table.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([code, v]) => [code, { 명칭: v.name, 건수: v.count }]),
  )

const codes = {
  _meta: {
    생성일시: new Date().toISOString(),
    출처: 'OnbidRlstListSrvc2/getRlstCltrList2 응답에서 역추출',
    훑은건수: scanned,
    주의: '공식 코드표가 아니라 현재 등록된 물건에 실제로 나타난 코드만 담고 있다. 활용신청 승인 후 OnbidCodeSrvc와 대조할 것.',
  },
  코드표: Object.fromEntries([...tables.entries()].map(([label, t]) => [label, asObject(t)])),
  명칭없는코드: Object.fromEntries(
    [...onlyTables.entries()].map(([label, t]) => [
      label,
      Object.fromEntries([...t.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([c, n]) => [c, { 건수: n }])),
    ]),
  ),
  용도계층: [...usageTree.values()].sort((a, b) => b.건수 - a.건수),
}

mkdirSync(SAMPLE_DIR, { recursive: true })
writeFileSync(join(SAMPLE_DIR, 'codes.json'), JSON.stringify(codes, null, 2) + '\n', 'utf8')

// ── 사람이 읽을 마크다운 ──
const lines = [
  '# 온비드 공통코드표',
  '',
  `부동산 물건목록 API 응답 **${scanned.toLocaleString()}건**에서 역추출했습니다. (${new Date().toISOString().slice(0, 10)})`,
  '',
  '> 공식 코드표(`OnbidCodeSrvc`)는 현재 서비스키에 활용신청이 되어 있지 않아 호출할 수 없습니다.',
  '> 아래 표는 **지금 등록된 물건에 실제로 나타난 코드**만 담고 있어, 쓰이지 않는 코드값은 빠져 있을 수 있습니다.',
  '> 활용신청이 승인되면 공식 코드표와 대조하세요.',
  '',
]
for (const [label, table] of tables) {
  lines.push(`## ${label}`, '', '| 코드 | 명칭 | 건수 |', '| --- | --- | --- |')
  for (const [code, v] of [...table.entries()].sort((a, b) => b[1].count - a[1].count)) {
    lines.push(`| \`${code}\` | ${v.name ?? '—'} | ${v.count.toLocaleString()} |`)
  }
  lines.push('')
}
for (const [label, table] of onlyTables) {
  lines.push(`## ${label} (명칭 미제공)`, '', '| 코드 | 건수 |', '| --- | --- |')
  for (const [code, n] of [...table.entries()].sort((a, b) => b[1] - a[1])) {
    lines.push(`| \`${code}\` | ${n.toLocaleString()} |`)
  }
  lines.push('')
}
lines.push('## 용도 분류 계층', '', '| 대분류 | 중분류 | 소분류 | 건수 |', '| --- | --- | --- | --- |')
for (const u of codes.용도계층) {
  lines.push(`| ${u.대분류} | ${u.중분류} | ${u.소분류} | ${u.건수.toLocaleString()} |`)
}
lines.push('')

mkdirSync(DOCS_DIR, { recursive: true })
writeFileSync(join(DOCS_DIR, 'onbid-codes.md'), lines.join('\n'), 'utf8')

process.stdout.write('\n→ docs/api-samples/onbid/codes.json\n→ docs/onbid-codes.md\n\n')
for (const [label, table] of tables) {
  process.stdout.write(`${label.padEnd(14)} ${String(table.size).padStart(3)}종\n`)
}
process.stdout.write(`${'용도 계층'.padEnd(14)} ${String(usageTree.size).padStart(3)}종\n`)
