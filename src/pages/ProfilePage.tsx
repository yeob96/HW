import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { REGIONS } from '../data/regions'
import { useAuthStore, useCurrentUser } from '../store/authStore'

const inputClass =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400'

function regionName(dongCode: string) {
  return REGIONS.find((r) => r.dongCode === dongCode)?.regionName ?? dongCode
}

export function ProfilePage() {
  const navigate = useNavigate()
  const user = useCurrentUser()
  const updateProfile = useAuthStore((s) => s.updateProfile)
  const deleteAccount = useAuthStore((s) => s.deleteAccount)
  const logout = useAuthStore((s) => s.logout)
  const toggleLike = useAuthStore((s) => s.toggleLike)
  const toggleDislike = useAuthStore((s) => s.toggleDislike)

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
          <div className="mt-6 space-y-3 rounded-lg border border-slate-200 p-4">
            <p className="text-sm font-medium text-slate-700">
              <span className="text-slate-900">{user.id}</span> 님
            </p>
            <div>
              <label className="mb-1 block text-xs text-slate-500">이메일</label>
              <input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
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

          <div className="mt-6 rounded-lg border border-slate-200 p-4">
            <p className="text-sm font-medium text-slate-700">좋아요한 지역</p>
            {user.likedDongCodes.length === 0 ? (
              <p className="mt-2 text-xs text-slate-400">좋아요한 지역이 없어요.</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {user.likedDongCodes.map((code) => (
                  <li key={code} className="flex items-center justify-between text-sm text-slate-700">
                    {regionName(code)}
                    <button
                      onClick={() => toggleLike(code)}
                      className="cursor-pointer text-xs text-slate-400 hover:text-slate-600"
                    >
                      취소
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <p className="mt-4 text-sm font-medium text-slate-700">싫어요한 지역 (검색 결과에서 제외됨)</p>
            {user.dislikedDongCodes.length === 0 ? (
              <p className="mt-2 text-xs text-slate-400">싫어요한 지역이 없어요.</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {user.dislikedDongCodes.map((code) => (
                  <li key={code} className="flex items-center justify-between text-sm text-slate-700">
                    {regionName(code)}
                    <button
                      onClick={() => toggleDislike(code)}
                      className="cursor-pointer text-xs text-slate-400 hover:text-slate-600"
                    >
                      취소
                    </button>
                  </li>
                ))}
              </ul>
            )}
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
    </div>
  )
}
