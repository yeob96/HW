/** 만원 단위 금액을 "O억 O,OOO만원" 형태로 표시 */
export function formatManwon(manwon: number): string {
  const eok = Math.floor(manwon / 10000)
  const rest = Math.round(manwon % 10000)
  if (eok > 0 && rest > 0) return `${eok}억 ${rest.toLocaleString()}만원`
  if (eok > 0) return `${eok}억`
  return `${rest.toLocaleString()}만원`
}

/**
 * min~max가 슬라이더 전체 범위(0~rangeMax)와 같으면 "전체"로 표시.
 * max만 rangeMax에 도달하면 상한이 없다는 뜻으로 "OO 초과"로 표시.
 */
export function formatRangeLabel(min: number, max: number, rangeMax: number, format: (v: number) => string): string {
  if (min <= 0 && max >= rangeMax) return '전체'
  const maxLabel = max >= rangeMax ? `${format(max)} 초과` : format(max)
  return `${format(min)} ~ ${maxLabel}`
}

export function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}
