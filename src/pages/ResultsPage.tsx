import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ConditionModal } from '../components/ConditionModal'
import { MapPlaceholder } from '../components/MapPlaceholder'
import { RegionCard } from '../components/RegionCard'
import { useAuthStore, useCurrentUser } from '../store/authStore'
import { useSearchStore } from '../store/searchStore'

export function ResultsPage() {
  const navigate = useNavigate()
  const [conditionModalOpen, setConditionModalOpen] = useState(false)
  const [hoveredDongCode, setHoveredDongCode] = useState<string | undefined>(undefined)
  const [jiggleMode, setJiggleMode] = useState(false)
  const [excludeTarget, setExcludeTarget] = useState<string | null>(null)
  const workplace = useSearchStore((s) => s.workplace)
  const commuteMode = useSearchStore((s) => s.commuteMode)
  const maxMinutes = useSearchStore((s) => s.maxMinutes)
  const dealTypes = useSearchStore((s) => s.dealTypes)
  const activeDealType = useSearchStore((s) => s.activeDealType)
  const setActiveDealType = useSearchStore((s) => s.setActiveDealType)
  const resultsByType = useSearchStore((s) => s.resultsByType)
  const hasSearched = useSearchStore((s) => s.hasSearched)

  const user = useCurrentUser()
  const toggleLike = useAuthStore((s) => s.toggleLike)
  const toggleDislike = useAuthStore((s) => s.toggleDislike)

  useEffect(() => {
    if (!hasSearched) navigate('/', { replace: true })
  }, [hasSearched, navigate])

  useEffect(() => {
    if (!jiggleMode) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setJiggleMode(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [jiggleMode])

  if (!hasSearched) return null

  const dislikedDongCodes = user?.dislikedDongCodes ?? []
  const likedDongCodes = user?.likedDongCodes ?? []
  const results = (resultsByType[activeDealType] ?? [])
    .filter((r) => !dislikedDongCodes.includes(r.dongCode))
    .slice()
    .sort((a, b) => Number(likedDongCodes.includes(b.dongCode)) - Number(likedDongCodes.includes(a.dongCode)))

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-slate-100 px-6 py-4">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-emerald-600">검색 결과</p>
            <h1 className="text-lg font-semibold text-slate-900">
              {workplace.name} 기준 · {commuteMode === 'transit' ? '대중교통' : '자차'} {maxMinutes}분 이내 ·{' '}
              {dealTypes.join(' · ')}
            </h1>
          </div>
          <button
            onClick={() => setConditionModalOpen(true)}
            className="cursor-pointer rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-300"
          >
            조건 변경
          </button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-6 lg:flex-row">
        <div className="h-80 lg:h-auto lg:w-3/5">
          <MapPlaceholder
            workplace={workplace}
            regions={results}
            hoveredDongCode={hoveredDongCode}
            onSelect={(dc) => navigate(`/results/${dc}`)}
          />
        </div>

        <div className="flex-1">
          {dealTypes.length > 0 && (
            <div className="mb-3 flex gap-1 border-b border-slate-100">
              {dealTypes.map((dt) => (
                <button
                  key={dt}
                  onClick={() => setActiveDealType(dt)}
                  className={[
                    '-mb-px cursor-pointer border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                    activeDealType === dt
                      ? 'border-emerald-600 text-emerald-700 hover:text-emerald-800'
                      : 'border-transparent text-slate-400 hover:text-slate-600',
                  ].join(' ')}
                >
                  {dt}
                  <span className="ml-1.5 text-xs text-slate-400">{(resultsByType[dt] ?? []).length}</span>
                </button>
              ))}
            </div>
          )}
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm text-slate-500">조건에 맞는 지역 {results.length}곳</p>
            {jiggleMode && (
              <button
                onClick={() => setJiggleMode(false)}
                className="cursor-pointer rounded-lg bg-slate-900 px-3 py-1 text-xs font-medium text-white hover:bg-slate-800"
              >
                완료
              </button>
            )}
          </div>
          {results.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-400">
              조건에 맞는 지역이 없어요. 소요시간이나 예산 범위를 넓혀보세요.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {results.map((r, i) => (
                <RegionCard
                  key={r.dongCode}
                  region={r}
                  dealType={activeDealType}
                  liked={likedDongCodes.includes(r.dongCode)}
                  onClick={() => navigate(`/results/${r.dongCode}`)}
                  onMouseEnter={() => setHoveredDongCode(r.dongCode)}
                  onMouseLeave={() => setHoveredDongCode(undefined)}
                  onToggleLike={user ? () => toggleLike(r.dongCode) : undefined}
                  jiggling={jiggleMode}
                  jiggleVariant={i % 2 === 0 ? 'a' : 'b'}
                  onLongPressStart={user ? () => setJiggleMode(true) : undefined}
                  onRequestExclude={user ? () => setExcludeTarget(r.dongCode) : undefined}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <ConditionModal open={conditionModalOpen} onClose={() => setConditionModalOpen(false)} />

      {excludeTarget && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-900/40 px-4"
          onClick={() => setExcludeTarget(null)}
        >
          <div className="w-full max-w-xs rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm text-slate-700">해당 지역을 검색 제외 대상에 추가합니다.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setExcludeTarget(null)}
                className="cursor-pointer rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:border-slate-300"
              >
                취소
              </button>
              <button
                onClick={() => {
                  toggleDislike(excludeTarget)
                  setExcludeTarget(null)
                }}
                className="cursor-pointer rounded-lg bg-red-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-600"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
