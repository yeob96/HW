import { create } from 'zustand'

export const AUTH_REQUIRED_MESSAGE = '해당 기능은 로그인 이후 이용 가능합니다.'

interface UiState {
  authModalOpen: boolean
  authModalMessage?: string
  openAuthModal: (message?: string) => void
  closeAuthModal: () => void
}

/** 로그인 모달을 아무 화면에서나 열고 닫기 위한 전역 UI 상태. */
export const useUiStore = create<UiState>((set) => ({
  authModalOpen: false,
  authModalMessage: undefined,
  openAuthModal: (message) => set({ authModalOpen: true, authModalMessage: message }),
  closeAuthModal: () => set({ authModalOpen: false, authModalMessage: undefined }),
}))
