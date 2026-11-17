import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ApiError,
  deleteSubscription,
  fetchCollectorStatus,
  fetchInbox,
  fetchSubscriptions,
  markAllNotificationsRead,
  markNotificationRead,
  runCollector,
  saveSubscription,
  setSubscriptionEnabled,
  subscribeAlerts,
  type AlertNotification,
  type AlertSubscription,
  type CollectorStatus,
} from '../api/client'
import { useCurrentUser } from '../store/authStore'
import { AUTH_REQUIRED_MESSAGE, useUiStore } from '../store/uiStore'

/** 온비드 용도 중분류 — 실제 수집 데이터에서 확인한 값 */
const USAGE_OPTIONS = [
  { id: '10100', label: '토지' },
  { id: '10200', label: '주거용건물' },
  { id: '10300', label: '상가용및업무용건물' },
  { id: '10400', label: '산업용및기타특수용건물' },
  { id: '10500', label: '용도복합용건물' },
]

/** 재산유형 */
const PROPERTY_OPTIONS = [
  { id: '0007', label: '압류재산' },
  { id: '0005', label: '기타일반재산' },
  { id: '0002', label: '공유재산' },
  { id: '0010', label: '국유재산' },
  { id: '0008', label: '수탁재산' },
]

const EMPTY_FORM = {
  name: '',
  sdNm: '',
  sggNm: '',
  usgMclsIds: [] as string[],
  prptDivCds: [] as string[],
  minEok: '',
  maxEok: '',
  maxLowstRatio: '',
  minUsbdNft: '',
}

type Form = typeof EMPTY_FORM

function eokToWon(value: string): number | null {
  const n = Number(value)
  return value.trim() === '' || Number.isNaN(n) ? null : Math.round(n * 100_000_000)
}

function wonToEok(won: number | null): string {
  return won === null ? '' : String(won / 100_000_000)
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition-colors',
        active
          ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
          : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function describe(sub: AlertSubscription): string {
  const parts: string[] = []
  if (sub.sdNm || sub.sggNm) parts.push([sub.sdNm, sub.sggNm].filter(Boolean).join(' '))
  if (sub.usgMclsIds) {
    parts.push(
      sub.usgMclsIds
        .split(',')
        .map((id) => USAGE_OPTIONS.find((o) => o.id === id)?.label ?? id)
        .join('·'),
    )
  }
  if (sub.prptDivCds) {
    parts.push(
      sub.prptDivCds
        .split(',')
        .map((id) => PROPERTY_OPTIONS.find((o) => o.id === id)?.label ?? id)
        .join('·'),
    )
  }
  if (sub.minPrice !== null || sub.maxPrice !== null) {
    parts.push(`${wonToEok(sub.minPrice) || '0'}억~${wonToEok(sub.maxPrice) || '제한없음'}`)
  }
  if (sub.maxLowstRatio !== null) parts.push(`감정가의 ${sub.maxLowstRatio}% 이하`)
  if (sub.minUsbdNft !== null) parts.push(`유찰 ${sub.minUsbdNft}회 이상`)
  return parts.join(' · ') || '조건 없음'
}

export function AlertsPage() {
  const user = useCurrentUser()
  const openAuthModal = useUiStore((s) => s.openAuthModal)
  const userId = user?.id ?? null

  const [subs, setSubs] = useState<AlertSubscription[]>([])
  const [inbox, setInbox] = useState<{ unreadCount: number; notifications: AlertNotification[] }>({
    unreadCount: 0,
    notifications: [],
  })
  const [status, setStatus] = useState<CollectorStatus | null>(null)
  const [form, setForm] = useState<Form>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const unsubscribe = useRef<(() => void) | null>(null)

  const reload = useCallback(async () => {
    if (!userId) return
    const [nextSubs, nextInbox] = await Promise.all([fetchSubscriptions(userId), fetchInbox(userId)])
    setSubs(nextSubs)
    setInbox(nextInbox)
  }, [userId])

  useEffect(() => {
    if (!userId) return
    reload().catch(() => setError('백엔드에 연결하지 못했습니다. 서버가 떠 있는지 확인해주세요.'))
    fetchCollectorStatus().then(setStatus).catch(() => undefined)

    unsubscribe.current?.()
    unsubscribe.current = subscribeAlerts(userId, () => {
      void reload()
    })
    return () => {
      unsubscribe.current?.()
      unsubscribe.current = null
    }
  }, [userId, reload])

  if (!userId) {
    return (
      <div className="mx-auto max-w-xl px-6 py-20 text-center">
        <h1 className="text-lg font-semibold text-slate-900">신규 물건 알림</h1>
        <p className="mt-2 text-sm text-slate-500">관심조건을 등록하려면 로그인이 필요합니다.</p>
        <button
          onClick={() => openAuthModal(AUTH_REQUIRED_MESSAGE)}
          className="mt-4 cursor-pointer rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          로그인
        </button>
      </div>
    )
  }

  const toggleIn = (list: string[], value: string) =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value]

  const submit = async () => {
    setError(null)
    setBusy(true)
    try {
      await saveSubscription({
        id: editingId ?? undefined,
        userId,
        name: form.name,
        sdNm: form.sdNm || null,
        sggNm: form.sggNm || null,
        usgMclsIds: form.usgMclsIds.length ? form.usgMclsIds.join(',') : null,
        prptDivCds: form.prptDivCds.length ? form.prptDivCds.join(',') : null,
        minPrice: eokToWon(form.minEok),
        maxPrice: eokToWon(form.maxEok),
        maxLowstRatio: form.maxLowstRatio.trim() === '' ? null : Number(form.maxLowstRatio),
        minUsbdNft: form.minUsbdNft.trim() === '' ? null : Number(form.minUsbdNft),
      })
      setForm(EMPTY_FORM)
      setEditingId(null)
      await reload()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : '관심조건을 저장하지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const edit = (sub: AlertSubscription) => {
    setEditingId(sub.id)
    setForm({
      name: sub.name,
      sdNm: sub.sdNm ?? '',
      sggNm: sub.sggNm ?? '',
      usgMclsIds: sub.usgMclsIds ? sub.usgMclsIds.split(',') : [],
      prptDivCds: sub.prptDivCds ? sub.prptDivCds.split(',') : [],
      minEok: wonToEok(sub.minPrice),
      maxEok: wonToEok(sub.maxPrice),
      maxLowstRatio: sub.maxLowstRatio === null ? '' : String(sub.maxLowstRatio),
      minUsbdNft: sub.minUsbdNft === null ? '' : String(sub.minUsbdNft),
    })
  }

  const collect = async () => {
    setBusy(true)
    try {
      setStatus(await runCollector())
      await reload()
    } catch {
      setError('수집을 실행하지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-6">
      <p className="text-sm font-medium text-emerald-600">알림</p>
      <h1 className="text-lg font-semibold text-slate-900">신규 물건 알림</h1>
      <p className="mt-1 text-sm text-slate-500">
        관심조건을 걸어두면 새 공매 물건이 올라올 때 알려드립니다. 수집기가 주기적으로 온비드를 확인합니다.
      </p>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <div className="mt-5 flex flex-col gap-4">
        <Panel
          title={`알림함${inbox.unreadCount > 0 ? ` · 읽지 않음 ${inbox.unreadCount}` : ''}`}
          action={
            inbox.unreadCount > 0 ? (
              <button
                onClick={() => markAllNotificationsRead(userId).then(reload)}
                className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-700"
              >
                모두 읽음
              </button>
            ) : undefined
          }
        >
          {inbox.notifications.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
              아직 알림이 없습니다. 관심조건을 등록하고 수집이 한 번 돌면 알림이 쌓입니다.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {inbox.notifications.map((n) => (
                <li
                  key={n.id}
                  className={[
                    'rounded-lg border px-4 py-3',
                    n.readAt ? 'border-slate-200 bg-white' : 'border-emerald-200 bg-emerald-50/40',
                  ].join(' ')}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{n.title}</p>
                      <p className="mt-0.5 truncate text-xs text-slate-500">{n.body}</p>
                      <p className="mt-1 text-xs text-slate-400">
                        {n.subscriptionName} · {new Date(n.createdAt).toLocaleString('ko-KR')}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      {n.cltrMngNo && (
                        <Link
                          to={`/analysis?target=${encodeURIComponent(n.cltrMngNo)}`}
                          className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                        >
                          등기분석
                        </Link>
                      )}
                      {!n.readAt && (
                        <button
                          onClick={() => markNotificationRead(n.id, userId).then(reload)}
                          className="cursor-pointer text-xs text-slate-400 hover:text-slate-600"
                        >
                          읽음
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={editingId ? '관심조건 수정' : '관심조건 등록'}>
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700">이름</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="예: 강남 아파트 5억 이하"
                className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">시/도</label>
                <input
                  value={form.sdNm}
                  onChange={(e) => setForm({ ...form, sdNm: e.target.value })}
                  placeholder="서울특별시"
                  className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">시/군/구</label>
                <input
                  value={form.sggNm}
                  onChange={(e) => setForm({ ...form, sggNm: e.target.value })}
                  placeholder="강남구"
                  className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                />
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-xs font-semibold text-slate-700">용도</p>
              <div className="flex flex-wrap gap-1.5">
                {USAGE_OPTIONS.map((o) => (
                  <Chip
                    key={o.id}
                    active={form.usgMclsIds.includes(o.id)}
                    onClick={() => setForm({ ...form, usgMclsIds: toggleIn(form.usgMclsIds, o.id) })}
                  >
                    {o.label}
                  </Chip>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-xs font-semibold text-slate-700">재산유형</p>
              <div className="flex flex-wrap gap-1.5">
                {PROPERTY_OPTIONS.map((o) => (
                  <Chip
                    key={o.id}
                    active={form.prptDivCds.includes(o.id)}
                    onClick={() => setForm({ ...form, prptDivCds: toggleIn(form.prptDivCds, o.id) })}
                  >
                    {o.label}
                  </Chip>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { key: 'minEok' as const, label: '최저가 하한(억)', placeholder: '0' },
                { key: 'maxEok' as const, label: '최저가 상한(억)', placeholder: '5' },
                { key: 'maxLowstRatio' as const, label: '감정가 대비 %', placeholder: '70' },
                { key: 'minUsbdNft' as const, label: '유찰 N회 이상', placeholder: '1' },
              ].map((field) => (
                <div key={field.key}>
                  <label className="block text-xs font-semibold text-slate-700">{field.label}</label>
                  <input
                    value={form[field.key]}
                    onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                    placeholder={field.placeholder}
                    inputMode="decimal"
                    className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-emerald-400"
                  />
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={submit}
                disabled={busy || !form.name.trim()}
                className="cursor-pointer rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
              >
                {editingId ? '수정' : '등록'}
              </button>
              {editingId && (
                <button
                  onClick={() => {
                    setEditingId(null)
                    setForm(EMPTY_FORM)
                  }}
                  className="cursor-pointer rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-300"
                >
                  취소
                </button>
              )}
            </div>
          </div>
        </Panel>

        <Panel title={`내 관심조건 ${subs.length}개`}>
          {subs.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
              등록한 관심조건이 없습니다.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {subs.map((sub) => (
                <li key={sub.id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 px-4 py-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-medium text-slate-900">
                      {sub.name}
                      {!sub.enabled && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">꺼짐</span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">{describe(sub)}</p>
                  </div>
                  <div className="flex shrink-0 gap-2 text-xs">
                    <button
                      onClick={() => setSubscriptionEnabled(sub.id, userId, !sub.enabled).then(reload)}
                      className="cursor-pointer text-slate-400 hover:text-slate-600"
                    >
                      {sub.enabled ? '끄기' : '켜기'}
                    </button>
                    <button onClick={() => edit(sub)} className="cursor-pointer text-slate-400 hover:text-slate-600">
                      수정
                    </button>
                    <button
                      onClick={() => deleteSubscription(sub.id, userId).then(reload)}
                      className="cursor-pointer text-red-400 hover:text-red-600"
                    >
                      삭제
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="수집 상태"
          action={
            <button
              onClick={collect}
              disabled={busy}
              className="cursor-pointer rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-300 disabled:text-slate-300"
            >
              {busy ? '수집 중…' : '지금 수집'}
            </button>
          }
        >
          {status ? (
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              {[
                ['저장된 물건', status.totalItems.toLocaleString()],
                ['마지막 수집', status.lastRunAt ? new Date(status.lastRunAt).toLocaleTimeString('ko-KR') : '없음'],
                ['신규', status.lastRunCreated?.toLocaleString() ?? '—'],
                ['발송 알림', status.lastRunNotifications?.toLocaleString() ?? '—'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg bg-slate-50 px-3 py-2">
                  <p className="text-xs text-slate-400">{label}</p>
                  <p className="mt-0.5 font-medium text-slate-800">{value}</p>
                </div>
              ))}
              {status.lastRunBaseline && (
                <p className="col-span-full text-xs text-slate-400">
                  첫 수집은 기준선으로만 저장하고 알림을 보내지 않습니다. 다음 수집부터 신규 물건에 알림이 갑니다.
                </p>
              )}
              {status.lastRunError && (
                <p className="col-span-full rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                  {status.lastRunError}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-400">수집 상태를 불러오지 못했습니다.</p>
          )}
        </Panel>
      </div>
    </div>
  )
}
