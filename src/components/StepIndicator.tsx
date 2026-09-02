interface StepIndicatorProps {
  steps: string[]
  current: number
}

export function StepIndicator({ steps, current }: StepIndicatorProps) {
  return (
    <div className="flex items-center gap-2">
      {steps.map((label, i) => {
        const stepNo = i + 1
        const active = stepNo === current
        const done = stepNo < current
        return (
          <div key={label} className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <div
                className={[
                  'flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium transition-colors',
                  done
                    ? 'bg-emerald-500 text-white'
                    : active
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-200 text-slate-500',
                ].join(' ')}
              >
                {done ? '✓' : stepNo}
              </div>
              <span className={active ? 'text-sm font-medium text-slate-900' : 'text-sm text-slate-400'}>
                {label}
              </span>
            </div>
            {stepNo !== steps.length && <div className="h-px w-8 bg-slate-200" />}
          </div>
        )
      })}
    </div>
  )
}
