import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  ApiError,
  fetchAnalysis,
  fetchAnalysisByTarget,
  requestAnalysis,
  subscribeAnalysis,
  type AnalysisOrigin,
  type AnalysisView,
  type RiskLevel,
  type Verdict,
} from '../api/client'
import { formatManwon } from '../utils/format'

const VERDICT_STYLE: Record<Verdict, string> = {
  인수: 'bg-red-50 text-red-700',
  소멸: 'bg-emerald-50 text-emerald-700',
  판단보류: 'bg-amber-50 text-amber-700',
  해당없음: 'bg-slate-100 text-slate-500',
}

const RISK_STYLE: Record<RiskLevel, { label: string; className: string }> = {
  HIGH: { label: '주의', className: 'bg-red-50 text-red-700 border-red-200' },
  MEDIUM: { label: '확인 필요', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  LOW: { label: '양호', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  UNKNOWN: { label: '판단 불가', className: 'bg-slate-100 text-slate-600 border-slate-200' },
}

const ORIGIN_MESSAGE: Record<AnalysisOrigin, string> = {
  CACHED: '24시간 안에 분석된 결과를 그대로 보여드립니다.',
  IN_PROGRESS: '같은 물건을 이미 분석하고 있어 거기에 연결했습니다.',
  STARTED: '분석을 시작했습니다.',
}

/** 원 단위 금액을 만원 단위 표기로 */
function formatWon(won: number | null): string {
  if (won === null) return '—'
  return formatManwon(Math.round(won / 10000))
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="mb-3 text-sm font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  )
}

export function AnalysisPage() {
  const [params, setParams] = useSearchParams()
  const targetFromUrl = params.get('target') ?? ''

  const [targetKey, setTargetKey] = useState(targetFromUrl)
  const [file, setFile] = useState<File | null>(null)
  const [view, setView] = useState<AnalysisView | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const unsubscribe = useRef<(() => void) | null>(null)

  const load = useCallback(async (analysisId: string) => {
    const next = await fetchAnalysis(analysisId)
    setView(next)
    return next
  }, [])

  // 물건이 정해져 있으면 먼저 캐시된 결과가 있는지 본다
  useEffect(() => {
    if (!targetFromUrl) return
    const controller = new AbortController()
    fetchAnalysisByTarget(targetFromUrl, controller.signal)
      .then((cached) => {
        if (cached) {
          setView(cached)
          setNotice(ORIGIN_MESSAGE.CACHED)
        }
      })
      .catch(() => {
        /* 백엔드가 꺼져 있을 수 있다. 요청할 때 다시 알린다 */
      })
    return () => controller.abort()
  }, [targetFromUrl])

  useEffect(() => () => unsubscribe.current?.(), [])

  const watch = useCallback(
    (analysisId: string) => {
      unsubscribe.current?.()
      unsubscribe.current = subscribeAnalysis(
        analysisId,
        (status) => {
          if (status === 'COMPLETED' || status === 'FAILED') {
            unsubscribe.current?.()
            unsubscribe.current = null
            void load(analysisId)
          } else {
            setView((prev) => (prev ? { ...prev, status } : prev))
          }
        },
        () => {
          // 이벤트를 놓쳐도 상태 조회로 복구한다
          void load(analysisId)
        },
      )
    },
    [load],
  )

  const submit = async () => {
    setError(null)
    setNotice(null)
    setBusy(true)
    try {
      const ticket = await requestAnalysis(targetKey.trim(), file)
      setNotice(ORIGIN_MESSAGE[ticket.origin])
      if (targetKey.trim() !== targetFromUrl) {
        setParams({ target: targetKey.trim() }, { replace: true })
      }
      const current = await load(ticket.analysisId)
      if (current.status === 'READY' || current.status === 'PROCESSING') {
        watch(ticket.analysisId)
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '분석을 요청하지 못했습니다. 백엔드가 떠 있는지 확인해주세요.')
    } finally {
      setBusy(false)
    }
  }

  const running = view?.status === 'READY' || view?.status === 'PROCESSING'
  const result = view?.result ?? null
  const risk = view?.riskLevel ? RISK_STYLE[view.riskLevel] : null

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-6">
      <p className="text-sm font-medium text-emerald-600">AI 등기 분석</p>
      <h1 className="text-lg font-semibold text-slate-900">등기부등본 권리분석</h1>
      <p className="mt-1 text-sm text-slate-500">
        등기부등본 PDF를 올리면 말소기준권리와 권리별 인수·소멸을 정리해 드립니다. 같은 물건은 24시간 동안 분석 결과를
        다시 씁니다.
      </p>

      <div className="mt-5 rounded-lg border border-slate-200 bg-white p-5">
        <label className="block text-xs font-semibold text-slate-700">물건 식별자</label>
        <input
          value={targetKey}
          onChange={(e) => setTargetKey(e.target.value)}
          placeholder="예: 2025타경86319-1"
          className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-emerald-400"
        />

        <label className="mt-4 block text-xs font-semibold text-slate-700">등기부등본 PDF</label>
        <input
          type="file"
          accept="application/pdf,.pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="mt-1.5 w-full cursor-pointer rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 file:mr-3 file:cursor-pointer file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-xs file:font-medium file:text-slate-700"
        />
        <p className="mt-1.5 text-xs text-slate-400">
          24시간 안에 분석된 결과가 있으면 파일 없이도 결과를 받습니다. 원문은 분석에만 쓰이고 화면에 공개되지 않습니다.
        </p>

        <button
          onClick={submit}
          disabled={busy || !targetKey.trim() || running}
          className="mt-4 cursor-pointer rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
        >
          {busy ? '요청 중…' : running ? '분석 중…' : '분석 요청'}
        </button>

        {notice && <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">{notice}</p>}
        {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
      </div>

      {running && (
        <div className="mt-4 flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-5 py-4">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-500" />
          <span className="text-sm text-slate-600">
            {view?.status === 'READY' ? '대기 중…' : '등본을 읽고 권리관계를 검토하고 있습니다…'}
          </span>
        </div>
      )}

      {view?.status === 'FAILED' && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-5 py-4">
          <p className="text-sm font-medium text-red-700">분석에 실패했습니다</p>
          <p className="mt-1 text-xs text-red-600">
            {view.errorCode}: {view.errorSummary}
          </p>
        </div>
      )}

      {result && (
        <div className="mt-4 flex flex-col gap-4">
          {risk && (
            <div className={`rounded-lg border px-5 py-4 ${risk.className}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-semibold">{risk.label}</span>
                {view?.cachedUntil && (
                  <span className="text-xs opacity-80">
                    {new Date(view.cachedUntil).toLocaleString('ko-KR')}까지 이 결과를 재사용합니다
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm font-medium">{view?.headline}</p>
            </div>
          )}

          <Panel title="부동산 표시">
            <p className="text-sm text-slate-700">{result.propertyDescription ?? '표제부에서 읽지 못했습니다.'}</p>
            <p className="mt-2 text-xs text-slate-400">
              {result.document.originalFilename} · {result.document.pageCount ?? '?'}쪽 · 권리 {result.document.rightCount}건
              {!result.document.textExtracted && ' · 텍스트 추출 실패(스캔본)'}
            </p>
          </Panel>

          <Panel title="말소기준권리">
            {result.baseRight.found ? (
              <div>
                <p className="text-sm font-medium text-slate-900">
                  {result.baseRight.section} {result.baseRight.rankNo}번 · {result.baseRight.kind} ·{' '}
                  {result.baseRight.receivedOn} 접수
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{result.baseRight.reason}</p>
              </div>
            ) : (
              <p className="rounded-lg bg-amber-50 px-3 py-2.5 text-sm leading-relaxed text-amber-800">
                {result.baseRight.reason}
              </p>
            )}
          </Panel>

          <Panel title="권리별 판정">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
                    <th className="py-2 pr-3 font-medium">구분</th>
                    <th className="py-2 pr-3 font-medium">권리</th>
                    <th className="py-2 pr-3 font-medium">접수일</th>
                    <th className="py-2 pr-3 font-medium">금액</th>
                    <th className="py-2 font-medium">판정</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rights.map((right) => (
                    <tr key={`${right.section}-${right.rankNo}-${right.purpose}`} className="border-b border-slate-50 align-top last:border-b-0">
                      <td className="py-2.5 pr-3 whitespace-nowrap text-slate-500">
                        {right.section} {right.rankNo}
                      </td>
                      <td className="py-2.5 pr-3">
                        <span className="font-medium text-slate-800">{right.kind}</span>
                        {right.holder && <span className="ml-1.5 text-xs text-slate-400">{right.holder}</span>}
                        <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{right.reason}</p>
                      </td>
                      <td className="py-2.5 pr-3 whitespace-nowrap text-slate-600">{right.receivedOn ?? '—'}</td>
                      <td className="py-2.5 pr-3 whitespace-nowrap text-slate-600">{formatWon(right.amount)}</td>
                      <td className="py-2.5">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${VERDICT_STYLE[right.verdict]}`}>
                          {right.verdict}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="인수 예상 부담">
            <p className="text-lg font-semibold text-slate-900">
              {formatWon(result.assumed.knownAmount)}
              {result.assumed.hasUnknownAmount && <span className="ml-1 text-sm text-amber-600">+ 금액 미상</span>}
            </p>
            <p className="mt-1 text-xs text-slate-400">인수 대상 권리 {result.assumed.assumedRightCount}건</p>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">{result.assumed.note}</p>
          </Panel>

          <Panel title="임차인 검토">
            <div className="flex items-start gap-3">
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${VERDICT_STYLE[result.tenancy.verdict]}`}>
                {result.tenancy.verdict}
              </span>
              <p className="text-sm leading-relaxed text-slate-600">{result.tenancy.reason}</p>
            </div>
            {result.tenancy.registeredLeases.length > 0 && (
              <ul className="mt-3 flex flex-col gap-1">
                {result.tenancy.registeredLeases.map((lease) => (
                  <li key={lease} className="text-xs text-slate-500">
                    · {lease}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs font-medium text-slate-700">확인해야 할 자료</p>
            <ul className="mt-1 flex flex-col gap-1">
              {result.tenancy.requiredDocuments.map((doc) => (
                <li key={doc} className="text-xs text-slate-500">
                  · {doc}
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="추가 확인사항">
            <ol className="flex flex-col gap-2">
              {result.openQuestions.map((question, i) => (
                <li key={question} className="flex gap-2 text-sm leading-relaxed text-slate-600">
                  <span className="shrink-0 font-medium text-slate-400">{i + 1}.</span>
                  {question}
                </li>
              ))}
            </ol>
            {result.warnings.length > 0 && (
              <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2.5">
                {result.warnings.map((warning) => (
                  <p key={warning} className="text-xs leading-relaxed text-amber-800">
                    · {warning}
                  </p>
                ))}
              </div>
            )}
          </Panel>

          <p className="rounded-lg bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-400">{result.disclaimer}</p>
        </div>
      )}
    </div>
  )
}
