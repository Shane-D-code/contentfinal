/**
 * Core UI primitives — Card, Btn, Input, ProgressBar, ScoreBar, Tag, Spinner, SectionTitle
 * All components use CSS variables for theming.
 */
import { type ReactNode, type CSSProperties } from 'react'
import type React from 'react'

export function Card({ children, style, className }: { children: ReactNode; style?: CSSProperties; className?: string }) {
  return (
    <div
      className={className}
      style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: 'var(--r)', padding: 20, ...style }}
    >
      {children}
    </div>
  )
}

export function Spinner({ size = 20, color = 'var(--accent)' }: { size?: number; color?: string }) {
  return (
    <div
      role="status"
      aria-label="Loading"
      style={{
        width: size, height: size,
        border: `2px solid ${color}33`,
        borderTop: `2px solid ${color}`,
        borderRadius: '50%',
        animation: 'spin .7s linear infinite',
        display: 'inline-block',
        flexShrink: 0,
      }}
    />
  )
}

export function ScoreBar({ label, value, color }: { label: string; value: number; color?: string }) {
  const pct = Math.round(value * 100)
  const c = color ?? (value >= .7 ? 'var(--green)' : value >= .45 ? 'var(--yellow)' : 'var(--red)')
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 12 }}>
        <span style={{ color: 'var(--t2)' }}>{label}</span>
        <span style={{ fontWeight: 600, color: c }}>{pct}%</span>
      </div>
      <div style={{ height: 5, background: 'var(--s3)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: c, borderRadius: 3, transition: 'width .6s ease' }} />
      </div>
    </div>
  )
}

export function Btn({
  children, onClick, disabled, variant = 'primary', size = 'md', full, style, type = 'button',
}: {
  children: ReactNode; onClick?: () => void; disabled?: boolean
  variant?: 'primary' | 'ghost' | 'danger' | 'success'; size?: 'sm' | 'md' | 'lg'
  full?: boolean; style?: CSSProperties; type?: 'button' | 'submit' | 'reset'
}) {
  const bg  = disabled ? 'var(--s3)' : variant === 'primary' ? 'linear-gradient(135deg,#7c6aff,#a78bfa)' : variant === 'danger' ? '#7f1d1d' : variant === 'success' ? '#14532d' : 'var(--s2)'
  const pad = size === 'sm' ? '6px 14px' : size === 'lg' ? '14px 28px' : '10px 20px'
  const fs  = size === 'sm' ? 12 : size === 'lg' ? 15 : 13
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        background: bg,
        color: disabled ? 'var(--t3)' : '#fff',
        border: variant === 'ghost' ? '1px solid var(--b1)' : 'none',
        borderRadius: 'var(--rs)',
        padding: pad,
        fontSize: fs,
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        transition: 'opacity .15s, transform .1s',
        width: full ? '100%' : undefined,
        justifyContent: full ? 'center' : undefined,
        ...style,
      }}
      onMouseEnter={e => { if (!disabled) (e.currentTarget as HTMLElement).style.opacity = '.88' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
    >
      {children}
    </button>
  )
}

export function Input({
  value, onChange, placeholder, label, type = 'text', required, autoFocus,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string
  label?: string; type?: string; required?: boolean; autoFocus?: boolean
}) {
  return (
    <div>
      {label && (
        <label style={{ display: 'block', fontSize: 11, color: 'var(--t3)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.06em' }}>
          {label}{required && <span style={{ color: 'var(--red)', marginLeft: 2 }}>*</span>}
        </label>
      )}
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        autoFocus={autoFocus}
        style={{ width: '100%', background: 'var(--s2)', border: '1px solid var(--b1)', borderRadius: 'var(--rs)', padding: '10px 14px', color: 'var(--t1)', fontSize: 14, outline: 'none', transition: 'border-color .15s' }}
        onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
        onBlur={e => (e.target.style.borderColor = 'var(--b1)')}
      />
    </div>
  )
}

export function ProgressBar({ pct, label, color = 'var(--accent)' }: { pct: number; label?: string; color?: string }) {
  return (
    <div>
      {label && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12, color: 'var(--t2)' }}>
          <span>{label}</span>
          <span style={{ color }}>{pct}%</span>
        </div>
      )}
      <div style={{ height: 6, background: 'var(--s3)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, background: color, borderRadius: 3, transition: 'width .4s ease' }} />
      </div>
    </div>
  )
}

export function Tag({ label, color = 'var(--accent)', style }: { label: string; color?: string; style?: React.CSSProperties }) {
  return (
    <span style={{ background: `${color}22`, color, border: `1px solid ${color}44`, borderRadius: 6, padding: '2px 9px', fontSize: 11, fontWeight: 500, whiteSpace: 'nowrap', ...style }}>
      {label}
    </span>
  )
}

export function SectionTitle({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--t1)' }}>{children}</h2>
      {sub && <p style={{ fontSize: 13, color: 'var(--t2)', marginTop: 4 }}>{sub}</p>}
    </div>
  )
}
