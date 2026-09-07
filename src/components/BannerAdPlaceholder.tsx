interface BannerAdPlaceholderProps {
  regionName: string
}

/**
 * 가격 추이 차트 자리에 배너광고(청약·부동산 등)가 들어간다면 어떤 느낌일지 보여주는 샘플 목업.
 * 실제 광고 연동 전, 자리 배치만 확인하기 위한 플레이스홀더다.
 */
export function BannerAdPlaceholder({ regionName }: BannerAdPlaceholderProps) {
  return (
    <div className="flex h-64 w-full flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
      <span className="mb-3 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-slate-500">
        AD
      </span>
      <p className="text-2xl">📢</p>
      <p className="mt-2 text-sm font-medium text-slate-600">배너 광고 영역</p>
      <p className="mt-1 text-xs text-slate-400">{regionName} 청약·부동산 광고가 여기에 노출됩니다</p>
    </div>
  )
}
