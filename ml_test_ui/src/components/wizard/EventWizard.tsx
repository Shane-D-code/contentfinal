/**
 * EventWizard — 4-step configuration before generation.
 * Step 1: Event name  |  Step 2: Event type
 * Step 3: Platforms   |  Step 4: Brand voice + review
 */
import { useState, useCallback } from 'react'
import { BriefcaseBusiness, ChevronRight, ChevronLeft, Film, Image, Smartphone, Zap } from 'lucide-react'
import StepIndicator from './StepIndicator'
import BrandVoiceSlider from './BrandVoiceSlider'
import { Dropdown } from '../ui/Dropdown'
import { EVENT_TYPES } from '../../lib/constants'

export interface WizardConfig {
  eventName: string
  eventDesc: string
  eventType: string
  platforms: string[]
  brandVoice: number  // 0=professional, 100=casual
}

interface Props {
  initialName?: string
  onSubmit: (config: WizardConfig) => void
  loading?: boolean
}

const PLATFORMS = [
  { id: 'linkedin',  label: 'LinkedIn',          icon: BriefcaseBusiness, desc: 'Collage + professional copy' },
  { id: 'instagram', label: 'Instagram Carousel', icon: Image, desc: 'Up to 10 slides' },
  { id: 'stories',   label: 'Instagram Stories',  icon: Smartphone, desc: '3-4 vertical frames' },
  { id: 'reel',      label: 'Instagram Reel',     icon: Film, desc: '30-60s highlight video' },
]

const STEPS = ['Event', 'Type', 'Platforms', 'Review']

// Auto-detect event type from event name/description
const detectEventType = (text: string): string => {
  const lowerText = text.toLowerCase()
  if (lowerText.includes('award') || lowerText.includes('trophy') || lowerText.includes('winner')) return 'awards'
  if (lowerText.includes('workshop') || lowerText.includes('training') || lowerText.includes('hands-on')) return 'workshop'
  if (lowerText.includes('expo') || lowerText.includes('exhibition') || lowerText.includes('trade')) return 'trade_show'
  if (lowerText.includes('networking') || lowerText.includes('mixer') || lowerText.includes('meetup')) return 'networking'
  if (lowerText.includes('launch') || lowerText.includes('unveil') || lowerText.includes('product')) return 'product_launch'
  if (lowerText.includes('corporate') || lowerText.includes('town hall')) return 'corporate'
  if (lowerText.includes('conference') || lowerText.includes('summit') || lowerText.includes('keynote')) return 'conference'
  return 'conference' // Default fallback
}

export default function EventWizard({ initialName = '', onSubmit, loading }: Props) {
  const [step, setStep] = useState(0)
  const [cfg, setCfg] = useState<WizardConfig>({
    eventName:  initialName,
    eventDesc:  '',
    eventType:  'conference',
    platforms:  ['linkedin', 'instagram', 'stories'],
    brandVoice: 30,
  })

  const update = useCallback((patch: Partial<WizardConfig>) => setCfg(c => ({ ...c, ...patch })), [])

  const togglePlatform = useCallback((id: string) =>
    update({ platforms: cfg.platforms.includes(id) ? cfg.platforms.filter(p => p !== id) : [...cfg.platforms, id] }), [cfg.platforms, update])

  const canNext = step === 0 ? cfg.eventName.trim().length > 0 : step === 2 ? cfg.platforms.length > 0 : true

  // Auto-detect event type when event name or description changes
  const handleEventNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value
    const detectedType = detectEventType(newName + ' ' + cfg.eventDesc)
    update({ eventName: newName, eventType: detectedType })
  }, [cfg.eventDesc, update])

  const handleDescriptionChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newDesc = e.target.value
    const detectedType = detectEventType(cfg.eventName + ' ' + newDesc)
    update({ eventDesc: newDesc, eventType: detectedType })
  }, [cfg.eventName, update])

  return (
    <div>
      <StepIndicator steps={STEPS} current={step} />

      {/* Step 0 — Event name */}
      {step === 0 && (
        <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--t3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>
              Event Name *
            </label>
            <input
              autoFocus
              value={cfg.eventName}
              onChange={handleEventNameChange}
              placeholder="e.g. Tech Summit 2024"
              style={{ width: '100%', background: 'var(--s2)', border: `1px solid ${cfg.eventName ? 'var(--accent)' : 'var(--b1)'}`, borderRadius: 'var(--rs)', padding: '12px 16px', color: 'var(--t1)', fontSize: 16, fontWeight: 500, outline: 'none', transition: 'border-color .2s' }}
              onKeyDown={e => { if (e.key === 'Enter' && canNext) setStep(1) }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 11, color: 'var(--t3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.06em' }}>
              Description (optional)
            </label>
            <input
              value={cfg.eventDesc}
              onChange={handleDescriptionChange}
              placeholder="Annual tech conference with keynotes and networking…"
              style={{ width: '100%', background: 'var(--s2)', border: '1px solid var(--b1)', borderRadius: 'var(--rs)', padding: '10px 16px', color: 'var(--t1)', fontSize: 14, outline: 'none' }}
            />
          </div>
          <p style={{ fontSize: 12, color: 'var(--t3)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Zap size={12} style={{ color: 'var(--accent)' }} /> Event type auto-detected as <strong style={{ color: 'var(--a2)' }}>{EVENT_TYPES.find(e => e.value === cfg.eventType)?.label ?? cfg.eventType}</strong>
          </p>
        </div>
      )}

      {/* Step 1 — Event type */}
      {step === 1 && (
        <div className="fade-up">
          <Dropdown
            label="Event Type"
            options={EVENT_TYPES}
            value={cfg.eventType}
            onChange={v => update({ eventType: v })}
          />
          <p style={{ fontSize: 12, color: 'var(--t3)', marginTop: 10 }}>
            This helps the AI generate more relevant captions and select the right assets.
          </p>
        </div>
      )}

      {/* Step 2 — Platforms */}
      {step === 2 && (
        <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 4 }}>Select which platforms to generate content for:</p>
          {PLATFORMS.map(p => {
            const active = cfg.platforms.includes(p.id)
            const PlatformIcon = p.icon
            return (
              <button
                key={p.id}
                onClick={() => togglePlatform(p.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px',
                  background: active ? 'rgba(124,106,255,.12)' : 'var(--s2)',
                  border: `1.5px solid ${active ? 'var(--accent)' : 'var(--b1)'}`,
                  borderRadius: 'var(--rs)', cursor: 'pointer', textAlign: 'left', transition: 'all .15s',
                }}
              >
                <PlatformIcon size={22} color={active ? 'var(--a2)' : 'var(--t2)'} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: active ? 'var(--a2)' : 'var(--t1)' }}>{p.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--t3)' }}>{p.desc}</div>
                </div>
                <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${active ? 'var(--accent)' : 'var(--b2)'}`, background: active ? 'var(--accent)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {active && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }} />}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Step 3 — Brand voice + review */}
      {step === 3 && (
        <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <BrandVoiceSlider value={cfg.brandVoice} onChange={v => update({ brandVoice: v })} />
          <div style={{ background: 'var(--s2)', border: '1px solid var(--b1)', borderRadius: 'var(--rs)', padding: 16 }}>
            <p style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.06em' }}>Summary</p>
            {[
              ['Event', cfg.eventName],
              ['Type', EVENT_TYPES.find(e => e.value === cfg.eventType)?.label ?? cfg.eventType],
              ['Platforms', cfg.platforms.join(', ')],
              ['Voice', cfg.brandVoice < 40 ? 'Professional' : cfg.brandVoice < 70 ? 'Balanced' : 'Casual'],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                <span style={{ color: 'var(--t3)' }}>{k}</span>
                <span style={{ color: 'var(--t1)', fontWeight: 500 }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'space-between' }}>
        <button
          onClick={() => setStep(s => s - 1)}
          disabled={step === 0}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', background: 'var(--s2)', border: '1px solid var(--b1)', borderRadius: 'var(--rs)', color: step === 0 ? 'var(--t3)' : 'var(--t2)', cursor: step === 0 ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500 }}
        >
          <ChevronLeft size={15} /> Back
        </button>

        {step < 3 ? (
          <button
            onClick={() => setStep(s => s + 1)}
            disabled={!canNext}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 22px', background: canNext ? 'var(--accent)' : 'var(--s3)', border: 'none', borderRadius: 'var(--rs)', color: canNext ? '#fff' : 'var(--t3)', cursor: canNext ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 600 }}
          >
            Next <ChevronRight size={15} />
          </button>
        ) : (
          <button
            onClick={() => onSubmit(cfg)}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 24px', background: loading ? 'var(--s3)' : 'linear-gradient(135deg,#7c6aff,#a78bfa)', border: 'none', borderRadius: 'var(--rs)', color: loading ? 'var(--t3)' : '#fff', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 700 }}
          >
            <Zap size={16} /> {loading ? 'Generating…' : 'Generate Content'}
          </button>
        )}
      </div>
    </div>
  )
}
