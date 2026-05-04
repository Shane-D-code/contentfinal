/**
 * StudioPage — Upload assets, configure event via wizard, run the full pipeline.
 * Shows live job progress with step-by-step icons then hands off to ResultsPage.
 */
import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, AlertTriangle, Sparkles } from 'lucide-react'
import DropZone from '../components/DropZone'
import FileQueue from '../components/upload/FileQueue'
import EventWizard, { type WizardConfig } from '../components/wizard/EventWizard'
import { Card, Btn, ProgressBar, Spinner } from '../components/ui'
import { useJobPolling } from '../hooks/useJobPolling'
import { generateAsync, getJobResult } from '../api'
import { toast } from '../components/ui/Toast'
import { useAnalytics } from '../contexts/AnalyticsContext'
import { saveJob } from '../lib/cache'
import type { JobStatus } from '../api'
import { JOB_STEPS } from '../lib/constants'

interface Props { onResult: (result: any, eventName: string) => void }

// Step-by-step progress display
const ORDERED_STEPS = [
  'queued', 'loading_models', 'processing_assets', 'ml_selection',
  'layout_assembly', 'copy_generation', 'case_study', 'finalising', 'done',
]

function StepProgress({ currentStep, pct, failed }: { currentStep: string; pct: number; failed?: boolean }) {
  const currentIdx = ORDERED_STEPS.indexOf(currentStep)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Overall bar */}
      <ProgressBar
        pct={pct}
        color={failed ? 'var(--red)' : 'var(--accent)'}
        label={failed ? 'Failed' : `${pct}%`}
      />

      {/* Step list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
        {ORDERED_STEPS.filter(s => s !== 'queued').map((step, i) => {
          const info = JOB_STEPS[step]
          const stepIdx = ORDERED_STEPS.indexOf(step)
          const isDone    = stepIdx < currentIdx
          const isActive  = step === currentStep
          const isFuture  = stepIdx > currentIdx

          return (
            <motion.div
              key={step}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '6px 10px', borderRadius: 8,
                background: isActive ? 'rgba(124,106,255,.12)' : 'transparent',
                border: `1px solid ${isActive ? 'rgba(124,106,255,.3)' : 'transparent'}`,
                transition: 'all .3s',
              }}
            >
              <span style={{ fontSize: 14, opacity: isFuture ? 0.3 : 1 }}>{info?.icon ?? '⚙️'}</span>
              <span style={{
                fontSize: 12,
                color: isDone ? 'var(--green)' : isActive ? 'var(--a2)' : 'var(--t3)',
                fontWeight: isActive ? 600 : 400,
                flex: 1,
              }}>
                {info?.label ?? step}
              </span>
              {isDone && <CheckCircle size={13} color="var(--green)" />}
              {isActive && <Spinner size={13} />}
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

export default function StudioPage({ onResult }: Props) {
  const [files, setFiles]     = useState<File[]>([])
  const [jobId, setJobId]     = useState<string | null>(null)
  const [error, setError]     = useState<string | null>(null)
  const [submitting, setSub]  = useState(false)
  const { trackEvent } = useAnalytics()

  const addFiles = useCallback((newFiles: File[]) => {
    setFiles(prev => {
      const existing = new Set(prev.map(f => f.name + f.size))
      const added = newFiles.filter(f => !existing.has(f.name + f.size))
      if (added.length < newFiles.length) {
        toast.warning(`${newFiles.length - added.length} duplicate(s) skipped`)
      }
      if (added.length > 0) {
        toast.success(`${added.length} file${added.length > 1 ? 's' : ''} added`)
      }
      return [...prev, ...added]
    })
  }, [])

  const removeFile = (name: string) => {
    setFiles(p => p.filter(f => f.name !== name))
  }

  const handleWizardSubmit = async (cfg: WizardConfig) => {
    if (!files.length) {
      toast.error('No files', 'Please upload at least one file first')
      return
    }
    setError(null)
    setSub(true)
    const loadingId = toast.loading('Submitting job…')

    try {
      const r = await generateAsync(files, cfg.eventName, cfg.eventDesc || cfg.eventName)
      setJobId(r.job_id)
      toast.dismiss(loadingId)
      toast.info('Job queued', `Backend: ${r.backend}`)
      trackEvent({ type: 'job_start', jobId: r.job_id })
    } catch (e: any) {
      toast.dismiss(loadingId)
      const msg = e?.response?.data?.detail ?? e.message ?? 'Submission failed'
      setError(msg)
      toast.error('Submission failed', msg)
    } finally {
      setSub(false)
    }
  }

  const handleDone = async (_s: JobStatus) => {
    if (!jobId) return
    try {
      const result = await getJobResult(jobId)
      saveJob({ id: jobId, eventName: result.event ?? 'Event', timestamp: Date.now(), fileCount: files.length, result })
      trackEvent({ type: 'job_complete', jobId })
      onResult(result, result.event ?? 'Event')
    } catch (e: any) {
      const msg = e?.response?.data?.detail ?? e.message
      setError(msg)
      toast.error('Failed to load results', msg)
    }
  }

  const handleFail = (msg: string) => {
    setError(msg)
    toast.error('Generation failed', msg)
  }

  const { pct, step, status } = useJobPolling(jobId, handleDone, handleFail)
  const isRunning = !!jobId && !['completed', 'SUCCESS', 'failed', 'FAILURE'].includes(status?.status ?? '')
  const isFailed  = status?.status === 'failed' || status?.status === 'FAILURE'
  const isDone    = status?.status === 'completed' || status?.status === 'SUCCESS'

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '40px 24px' }}>

      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{ textAlign: 'center', marginBottom: 48 }}
      >
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--s2)', border: '1px solid var(--b1)', borderRadius: 20, padding: '6px 16px', fontSize: 12, color: 'var(--a2)', marginBottom: 20 }}>
          <Sparkles size={13} /> AI-Powered Content Engine
        </div>
        <h1 style={{ fontSize: 'clamp(28px, 5vw, 42px)', fontWeight: 800, lineHeight: 1.15, marginBottom: 14 }}>
          Turn event photos into<br />
          <span className="grad">ready-to-post content</span>
        </h1>
        <p style={{ fontSize: 16, color: 'var(--t2)', maxWidth: 520, margin: '0 auto', lineHeight: 1.6 }}>
          Upload 50–150 photos & videos. Get LinkedIn posts, Instagram carousels, Reels, Stories, and a case study — automatically.
        </p>
      </motion.div>

      {/* Upload card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card style={{ marginBottom: 20 }}>
          <DropZone onFiles={addFiles} />
          <FileQueue files={files} onRemove={removeFile} />
        </Card>
      </motion.div>

      {/* Wizard / Config */}
      <AnimatePresence>
        {files.length > 0 && !jobId && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Card style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Configure Event</h2>
                  <p style={{ fontSize: 12, color: 'var(--t3)' }}>Set up your event details before generating</p>
                </div>
              </div>
              <EventWizard
                initialName=""
                onSubmit={handleWizardSubmit}
                loading={submitting}
              />
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Job progress */}
      <AnimatePresence>
        {jobId && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <Card style={{
              marginBottom: 20,
              border: `1px solid ${isFailed ? 'var(--red)' : isDone ? 'var(--green)' : 'var(--accent)'}`,
              background: isFailed ? 'rgba(239,68,68,.04)' : isDone ? 'rgba(16,185,129,.04)' : 'rgba(124,106,255,.04)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                {isRunning
                  ? <Spinner size={18} />
                  : isFailed
                  ? <AlertTriangle size={18} color="var(--red)" />
                  : <CheckCircle size={18} color="var(--green)" />
                }
                <span style={{ fontWeight: 700, fontSize: 15, color: isFailed ? 'var(--red)' : isDone ? 'var(--green)' : 'var(--t1)' }}>
                  {isFailed ? 'Generation failed' : isDone ? 'Generation complete!' : 'Generating content…'}
                </span>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--t3)', background: 'var(--s2)', borderRadius: 5, padding: '2px 8px' }}>
                  {status?.backend === 'celery' ? '⚡ Celery' : '🔄 In-process'}
                </span>
              </div>

              <StepProgress currentStep={step} pct={pct} failed={isFailed} />

              <p style={{ fontSize: 10, color: 'var(--t3)', marginTop: 10, fontFamily: 'monospace' }}>
                job: {jobId}
              </p>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <Card style={{ marginBottom: 20, borderColor: 'var(--red)', background: 'rgba(239,68,68,.05)' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <AlertTriangle size={16} color="var(--red)" style={{ flexShrink: 0, marginTop: 2 }} />
                <div style={{ flex: 1 }}>
                  <p style={{ color: 'var(--red)', fontWeight: 600, marginBottom: 4 }}>Error</p>
                  <p style={{ color: '#fca5a5', fontSize: 13 }}>{error}</p>
                </div>
              </div>
              <Btn variant="ghost" size="sm" style={{ marginTop: 10 }} onClick={() => { setError(null); setJobId(null) }}>
                Try again
              </Btn>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* What you'll get — shown when no job running */}
      {!jobId && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          style={{ marginTop: 40 }}
        >
          <p style={{ fontSize: 12, color: 'var(--t3)', textAlign: 'center', marginBottom: 20, textTransform: 'uppercase', letterSpacing: '.08em' }}>
            What gets generated
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12 }}>
            {[
              { icon: '💼', title: 'LinkedIn Post',       desc: '4–6 image collage + professional copy' },
              { icon: '📸', title: 'Instagram Carousel',  desc: 'Up to 10 slides, 4:5 ratio' },
              { icon: '🎬', title: 'Instagram Reel',      desc: '30–60s highlight video' },
              { icon: '📱', title: 'Instagram Stories',   desc: '3–4 vertical frames with captions' },
              { icon: '📄', title: 'Case Study',          desc: 'Structured Markdown document' },
              { icon: '📊', title: 'Selection Report',    desc: 'AI reasoning for every asset' },
            ].map(({ icon, title, desc }) => (
              <motion.div
                key={title}
                whileHover={{ y: -3, boxShadow: 'var(--shadow-glow)' }}
                style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: 'var(--r)', padding: 16, cursor: 'default', transition: 'border-color .2s' }}
              >
                <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{title}</div>
                <div style={{ fontSize: 12, color: 'var(--t3)', lineHeight: 1.5 }}>{desc}</div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  )
}
