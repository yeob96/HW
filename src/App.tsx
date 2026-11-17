import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { AuthModal } from './components/AuthModal'
import { AuctionDetailPage } from './pages/AuctionDetailPage'
import { AuctionListPage } from './pages/AuctionListPage'
import { AnalysisPage } from './pages/AnalysisPage'
import { HealthPage } from './pages/HealthPage'
import { InputPage } from './pages/InputPage'
import { ProfilePage } from './pages/ProfilePage'
import { RegionDetailPage } from './pages/RegionDetailPage'
import { ResultsPage } from './pages/ResultsPage'
import { TestPage } from './pages/TestPage'
import { useAuthStore, useCurrentUser } from './store/authStore'
import { useUiStore } from './store/uiStore'

function AuthArea() {
  const navigate = useNavigate()
  const user = useCurrentUser()
  const logout = useAuthStore((s) => s.logout)
  const openAuthModal = useUiStore((s) => s.openAuthModal)
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
      <button
        onClick={() => openAuthModal()}
        className="cursor-pointer rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 hover:border-slate-300"
      >
        로그인
      </button>
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

/**
 * 라우트가 바뀌면 맨 위부터 보여준다.
 * 목록 아래쪽 카드를 눌러 상세로 들어가면 스크롤 위치가 그대로 남아
 * 상세 페이지가 중간부터 보이는 문제를 막는다.
 */
function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return null
}

function App() {
  const authModalOpen = useUiStore((s) => s.authModalOpen)
  const authModalMessage = useUiStore((s) => s.authModalMessage)
  const closeAuthModal = useUiStore((s) => s.closeAuthModal)

  return (
    <>
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-3">
        <div className="flex items-center gap-5">
          <Link to="/" className="text-base font-bold tracking-tight text-slate-900 hover:text-slate-700">
            HW
          </Link>
          <nav className="flex items-center gap-4">
            {[
              { to: '/', label: '지역 찾기' },
              { to: '/auction', label: '경매' },
              { to: '/analysis', label: 'AI 등기분석' },
            ].map((menu) => (
              <NavLink
                key={menu.to}
                to={menu.to}
                end={menu.to === '/'}
                className={({ isActive }) =>
                  [
                    'text-sm font-medium transition-colors',
                    isActive ? 'text-emerald-700' : 'text-slate-500 hover:text-slate-700',
                  ].join(' ')
                }
              >
                {menu.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <AuthArea />
      </div>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<InputPage />} />
        <Route path="/results" element={<ResultsPage />} />
        <Route path="/results/:dongCode" element={<RegionDetailPage />} />
        <Route path="/auction" element={<AuctionListPage />} />
        <Route path="/auction/:id" element={<AuctionDetailPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/analysis" element={<AnalysisPage />} />
        <Route path="/health" element={<HealthPage />} />
        <Route path="/TEST" element={<TestPage />} />
      </Routes>
      <AuthModal open={authModalOpen} onClose={closeAuthModal} message={authModalMessage} />
    </>
  )
}

export default App
