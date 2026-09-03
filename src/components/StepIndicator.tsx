interface StepIndicatorProps {
  steps: string[]
  current: number
}

export function StepIndicator({ steps, current }: StepIndicatorProps) {
  return (
    <div className="flex items-start justify-center gap-1 sm:gap-2">
      {steps.map((label, i) => {
        const stepNo = i + 1
        const active = stepNo === current
        const done = stepNo < current
        return (
          <div key={label} className="flex shrink-0 items-start">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={[
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium transition-colors sm:h-7 sm:w-7 sm:text-sm',
                  done
                    ? 'bg-emerald-500 text-white'
                    : active
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-200 text-slate-500',
                ].join(' ')}
              >
                {done ? '✓' : stepNo}
              </div>
              <span
                className={[
                  'whitespace-nowrap text-xs sm:text-sm',
                  active ? 'font-medium text-slate-900' : 'text-slate-400',
                ].join(' ')}
              >
                {label}
              </span>
            </div>
            {stepNo !== steps.length && (
              <div className="flex h-6 w-4 shrink-0 items-center sm:h-7 sm:w-8">
                <div className="h-px w-full bg-slate-200" />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
