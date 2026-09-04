/** 만원 단위 금액을 "O억 O,OOO만원" 형태로 표시 */
export function formatManwon(manwon: number): string {
  const eok = Math.floor(manwon / 10000)
  const rest = Math.round(manwon % 10000)
  if (eok > 0 && rest > 0) return `${eok}억 ${rest.toLocaleString()}만원`
  if (eok > 0) return `${eok}억`
  return `${rest.toLocaleString()}만원`
}

/** 만원 단위 금액을 "O.O억원" 형태(소수점 첫째자리)로 축약 표시 */
export function formatManwonCompact(manwon: number): string {
  return `${(manwon / 10000).toFixed(1)}억원`
}

/** 만원 단위 금액을 "O.O억" 형태로 표시하되, 소수점이 .0이면 정수만 표시 (예: 0억, 7.5억) */
export function formatEokTick(manwon: number): string {
  const eok = manwon / 10000
  const rounded = eok.toFixed(1)
  return rounded.endsWith('.0') ? `${Math.round(eok)}억` : `${rounded}억`
}

/** 예산 슬라이더 눈금 표시: 0은 "0", 최대값은 상한 없음을 뜻하는 "O억+"로 표시 */
export function formatEokTickBound(manwon: number, rangeMaxManwon: number): string {
  if (manwon <= 0) return '0'
  if (manwon >= rangeMaxManwon) return `${formatEokTick(manwon)}+`
  return formatEokTick(manwon)
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

/**
 * 예산 범위를 최소/최대 영역으로 나눠 표시하기 위한 값.
 * 0~rangeMax 전체면 isFull=true(전체로 표시), 최소/최대가 각각 한계에 닿으면
 * "최소금액 없음"/"최대금액 없음"으로 표시.
 */
export function formatBudgetBounds(
  min: number,
  max: number,
  rangeMax: number,
  format: (v: number) => string,
): { isFull: boolean; minLabel: string; maxLabel: string } {
  const isFull = min <= 0 && max >= rangeMax
  const minLabel = min <= 0 ? '최소금액 없음' : format(min)
  const maxLabel = max >= rangeMax ? '최대금액 없음' : format(max)
  return { isFull, minLabel, maxLabel }
}

export function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}
