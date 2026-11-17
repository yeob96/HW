/**
 * 백엔드(Spring Boot) 호출용 얇은 클라이언트.
 *
 * 개발 중에는 VITE_API_BASE_URL을 비워 두고 Vite 프록시(/api → localhost:8080)를 쓴다.
 * 배포 환경처럼 백엔드가 다른 도메인에 있으면 .env에 VITE_API_BASE_URL을 채운다.
 */
const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
  const res = await fetch(url, { ...init, headers: { Accept: 'application/json', ...init?.headers } })
  if (!res.ok) {
    throw new ApiError(`${res.status} ${res.statusText}`, res.status)
  }
  return (await res.json()) as T
}

export interface HealthResponse {
  status: string
  name: string
  profiles: string[]
  time: string
}

/** 프론트 ↔ 백엔드 연결 확인 */
export function fetchHealth(signal?: AbortSignal): Promise<HealthResponse> {
  return apiGet<HealthResponse>('/api/health', { signal })
}
