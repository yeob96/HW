import { useEffect, useState } from 'react'
import { useAuthStore } from '../store/authStore'

interface AuthModalProps {
  open: boolean
  onClose: () => void
}

type Mode = 'login' | 'signup' | 'signupDone'

const inputClass =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400'

export function AuthModal({ open, onClose }: AuthModalProps) {
  const login = useAuthStore((s) => s.login)
  const signup = useAuthStore((s) => s.signup)

  const [mode, setMode] = useState<Mode>('login')
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const [error, setError] = useState('')

  const [loginId, setLoginId] = useState('')
  const [loginPassword, setLoginPassword] = useState('')

  const [signupId, setSignupId] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [signupPasswordConfirm, setSignupPasswordConfirm] = useState('')
  const [signupEmail, setSignupEmail] = useState('')
  const [signupPhone, setSignupPhone] = useState('')
  const [signupAddress, setSignupAddress] = useState('')

  useEffect(() => {
    if (open) {
      setMode('login')
      setError('')
      setLoginId('')
      setLoginPassword('')
      setSignupId('')
      setSignupPassword('')
      setSignupPasswordConfirm('')
      setSignupEmail('')
      setSignupPhone('')
      setSignupAddress('')
    }
  }, [open])

  useEffect(() => {
    if (open) {
      setMounted(true)
      const raf = requestAnimationFrame(() => setVisible(true))
      return () => cancelAnimationFrame(raf)
    }
    setVisible(false)
    const timeout = setTimeout(() => setMounted(false), 200)
    return () => clearTimeout(timeout)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!mounted) return null

  const switchMode = (next: Mode) => {
    setError('')
    setMode(next)
  }

  const handleLogin = () => {
    setError('')
    const result = login(loginId.trim(), loginPassword)
    if (!result.ok) {
      setError(result.error)
      return
    }
    onClose()
  }

  const handleSignup = () => {
    setError('')
    if (!signupId.trim() || !signupPassword) {
      setError('아이디와 비밀번호를 입력해주세요.')
      return
    }
    if (signupPassword !== signupPasswordConfirm) {
      setError('비밀번호가 서로 일치하지 않아요.')
      return
    }
    const result = signup({
      id: signupId.trim(),
      password: signupPassword,
      email: signupEmail.trim(),
      phone: signupPhone.trim(),
      address: signupAddress.trim(),
    })
    if (!result.ok) {
      setError(result.error)
      return
    }
    setMode('signupDone')
  }

  const handleLoginAfterSignup = () => {
    login(signupId.trim(), signupPassword)
    onClose()
  }

  return (
    <div
      className={[
        'fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto px-4 py-8 sm:items-center',
        'transition-colors duration-200 ease-out',
        visible ? 'bg-slate-900/40' : 'bg-slate-900/0',
      ].join(' ')}
      onClick={onClose}
    >
      <div
        className={[
          'w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl',
          'transition duration-200 ease-out',
          visible ? 'translate-y-0 scale-100 opacity-100' : '-translate-y-2 scale-95 opacity-0',
        ].join(' ')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            {mode === 'signupDone' ? '회원가입 완료' : mode === 'signup' ? '회원가입' : '로그인'}
          </h2>
          <button
            onClick={onClose}
            className="cursor-pointer rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        {mode === 'login' && (
          <div className="mt-5 space-y-3">
            <input
              className={inputClass}
              placeholder="아이디"
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
            />
            <input
              className={inputClass}
              type="password"
              placeholder="비밀번호"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />
            {error && <p className="text-xs text-red-500">{error}</p>}
            <button
              onClick={handleLogin}
              className="w-full cursor-pointer rounded-lg bg-slate-900 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              로그인
            </button>
            <button
              onClick={() => switchMode('signup')}
              className="w-full cursor-pointer rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:border-slate-300"
            >
              회원가입
            </button>
          </div>
        )}

        {mode === 'signup' && (
          <div className="mt-5 space-y-3">
            <input
              className={inputClass}
              placeholder="아이디"
              value={signupId}
              onChange={(e) => setSignupId(e.target.value)}
            />
            <input
              className={inputClass}
              type="password"
              placeholder="비밀번호"
              value={signupPassword}
              onChange={(e) => setSignupPassword(e.target.value)}
            />
            <input
              className={inputClass}
              type="password"
              placeholder="비밀번호 확인"
              value={signupPasswordConfirm}
              onChange={(e) => setSignupPasswordConfirm(e.target.value)}
            />
            <input
              className={inputClass}
              type="email"
              placeholder="이메일"
              value={signupEmail}
              onChange={(e) => setSignupEmail(e.target.value)}
            />
            <input
              className={inputClass}
              placeholder="전화번호"
              value={signupPhone}
              onChange={(e) => setSignupPhone(e.target.value)}
            />
            <input
              className={inputClass}
              placeholder="주소"
              value={signupAddress}
              onChange={(e) => setSignupAddress(e.target.value)}
            />
            {error && <p className="text-xs text-red-500">{error}</p>}
            <button
              onClick={handleSignup}
              className="w-full cursor-pointer rounded-lg bg-slate-900 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              회원가입
            </button>
            <button
              onClick={() => switchMode('login')}
              className="w-full cursor-pointer rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:border-slate-300"
            >
              로그인으로 돌아가기
            </button>
          </div>
        )}

        {mode === 'signupDone' && (
          <div className="mt-5 space-y-4 text-center">
            <p className="text-sm text-slate-600">
              <span className="font-medium text-slate-900">{signupId}</span>님, 회원가입이 완료됐어요.
            </p>
            <button
              onClick={handleLoginAfterSignup}
              className="w-full cursor-pointer rounded-lg bg-slate-900 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              로그인하기
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
