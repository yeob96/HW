import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  BID_DEPOSIT_RATE,
  PRICE_CUT_RATE,
  RIGHT_NOTES,
  discountRate,
  findAuctionById,
  isRisky,
  marketGapRate,
  saleDateLabel,
} from '../data/mockAuctions'
import { generateTransactions } from '../data/mockTransactions'
import { REGIONS } from '../data/regions'
import { useAuthStore, useCurrentUser } from '../store/authStore'
import { AUTH_REQUIRED_MESSAGE, useUiStore } from '../store/uiStore'
import type { TenantStatus } from '../types'
import { formatDate, formatManwon } from '../utils/format'

const TENANT_STYLE: Record<TenantStatus, string> = {
  '임차인 없음': 'bg-emerald-50 text-emerald-700',
  '대항력 없음': 'bg-emerald-50 text-emerald-700',
  '대항력 있음': 'bg-red-50 text-red-700',
  '조사 필요': 'bg-amber-50 text-amber-700',
}

const TENANT_NOTE: Record<TenantStatus, string> = {
  '임차인 없음': '점유자가 없어 명도 부담이 작습니다.',
  '대항력 없음': '임차인이 있으나 말소기준권리보다 늦어, 낙찰자가 보증금을 인수하지 않습니다.',
  '대항력 있음': '낙찰자가 임차보증금을 인수해야 할 수 있습니다. 입찰가에 반드시 반영하세요.',
  '조사 필요': '현황조사서상 점유 관계가 불명확합니다. 입찰 전 직접 확인이 필요합니다.',
}

const CHECKLIST = [
  '물건명세서·현황조사서·감정평가서를 법원경매정보에서 직접 열람하기',
  '등기부등본으로 말소기준권리와 인수되는 권리 확인하기',
  '현장에 가서 점유자·관리비 연체·누수 여부 확인하기',
  '입찰보증금(최저매각가의 10%)을 수표로 미리 준비하기',
  '낙찰 후 잔금 납부기한(약 1개월)과 취득세·명도비용까지 자금계획 세우기',
]

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-2.5 last:border-b-0">
      <span className="shrink-0 text-sm text-slate-400">{label}</span>
      <span className="text-right text-sm font-medium text-slate-800">{value}</span>
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="mb-3 text-sm font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  )
}

export function AuctionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const item = useMemo(() => (id ? findAuctionById(decodeURIComponent(id)) : undefined), [id])

  const user = useCurrentUser()
  const toggleLikeAuction = useAuthStore((s) => s.toggleLikeAuction)
  const openAuthModal = useUiStore((s) => s.openAuthModal)

  const nearby = useMemo(() => {
    if (!item) return []
    const region = REGIONS.find((r) => r.dongCode === item.dongCode)
    if (!region) return []
    return generateTransactions(region, '매매', 5)
  }, [item])

  if (!item) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-20 text-center">
        <p className="text-sm text-slate-500">해당 경매 물건을 찾을 수 없어요.</p>
        <button
          onClick={() => navigate('/auction')}
          className="mt-4 cursor-pointer rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-300"
        >
          경매 목록으로
        </button>
      </div>
    )
  }

  const liked = user?.likedAuctionIds.includes(item.id) ?? false
  const discount = discountRate(item)
  const gap = marketGapRate(item)
  const risky = isRisky(item)
  const nextMinimumPrice = Math.round(item.minimumPrice * PRICE_CUT_RATE)

  // 시세·감정가·최저가를 같은 축에서 비교하기 위한 막대 폭
  const barBase = Math.max(item.marketPrice, item.appraisalPrice, item.minimumPrice)
  const widthOf = (v: number) => `${Math.max(4, (v / barBase) * 100)}%`

  const handleToggleLike = () => {
    if (!user) {
      openAuthModal(AUTH_REQUIRED_MESSAGE)
      return
    }
    toggleLikeAuction(item.id)
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-6">
      <Link to="/auction" className="text-sm text-slate-400 hover:text-slate-600">
        ← 경매 목록
      </Link>

      <header className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
              {item.propertyType}
            </span>
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
              {item.status}
              {item.failedCount > 0 ? ` · 유찰 ${item.failedCount}회` : ''}
            </span>
            {risky && (
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">권리분석 필요</span>
            )}
          </div>
          <h1 className="mt-2 text-xl font-semibold text-slate-900">{item.buildingName}</h1>
          <p className="mt-1 text-sm text-slate-500">{item.address}</p>
          <p className="mt-0.5 text-xs text-slate-400">
            {item.court} · {item.caseNo}
            {item.itemNo > 1 ? ` 물건번호 ${item.itemNo}` : ''}
          </p>
        </div>
        <button
          onClick={handleToggleLike}
          className="cursor-pointer rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:border-slate-300"
        >
          {liked ? <span className="text-red-500">♥ 관심물건</span> : '♡ 관심물건'}
        </button>
      </header>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: '감정가', value: formatManwon(item.appraisalPrice), tone: 'text-slate-700' },
          { label: '최저매각가', value: formatManwon(item.minimumPrice), tone: 'text-emerald-700' },
          { label: '저감률', value: discount > 0 ? `-${discount}%` : '없음', tone: 'text-slate-700' },
          { label: '입찰보증금', value: formatManwon(item.bidDeposit), tone: 'text-slate-700' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-lg border border-slate-200 bg-white px-4 py-3">
            <p className="text-xs text-slate-400">{stat.label}</p>
            <p className={`mt-1 text-base font-semibold ${stat.tone}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-slate-50 px-4 py-3 text-sm">
        <span className="font-medium text-slate-700">{saleDateLabel(item)}</span>
        <span className="text-slate-500">매각기일 {formatDate(item.saleDate)}</span>
        {item.status !== '매각' && (
          <span className="text-slate-400">
            이번에도 유찰되면 다음 회차 최저가는 {formatManwon(nextMinimumPrice)}
          </span>
        )}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="시세 비교">
          <div className="flex flex-col gap-2.5">
            {[
              { label: '인근 시세 추정', value: item.marketPrice, color: 'bg-slate-300' },
              { label: '감정가', value: item.appraisalPrice, color: 'bg-slate-500' },
              { label: '최저매각가', value: item.minimumPrice, color: 'bg-emerald-500' },
            ].map((bar) => (
              <div key={bar.label}>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">{bar.label}</span>
                  <span className="font-medium text-slate-700">{formatManwon(bar.value)}</span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full ${bar.color}`} style={{ width: widthOf(bar.value) }} />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-slate-400">
            최저매각가가 인근 시세보다{' '}
            <span className={gap > 0 ? 'font-medium text-emerald-600' : 'font-medium text-red-600'}>
              {gap > 0 ? `${gap}% 낮습니다` : `${Math.abs(gap)}% 높습니다`}
            </span>
            . 다만 실제 낙찰가는 최저가보다 높게 형성되는 경우가 많고, 명도비용·취득세는 별도입니다.
          </p>
        </Panel>

        <Panel title="물건 정보">
          <div>
            <InfoRow label="소재지" value={item.address} />
            <InfoRow label="물건종류" value={item.propertyType} />
            {item.propertyType !== '토지' && <InfoRow label="전용면적" value={`${item.exclusiveArea}㎡`} />}
            <InfoRow label={item.propertyType === '토지' ? '토지면적' : '대지권'} value={`${item.landArea}㎡`} />
            <InfoRow label="관할법원" value={item.court} />
            <InfoRow label="사건번호" value={`${item.caseNo} (${item.itemNo})`} />
            <InfoRow label="매각기일" value={formatDate(item.saleDate)} />
            <InfoRow
              label="입찰보증금"
              value={`${formatManwon(item.bidDeposit)} (최저가의 ${Math.round(BID_DEPOSIT_RATE * 100)}%)`}
            />
          </div>
        </Panel>
      </div>

      <div className="mt-4">
        <Panel title="기일 내역">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
                  <th className="py-2 pr-4 font-medium">회차</th>
                  <th className="py-2 pr-4 font-medium">매각기일</th>
                  <th className="py-2 pr-4 font-medium">최저매각가</th>
                  <th className="py-2 font-medium">결과</th>
                </tr>
              </thead>
              <tbody>
                {item.schedules.map((s) => (
                  <tr key={s.round} className="border-b border-slate-50 last:border-b-0">
                    <td className="py-2.5 pr-4 text-slate-500">{s.round}회차</td>
                    <td className="py-2.5 pr-4 text-slate-700">{formatDate(s.date)}</td>
                    <td className="py-2.5 pr-4 font-medium text-slate-800">{formatManwon(s.minimumPrice)}</td>
                    <td className="py-2.5">
                      <span
                        className={[
                          'rounded-full px-2 py-0.5 text-xs font-medium',
                          s.result === '진행예정'
                            ? 'bg-sky-50 text-sky-700'
                            : s.result === '매각'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-slate-100 text-slate-500',
                        ].join(' ')}
                      >
                        {s.result}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-400">
            유찰될 때마다 최저매각가격이 {Math.round((1 - PRICE_CUT_RATE) * 100)}%씩 낮아집니다 (서울 지역 법원 기준).
          </p>
        </Panel>
      </div>

      <div className="mt-4">
        <Panel title="권리분석">
          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${TENANT_STYLE[item.tenant]}`}>
                {item.tenant}
              </span>
              <p className="text-sm leading-relaxed text-slate-600">{TENANT_NOTE[item.tenant]}</p>
            </div>

            {item.rights.length === 0 ? (
              <p className="rounded-lg bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
                등기부상 특수권리는 확인되지 않았습니다.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {item.rights.map((right) => (
                  <div key={right} className="rounded-lg bg-red-50 px-3 py-2.5">
                    <p className="text-sm font-medium text-red-700">{right}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-red-600">{RIGHT_NOTES[right]}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="입찰 전 확인할 것">
          <ol className="flex flex-col gap-2">
            {CHECKLIST.map((line, i) => (
              <li key={line} className="flex gap-2 text-sm leading-relaxed text-slate-600">
                <span className="shrink-0 font-medium text-slate-400">{i + 1}.</span>
                {line}
              </li>
            ))}
          </ol>
        </Panel>

        <Panel title={`${item.regionName} 최근 실거래`}>
          {nearby.length === 0 ? (
            <p className="text-sm text-slate-400">실거래 내역이 없어요.</p>
          ) : (
            <div>
              {nearby.map((tx) => (
                <InfoRow
                  key={tx.id}
                  label={`${formatDate(tx.dealDate)} · ${tx.area}㎡`}
                  value={
                    <span>
                      {tx.aptName} <span className="text-emerald-700">{formatManwon(tx.price)}</span>
                    </span>
                  }
                />
              ))}
            </div>
          )}
        </Panel>
      </div>

      <p className="mt-6 rounded-lg bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-400">
        프로토타입 안내 — 이 물건 정보는 법원경매정보 수집 데이터가 아니라 목업이며, 권리분석 내용도 예시입니다. 실제
        입찰 전에는 대법원 법원경매정보의 물건명세서·현황조사서·감정평가서와 등기부등본을 직접 확인하고, 필요하면
        전문가 상담을 받으세요.
      </p>
    </div>
  )
}
