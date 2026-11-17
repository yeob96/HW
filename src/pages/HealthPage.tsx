import { useCallback, useEffect, useState } from 'react'
import { fetchHealth, type HealthResponse } from '../api/client'

type State =
  | { kind: 'loading' }
  | { kind: 'ok'; data: HealthResponse }
  | { kind: 'error'; message: string }

/**
 * 프론트 ↔ 백엔드 연결 확인용 화면 (/health).
 * Vite 프록시를 거쳐 Spring Boot의 /api/health를 호출한다.
 */
export function HealthPage() {
  const [state, setState] = useState<State>({ kind: 'loading' })

  const check = useCallback(() => {
    const controller = new AbortController()
    setState({ kind: 'loading' })
    fetchHealth(controller.signal)
      .then((data) => setState({ kind: 'ok', data }))
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        setState({ kind: 'error', message: err instanceof Error ? err.message : String(err) })
      })
    return () => controller.abort()
  }, [])

  useEffect(() => check(), [check])

  return (
    <div className="mx-auto w-full max-w-xl px-6 py-10">
      <h1 className="text-lg font-semibold text-slate-900">백엔드 연결 확인</h1>
      <p className="mt-1 text-sm text-slate-500">
        <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">GET /api/health</code> → Spring Boot (localhost:8080)
      </p>

      <div className="mt-5 rounded-lg border border-slate-200 bg-white p-5">
        {state.kind === 'loading' && <p className="text-sm text-slate-400">확인 중…</p>}

        {state.kind === 'ok' && (
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <span className="font-medium text-emerald-700">연결됨 · {state.data.status}</span>
            </div>
            <dl className="mt-4 text-sm">
              {[
                ['애플리케이션', state.data.name],
                ['프로파일', state.data.profiles.join(', ')],
                ['서버 시각', state.data.time],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between border-b border-slate-100 py-2 last:border-b-0">
                  <dt className="text-slate-400">{label}</dt>
                  <dd className="font-medium text-slate-800">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {state.kind === 'error' && (
          <div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
              <span className="font-medium text-red-600">연결 실패</span>
            </div>
            <p className="mt-2 text-sm text-slate-500">{state.message}</p>
            <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2.5 text-xs leading-relaxed text-slate-400">
              백엔드를 먼저 띄우세요: <code>cd backend</code> → <code>./gradlew bootRun</code>
            </p>
          </div>
        )}
      </div>

      <button
        onClick={check}
        className="mt-4 cursor-pointer rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-300"
      >
        다시 확인
      </button>
    </div>
  )
}
