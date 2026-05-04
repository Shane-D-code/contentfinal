/**
 * CaptionEditor — textarea with real-time character count, platform limits,
 * readability score, copy button, and A/B variant tabs.
 */
import { useState } from 'react'
import { Copy, Check, RotateCcw } from 'lucide-react'
import { charCount, readabilityGrade } from '../../lib/formatters'
import { PLATFORM_LIMITS } from '../../lib/constants'

type Platform = keyof typeof PLATFORM_LIMITS

interface Props {
  value: string
  onChange: (v: string) => void
  platform: Platform
  variants?: string[]
}

export default function CaptionEditor({ value, onChange, platform, variants = [] }: Props) {
  const [copied, setCopied] = useState(false)
  const [activeVariant, setActiveVariant] = useState<number>(-1)  // -1 = primary

  const limits = PLATFORM_LIMITS[platform]
  const { chars, words } = charCount(value)
  const grade = readabilityGrade(value)
  const pct = Math.min(100, (chars / limits.maxChars) * 100)
  const overLimit = chars > limits.maxChars
  const nearLimit = chars > limits.suggestChars && !overLimit

  const barColor = overLimit ? 'var(--red)' : nearLimit ? 'var(--yellow)' : 'var(--green)'

  const copy = () => {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const allVariants = ['Primary', ...variants.map((_, i) => `Variant ${i + 1}`)]

  return (
    <div>
      {/* Variant tabs */}
      {variants.length > 0 && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
          {allVariants.map((label, i) => (
            <button
              key={i}
              onClick={() => {
                setActiveVariant(i - 1)
                onChange(i === 0 ? value : variants[i - 1])
              }}
              style={{
                padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500,
                background: activeVariant === i - 1 ? 'var(--accent)' : 'var(--s3)',
                color: activeVariant === i - 1 ? '#fff' : 'var(--t2)',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Textarea */}
      <div style={{ position: 'relative' }}>
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          aria-label={`${limits.label} caption`}
          style={{
            width: '100%', background: 'var(--s2)',
            border: `1px solid ${overLimit ? 'var(--red)' : nearLimit ? 'var(--yellow)' : 'var(--b1)'}`,
            borderRadius: 'var(--rs)', padding: '12px 14px 40px', color: 'var(--t1)',
            fontSize: 13, lineHeight: 1.65, resize: 'vertical', minHeight: 160,
            outline: 'none', fontFamily: 'inherit', transition: 'border-color .2s',
          }}
        />
        {/* Copy button */}
        <button
          onClick={copy}
          aria-label="Copy caption"
          style={{ position: 'absolute', top: 8, right: 8, background: 'var(--s3)', border: '1px solid var(--b1)', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--t2)' }}
        >
          {copied ? <><Check size={11} color="var(--green)" /> Copied</> : <><Copy size={11} /> Copy</>}
        </button>
      </div>

      {/* Progress bar */}
      <div style={{ height: 3, background: 'var(--s3)', borderRadius: 2, marginTop: 6, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: barColor, transition: 'width .3s, background .3s' }} />
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: 11, color: 'var(--t3)', flexWrap: 'wrap' }}>
        <span style={{ color: overLimit ? 'var(--red)' : nearLimit ? 'var(--yellow)' : 'var(--t3)' }}>
          {chars.toLocaleString()} / {limits.maxChars.toLocaleString()} chars
        </span>
        <span>{words} words</span>
        <span>Grade {Math.max(1, grade)} readability</span>
        {nearLimit && <span style={{ color: 'var(--yellow)' }}>⚠ Suggest &lt;{limits.suggestChars} for best reach</span>}
        {overLimit && <span style={{ color: 'var(--red)' }}>✗ Over platform limit</span>}
      </div>
    </div>
  )
}
