import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { findTransactionById } from '../data/mockTransactions'
import { REGIONS } from '../data/regions'
import { useAuthStore, useCurrentUser } from '../store/authStore'
import type { Transaction } from '../types'
import { formatManwon } from '../utils/format'

const inputClass =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400'

function regionName(dongCode: string) {
  return REGIONS.find((r) => r.dongCode === dongCode)?.regionName ?? dongCode
}

function transactionAmountLabel(t: Transaction) {
  if (t.dealType === '매매') return formatManwon(t.price)
  if (t.dealType === '전세') return formatManwon(t.deposit)
  return `${formatManwon(t.deposit)} / ${t.monthlyRent.toLocaleString()}만원`
}

type SubTab = 'region' | 'listing'

interface LikeDislikeSectionProps {
  dongCodes: string[]
  transactionIds: string[]
  note?: string
  emptyMessage: string
  onRemoveRegion: (dongCode: string) => void
  onRemoveTransaction: (id: string) => void
}

/** 좋아요/싫어요한 지역·매물을 지역/매물 하위 탭으로 나눠 보여준다. 데이터가 전혀 없으면 안내 문구만 표시한다. */
function LikeDislikeSection({
  dongCodes,
  transactionIds,
  note,
  emptyMessage,
  onRemoveRegion,
  onRemoveTransaction,
}: LikeDislikeSectionProps) {
  const [subTab, setSubTab] = useState<SubTab>('region')
  const hasData = dongCodes.length > 0 || transactionIds.length > 0

  if (!hasData) {
    return (
      <div className="mt-6 rounded-lg border border-slate-200 p-4">
        {note && <p className="mb-2 text-xs text-slate-400">{note}</p>}
        <p className="text-xs text-slate-400">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="mt-6">
      {note && <p className="mb-3 text-xs text-slate-400">{note}</p>}
      <div className="mb-3 flex gap-3 border-b border-slate-100">
        {(
          [
            { key: 'region' as const, label: '지역' },
            { key: 'listing' as const, label: '매물' },
          ]
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setSubTab(tab.key)}
            className={[
              '-mb-px cursor-pointer border-b-2 px-1 py-1.5 text-xs font-medium transition-colors',
              subTab === tab.key
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-400 hover:text-slate-600',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200">
        {subTab === 'region' ? (
          dongCodes.length === 0 ? (
            <p className="p-4 text-xs text-slate-400">지역이 없어요.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {dongCodes.map((code) => (
                <li key={code} className="flex items-center justify-between px-4 py-2.5 text-sm text-slate-700">
                  {regionName(code)}
                  <button
                    onClick={() => onRemoveRegion(code)}
                    className="cursor-pointer text-xs text-slate-400 hover:text-slate-600"
                  >
                    취소
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : transactionIds.length === 0 ? (
          <p className="p-4 text-xs text-slate-400">매물이 없어요.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">단지</th>
                <th className="px-4 py-2 font-medium">지역</th>
                <th className="px-4 py-2 text-right font-medium">금액</th>
                <th className="w-12 px-2 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transactionIds.map((id) => {
                const tx = findTransactionById(id)
                if (!tx) return null
                return (
                  <tr key={id} className="text-slate-700">
                    <td className="px-4 py-2.5">
                      {tx.aptName} ({tx.area}㎡)
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">{regionName(tx.dongCode)}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-slate-900">
                      {transactionAmountLabel(tx)}
                    </td>
                    <td className="px-2 py-2.5 text-right">
                      <button
                        onClick={() => onRemoveTransaction(id)}
                        className="cursor-pointer text-xs text-slate-400 hover:text-slate-600"
                      >
                        취소
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

type Tab = 'profile' | 'liked' | 'disliked'

const TABS: { key: Tab; label: string }[] = [
  { key: 'profile', label: '회원정보 수정' },
  { key: 'liked', label: '좋아요한 지역' },
  { key: 'disliked', label: '싫어요한 지역' },
]

export function ProfilePage() {
  const navigate = useNavigate()
  const user = useCurrentUser()
  const updateProfile = useAuthStore((s) => s.updateProfile)
  const deleteAccount = useAuthStore((s) => s.deleteAccount)
  const logout = useAuthStore((s) => s.logout)
  const toggleLike = useAuthStore((s) => s.toggleLike)
  const toggleDislike = useAuthStore((s) => s.toggleDislike)
  const toggleLikeTransaction = useAuthStore((s) => s.toggleLikeTransaction)
  const toggleDislikeTransaction = useAuthStore((s) => s.toggleDislikeTransaction)

  const [activeTab, setActiveTab] = useState<Tab>('profile')
  const [unlocked, setUnlocked] = useState(false)
  const [gatePassword, setGatePassword] = useState('')
  const [gateError, setGateError] = useState('')

  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [saveMessage, setSaveMessage] = useState('')
  const [saveError, setSaveError] = useState('')

  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => {
    if (!user) navigate('/', { replace: true })
  }, [user, navigate])

  useEffect(() => {
    if (user) {
      setEmail(user.email)
      setPhone(user.phone)
      setAddress(user.address)
    }
  }, [user])

  if (!user) return null

  const handleUnlock = () => {
    setGateError('')
    if (gatePassword !== user.password) {
      setGateError('비밀번호가 일치하지 않아요.')
      return
    }
    setUnlocked(true)
  }

  const handleSave = () => {
    setSaveMessage('')
    setSaveError('')
    const result = updateProfile(gatePassword, { email: email.trim(), phone: phone.trim(), address: address.trim() })
    if (!result.ok) {
      setSaveError(result.error)
      return
    }
    setSaveMessage('저장했어요.')
  }

  const handleDelete = () => {
    setDeleteError('')
    const result = deleteAccount(gatePassword)
    if (!result.ok) {
      setDeleteError(result.error)
      return
    }
    navigate('/', { replace: true })
  }

  return (
    <div className="mx-auto max-w-lg px-6 py-10">
      <h1 className="text-lg font-semibold text-slate-900">회원정보 수정</h1>

      {!unlocked ? (
        <div className="mt-6 space-y-3 rounded-lg border border-slate-200 p-4">
          <p className="text-sm text-slate-500">계속하려면 비밀번호를 다시 입력해주세요.</p>
          <input
            className={inputClass}
            type="password"
            placeholder="비밀번호"
            value={gatePassword}
            onChange={(e) => setGatePassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
          />
          {gateError && <p className="text-xs text-red-500">{gateError}</p>}
          <button
            onClick={handleUnlock}
            className="w-full cursor-pointer rounded-lg bg-slate-900 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            확인
          </button>
        </div>
      ) : (
        <>
          <div className="mt-6 flex gap-4 border-b border-slate-100">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={[
                  '-mb-px cursor-pointer border-b-2 px-1 py-2 text-sm font-medium transition-colors',
                  activeTab === tab.key
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-slate-400 hover:text-slate-600',
                ].join(' ')}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'profile' && (
            <>
              <div className="mt-6 space-y-3 rounded-lg border border-slate-200 p-4">
                <p className="text-sm font-medium text-slate-700">
                  <span className="text-slate-900">{user.id}</span> 님
                </p>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">이메일</label>
                  <input
                    className={inputClass}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">전화번호</label>
                  <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">주소</label>
                  <input className={inputClass} value={address} onChange={(e) => setAddress(e.target.value)} />
                </div>
                {saveMessage && <p className="text-xs text-emerald-600">{saveMessage}</p>}
                {saveError && <p className="text-xs text-red-500">{saveError}</p>}
                <button
                  onClick={handleSave}
                  className="w-full cursor-pointer rounded-lg bg-slate-900 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
                >
                  저장
                </button>
              </div>

              <div className="mt-6 flex items-center justify-between">
                <button
                  onClick={() => {
                    logout()
                    navigate('/')
                  }}
                  className="cursor-pointer text-sm text-slate-500 hover:text-slate-700"
                >
                  로그아웃
                </button>

                {!confirmingDelete ? (
                  <button
                    onClick={() => setConfirmingDelete(true)}
                    className="cursor-pointer text-sm text-red-500 hover:text-red-600"
                  >
                    회원 탈퇴
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">정말 탈퇴하시겠어요?</span>
                    <button
                      onClick={handleDelete}
                      className="cursor-pointer rounded-lg bg-red-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-600"
                    >
                      탈퇴
                    </button>
                    <button
                      onClick={() => setConfirmingDelete(false)}
                      className="cursor-pointer rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-500 hover:border-slate-300"
                    >
                      취소
                    </button>
                  </div>
                )}
              </div>
              {deleteError && <p className="mt-2 text-right text-xs text-red-500">{deleteError}</p>}
            </>
          )}

          {activeTab === 'liked' && (
            <LikeDislikeSection
              dongCodes={user.likedDongCodes}
              transactionIds={user.likedTransactionIds}
              emptyMessage="좋아요한 항목이 없어요."
              onRemoveRegion={toggleLike}
              onRemoveTransaction={toggleLikeTransaction}
            />
          )}

          {activeTab === 'disliked' && (
            <LikeDislikeSection
              dongCodes={user.dislikedDongCodes}
              transactionIds={user.dislikedTransactionIds}
              note="싫어요한 항목은 검색 결과에서 제외돼요."
              emptyMessage="싫어요한 항목이 없어요."
              onRemoveRegion={toggleDislike}
              onRemoveTransaction={toggleDislikeTransaction}
            />
          )}
        </>
      )}
    </div>
  )
}
