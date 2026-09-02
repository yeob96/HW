import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPlaceholder } from '../components/MapPlaceholder'
import { RegionCard } from '../components/RegionCard'
import { useSearchStore } from '../store/searchStore'

export function ResultsPage() {
  const navigate = useNavigate()
  const workplace = useSearchStore((s) => s.workplace)
  const commuteMode = useSearchStore((s) => s.commuteMode)
  const maxMinutes = useSearchStore((s) => s.maxMinutes)
  const budget = useSearchStore((s) => s.budget)
  const results = useSearchStore((s) => s.results)
  const hasSearched = useSearchStore((s) => s.hasSearched)

  useEffect(() => {
    if (!hasSearched) navigate('/', { replace: true })
  }, [hasSearched, navigate])

  if (!hasSearched) return null

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-100 px-6 py-4">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-emerald-600">검색 결과</p>
            <h1 className="text-lg font-semibold text-slate-900">
              {workplace.name} 기준 · {commuteMode === 'transit' ? '대중교통' : '자차'} {maxMinutes}분 이내 ·{' '}
              {budget.dealType}
            </h1>
          </div>
          <button
            onClick={() => navigate('/')}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-300"
          >
            조건 변경
          </button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-6 lg:flex-row">
        <div className="h-80 lg:h-auto lg:w-3/5">
          <MapPlaceholder workplace={workplace} regions={results} onSelect={(dc) => navigate(`/results/${dc}`)} />
        </div>

        <div className="flex-1">
          <p className="mb-3 text-sm text-slate-500">조건에 맞는 지역 {results.length}곳</p>
          {results.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-400">
              조건에 맞는 지역이 없어요. 소요시간이나 예산 범위를 넓혀보세요.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {results.map((r) => (
                <RegionCard
                  key={r.dongCode}
                  region={r}
                  dealType={budget.dealType}
                  onClick={() => navigate(`/results/${r.dongCode}`)}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
