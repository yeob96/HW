import { useState, type ReactNode } from 'react'

interface AdSlide {
  eyebrow: string
  titleLines: string[]
  bodyLines: ReactNode[]
  gradient: string
}

/** 결과 목록 진입 시 보여주는 샘플 광고 팝업 슬라이드 — 실제 광고 데이터가 아니다. */
const SLIDES: AdSlide[] = [
  {
    eyebrow: 'NEW 수도권 신속공급대책',
    titleLines: ['지제역', '반도체밸리 풍경채 어바니티'],
    bodyLines: [
      <>
        <strong className="text-yellow-300">삼성반도체 수혜</strong> 직주근접 입지
      </>,
      <>
        평택 지제역 <strong className="text-yellow-300">GTX-A·C 노선 예정</strong>
      </>,
      <>
        평택 신축을 <strong className="text-yellow-300">최저가로 만날 마지막 기회</strong>
      </>,
    ],
    gradient: 'from-[#0b1f4d] via-[#123a8c] to-[#4fa8e0]',
  },
  {
    eyebrow: 'NEW 청약 마감임박',
    titleLines: ['위례신도시', '한빛 스카이뷰'],
    bodyLines: [
      <>
        <strong className="text-yellow-300">위례신사선 예정</strong> 더블역세권 입지
      </>,
      <>
        학군·상권 <strong className="text-yellow-300">원스톱 생활권</strong>
      </>,
      <>
        <strong className="text-yellow-300">청약 마감 D-3</strong>, 지금 확인해보세요
      </>,
    ],
    gradient: 'from-[#241a4d] via-[#4c2a8c] to-[#c65fd0]',
  },
  {
    eyebrow: 'HOT 분양 이벤트',
    titleLines: ['동탄2신도시', '더샵 센트럴시티'],
    bodyLines: [
      <>
        <strong className="text-yellow-300">SRT 동탄역</strong> 도보 5분 초역세권
      </>,
      <>
        동탄 신도시 <strong className="text-yellow-300">중심 상업지구</strong> 인접
      </>,
      <>
        계약금 <strong className="text-yellow-300">정액 1,000만원</strong> 이벤트 진행중
      </>,
    ],
    gradient: 'from-[#04372e] via-[#0a6b57] to-[#4fd6c0]',
  },
]

interface AdPopupModalProps {
  onClose: () => void
  onHideToday: () => void
}

export function AdPopupModal({ onClose, onHideToday }: AdPopupModalProps) {
  const [index, setIndex] = useState(0)
  const slide = SLIDES[index]
  const go = (delta: number) => setIndex((i) => (i + delta + SLIDES.length) % SLIDES.length)

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-slate-900/50 px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`relative bg-gradient-to-b ${slide.gradient} px-8 pt-8 pb-10 text-center text-white`}>
          {SLIDES.length > 1 && (
            <>
              <button
                onClick={() => go(-1)}
                aria-label="이전 광고"
                className="absolute top-1/2 left-2 flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-black/20 text-lg text-white hover:bg-black/35"
              >
                ‹
              </button>
              <button
                onClick={() => go(1)}
                aria-label="다음 광고"
                className="absolute top-1/2 right-2 flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-black/20 text-lg text-white hover:bg-black/35"
              >
                ›
              </button>
            </>
          )}

          <p className="text-xs font-medium text-white/70">{slide.eyebrow}</p>
          <h2 className="mt-2 text-xl leading-snug font-bold">
            {slide.titleLines.map((line, i) => (
              <span key={i} className="block">
                {line}
              </span>
            ))}
          </h2>
          <div className="mt-4 space-y-1 text-sm text-white/90">
            {slide.bodyLines.map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
          <button className="mt-5 cursor-pointer rounded-full border border-white/60 px-5 py-2 text-sm font-medium text-white hover:bg-white/10">
            보러가기
          </button>
          <p className="mt-6 text-6xl opacity-20">🏙️</p>

          {SLIDES.length > 1 && (
            <div className="mt-3 flex justify-center gap-1.5">
              {SLIDES.map((_, i) => (
                <span key={i} className={`h-1.5 w-1.5 rounded-full ${i === index ? 'bg-white' : 'bg-white/40'}`} />
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-5 py-3 text-sm">
          <button onClick={onHideToday} className="cursor-pointer text-slate-500 hover:text-slate-700">
            오늘 하루 안 보기
          </button>
          <button onClick={onClose} className="cursor-pointer font-medium text-slate-700 hover:text-slate-900">
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}
