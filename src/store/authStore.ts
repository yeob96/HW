import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** 프로토타입 목업 계정 — 실제 DB 연동 전까지 로컬에만 저장됩니다. */
export interface MockUser {
  id: string
  password: string
  email: string
  phone: string
  address: string
  likedDongCodes: string[]
  dislikedDongCodes: string[]
}

type Result = { ok: true } | { ok: false; error: string }

interface AuthState {
  users: MockUser[]
  currentUserId: string | null

  signup: (input: { id: string; password: string; email: string; phone: string; address: string }) => Result
  login: (id: string, password: string) => Result
  logout: () => void
  updateProfile: (
    currentPassword: string,
    patch: Partial<Pick<MockUser, 'email' | 'phone' | 'address'>>,
  ) => Result
  deleteAccount: (currentPassword: string) => Result
  toggleLike: (dongCode: string) => void
  toggleDislike: (dongCode: string) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      users: [],
      currentUserId: null,

      signup: ({ id, password, email, phone, address }) => {
        if (get().users.some((u) => u.id === id)) {
          return { ok: false, error: '이미 사용 중인 아이디예요.' }
        }
        const user: MockUser = { id, password, email, phone, address, likedDongCodes: [], dislikedDongCodes: [] }
        set((state) => ({ users: [...state.users, user] }))
        return { ok: true }
      },

      login: (id, password) => {
        const user = get().users.find((u) => u.id === id && u.password === password)
        if (!user) return { ok: false, error: '아이디 또는 비밀번호가 일치하지 않아요.' }
        set({ currentUserId: user.id })
        return { ok: true }
      },

      logout: () => set({ currentUserId: null }),

      updateProfile: (currentPassword, patch) => {
        const { users, currentUserId } = get()
        const user = users.find((u) => u.id === currentUserId)
        if (!user) return { ok: false, error: '로그인이 필요해요.' }
        if (user.password !== currentPassword) return { ok: false, error: '비밀번호가 일치하지 않아요.' }
        set({ users: users.map((u) => (u.id === user.id ? { ...u, ...patch } : u)) })
        return { ok: true }
      },

      deleteAccount: (currentPassword) => {
        const { users, currentUserId } = get()
        const user = users.find((u) => u.id === currentUserId)
        if (!user) return { ok: false, error: '로그인이 필요해요.' }
        if (user.password !== currentPassword) return { ok: false, error: '비밀번호가 일치하지 않아요.' }
        set({ users: users.filter((u) => u.id !== user.id), currentUserId: null })
        return { ok: true }
      },

      toggleLike: (dongCode) => {
        const { users, currentUserId } = get()
        if (!currentUserId) return
        set({
          users: users.map((u) =>
            u.id !== currentUserId
              ? u
              : {
                  ...u,
                  likedDongCodes: u.likedDongCodes.includes(dongCode)
                    ? u.likedDongCodes.filter((c) => c !== dongCode)
                    : [...u.likedDongCodes, dongCode],
                  dislikedDongCodes: u.dislikedDongCodes.filter((c) => c !== dongCode),
                },
          ),
        })
      },

      toggleDislike: (dongCode) => {
        const { users, currentUserId } = get()
        if (!currentUserId) return
        set({
          users: users.map((u) =>
            u.id !== currentUserId
              ? u
              : {
                  ...u,
                  dislikedDongCodes: u.dislikedDongCodes.includes(dongCode)
                    ? u.dislikedDongCodes.filter((c) => c !== dongCode)
                    : [...u.dislikedDongCodes, dongCode],
                  likedDongCodes: u.likedDongCodes.filter((c) => c !== dongCode),
                },
          ),
        })
      },
    }),
    { name: 'hw-auth' },
  ),
)

/** 현재 로그인한 사용자 정보 (없으면 undefined) */
export function useCurrentUser() {
  return useAuthStore((s) => s.users.find((u) => u.id === s.currentUserId))
}
