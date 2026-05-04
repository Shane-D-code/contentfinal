import { Check } from 'lucide-react'

interface Props {
  steps: string[]
  current: number
}

export default function StepIndicator({ steps, current }: Props) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 28 }}>
      {steps.map((label, i) => {
        const done    = i < current
        const active  = i === current
        const future  = i > current

        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 'none' }}>
            {/* Circle */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                background: done ? 'var(--green)' : active ? 'var(--accent)' : 'var(--s3)',
                border: `2px solid ${done ? 'var(--green)' : active ? 'var(--accent)' : 'var(--b1)'}`,
                transition: 'all .3s',
                fontSize: 13, fontWeight: 700, color: future ? 'var(--t3)' : '#fff',
              }}>
                {done ? <Check size={15} /> : i + 1}
              </div>
              <span style={{ fontSize: 11, color: active ? 'var(--a2)' : done ? 'var(--green)' : 'var(--t3)', whiteSpace: 'nowrap', fontWeight: active ? 600 : 400 }}>
                {label}
              </span>
            </div>

            {/* Connector */}
            {i < steps.length - 1 && (
              <div style={{ flex: 1, height: 2, background: i < current ? 'var(--green)' : 'var(--b1)', margin: '0 6px', marginBottom: 20, transition: 'background .3s' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}
