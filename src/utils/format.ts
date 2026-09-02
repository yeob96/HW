/** 만원 단위 금액을 "O억 O,OOO만원" 형태로 표시 */
export function formatManwon(manwon: number): string {
  const eok = Math.floor(manwon / 10000)
  const rest = Math.round(manwon % 10000)
  if (eok > 0 && rest > 0) return `${eok}억 ${rest.toLocaleString()}만원`
  if (eok > 0) return `${eok}억`
  return `${rest.toLocaleString()}만원`
}

export function formatDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}
