import type { Workplace } from '../types'

// 프로토타입: 실제 지오코딩 API 대신 주요 거점 프리셋 사용
export const WORKPLACE_PRESETS: Workplace[] = [
  { name: '강남역', lat: 37.4979, lng: 127.0276 },
  { name: '여의도역', lat: 37.5219, lng: 126.9245 },
  { name: '판교역', lat: 37.3947, lng: 127.1112 },
  { name: '시청역', lat: 37.5658, lng: 126.9769 },
  { name: '홍대입구역', lat: 37.5572, lng: 126.9254 },
  { name: '잠실역', lat: 37.5133, lng: 127.1 },
  { name: '구로디지털단지역', lat: 37.4854, lng: 126.9016 },
  { name: '상암DMC', lat: 37.5793, lng: 126.8896 },
]
