import { useEffect, useRef, useState } from 'react'
import { Link, Route, Routes, useNavigate } from 'react-router-dom'
import { AuthModal } from './components/AuthModal'
import { InputPage } from './pages/InputPage'
import { ProfilePage } from './pages/ProfilePage'
import { RegionDetailPage } from './pages/RegionDetailPage'
import { ResultsPage } from './pages/ResultsPage'
import { useAuthStore, useCurrentUser } from './store/authStore'

function AuthArea() {
  const navigate = useNavigate()
  const user = useCurrentUser()
  const logout = useAuthStore((s) => s.logout)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const onClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    window.addEventListener('mousedown', onClickOutside)
    return () => window.removeEventListener('mousedown', onClickOutside)
  }, [menuOpen])

  if (!user) {
    return (
      <>
        <button
          onClick={() => setAuthModalOpen(true)}
          className="cursor-pointer rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:border-slate-300"
        >
          로그인
        </button>
        <AuthModal open={authModalOpen} onClose={() => setAuthModalOpen(false)} />
      </>
    )
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setMenuOpen((v) => !v)}
        className="cursor-pointer rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        {user.id}님
      </button>
      {menuOpen && (
        <div className="absolute right-0 z-50 mt-1 w-40 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          <button
            onClick={() => {
              setMenuOpen(false)
              navigate('/profile')
            }}
            className="block w-full cursor-pointer px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
          >
            회원정보 수정
          </button>
          <button
            onClick={() => {
              setMenuOpen(false)
              logout()
              navigate('/')
            }}
            className="block w-full cursor-pointer px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
          >
            로그아웃
          </button>
        </div>
      )}
    </div>
  )
}

function App() {
  return (
    <>
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-3">
        <Link to="/" className="text-base font-bold tracking-tight text-slate-900 hover:text-slate-700">
          HW
        </Link>
        <AuthArea />
      </div>
      <Routes>
        <Route path="/" element={<InputPage />} />
        <Route path="/results" element={<ResultsPage />} />
        <Route path="/results/:dongCode" element={<RegionDetailPage />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Routes>
    </>
  )
}

export default App
