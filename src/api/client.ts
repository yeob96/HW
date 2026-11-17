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

// ───────────────────────── 등기 분석 ─────────────────────────

export type AnalysisStatus = 'READY' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
/** STARTED: 새로 분석 시작 · CACHED: 24시간 캐시 재사용 · IN_PROGRESS: 진행 중인 분석에 연결 */
export type AnalysisOrigin = 'STARTED' | 'CACHED' | 'IN_PROGRESS'
export type Verdict = '소멸' | '인수' | '판단보류' | '해당없음'
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN'

export interface AnalysisTicket {
  analysisId: string
  targetKey: string
  status: AnalysisStatus
  origin: AnalysisOrigin
  cachedUntil: string | null
  message: string
}

export interface RightVerdict {
  rankNo: string
  section: string
  kind: string
  purpose: string
  receivedOn: string | null
  holder: string | null
  amount: number | null
  cancelled: boolean
  confidence: number
  verdict: Verdict
  reason: string
}

export interface AnalysisPayload {
  propertyDescription: string | null
  document: {
    originalFilename: string | null
    pageCount: number | null
    textExtracted: boolean
    parseVersion: string
    rightCount: number
  }
  baseRight: {
    found: boolean
    rankNo: string | null
    section: string | null
    kind: string | null
    receivedOn: string | null
    reason: string
  }
  rights: RightVerdict[]
  tenancy: {
    verdict: Verdict
    registeredLeases: string[]
    reason: string
    requiredDocuments: string[]
  }
  assumed: {
    knownAmount: number
    hasUnknownAmount: boolean
    assumedRightCount: number
    note: string
  }
  openQuestions: string[]
  warnings: string[]
  disclaimer: string
}

export interface AnalysisView {
  analysisId: string
  targetKey: string
  status: AnalysisStatus
  requestedAt: string | null
  startedAt: string | null
  completedAt: string | null
  errorCode: string | null
  errorSummary: string | null
  riskLevel: RiskLevel | null
  headline: string | null
  cachedUntil: string | null
  result: AnalysisPayload | null
}

/**
 * 분석 요청. 24시간 캐시가 살아 있으면 파일 없이도 결과를 받는다.
 * 캐시가 없거나 만료됐으면 등기부등본 PDF 가 필요하다.
 */
export async function requestAnalysis(targetKey: string, file?: File | null): Promise<AnalysisTicket> {
  // targetKey 는 쿼리 파라미터로 보낸다. 사건번호의 한글("타경")을 멀티파트 폼 필드로 보내면
  // Tomcat 이 ISO-8859-1 로 디코딩해 글자가 깨진다(복구 불가).
  const form = new FormData()
  if (file) form.append('file', file)

  const url = `${BASE_URL}/api/analyses?targetKey=${encodeURIComponent(targetKey)}`
  const res = await fetch(url, { method: 'POST', body: form })
  if (!res.ok) {
    const message = await res
      .json()
      .then((body: { message?: string }) => body.message)
      .catch(() => null)
    throw new ApiError(message ?? `${res.status} ${res.statusText}`, res.status)
  }
  return (await res.json()) as AnalysisTicket
}

export function fetchAnalysis(analysisId: string, signal?: AbortSignal): Promise<AnalysisView> {
  return apiGet<AnalysisView>(`/api/analyses/${analysisId}`, { signal })
}

/** 물건 기준 조회. 캐시가 없으면 null */
export async function fetchAnalysisByTarget(targetKey: string, signal?: AbortSignal): Promise<AnalysisView | null> {
  try {
    return await apiGet<AnalysisView>(`/api/analyses/by-target/${encodeURIComponent(targetKey)}`, { signal })
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null
    throw err
  }
}

/**
 * 상태 변경 스트림. 결과 본문은 오지 않으므로, 완료 이벤트를 받으면 fetchAnalysis 로 결과를 가져온다.
 * 연결이 끊겨 이벤트를 놓쳐도 fetchAnalysis 로 현재 상태를 다시 확인할 수 있다.
 */
export function subscribeAnalysis(
  analysisId: string,
  onStatus: (status: AnalysisStatus) => void,
  onError?: () => void,
): () => void {
  const source = new EventSource(`${BASE_URL}/api/analyses/${analysisId}/events`)

  source.addEventListener('status', (event) => {
    try {
      const data = JSON.parse((event as MessageEvent<string>).data) as { status: AnalysisStatus }
      onStatus(data.status)
    } catch {
      /* 이벤트가 깨져도 폴링으로 복구한다 */
    }
  })
  source.onerror = () => {
    source.close()
    onError?.()
  }

  return () => source.close()
}
