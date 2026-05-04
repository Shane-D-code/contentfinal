import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'

interface Option { value: string; label: string }

interface Props {
  options: Option[]
  value: string
  onChange: (v: string) => void
  label?: string
  placeholder?: string
}

export function Dropdown({ options, value, onChange, label, placeholder = 'Select…' }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = options.find(o => o.value === value)

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {label && <label style={{ display: 'block', fontSize: 11, color: 'var(--t3)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</label>}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{ width: '100%', background: 'var(--s2)', border: `1px solid ${open ? 'var(--accent)' : 'var(--b1)'}`, borderRadius: 'var(--rs)', padding: '10px 14px', color: selected ? 'var(--t1)' : 'var(--t3)', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'border-color .15s' }}
      >
        <span>{selected?.label ?? placeholder}</span>
        <ChevronDown size={15} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
      </button>

      {open && (
        <div
          role="listbox"
          style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: 'var(--s2)', border: '1px solid var(--b1)', borderRadius: 'var(--rs)', zIndex: 200, boxShadow: 'var(--shadow-card)', overflow: 'hidden', animation: 'fadeUp .15s ease' }}
        >
          {options.map(opt => (
            <button
              key={opt.value}
              role="option"
              aria-selected={opt.value === value}
              onClick={() => { onChange(opt.value); setOpen(false) }}
              style={{ width: '100%', padding: '10px 14px', background: opt.value === value ? 'rgba(124,106,255,.15)' : 'none', border: 'none', color: opt.value === value ? 'var(--a2)' : 'var(--t1)', fontSize: 14, cursor: 'pointer', textAlign: 'left', transition: 'background .1s' }}
              onMouseEnter={e => { if (opt.value !== value) (e.target as HTMLElement).style.background = 'var(--s3)' }}
              onMouseLeave={e => { if (opt.value !== value) (e.target as HTMLElement).style.background = 'none' }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
