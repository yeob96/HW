export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/** 프로토타입: 실제 길찾기 API 대신 직선거리 기반 추정치 */
export function estimateCarMinutes(distanceKm: number): number {
  return Math.round(6 + (distanceKm / 28) * 60)
}

export function estimateTransitMinutes(distanceKm: number): number {
  return Math.round(10 + (distanceKm / 20) * 60)
}
