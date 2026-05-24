/**
 * StudioPage — Upload assets, configure event via wizard, run the full pipeline.
 * Shows live job progress with step-by-step icons then hands off to ResultsPage.
 */
import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Variants } from 'framer-motion'
import { BarChart3, BriefcaseBusiness, Camera, CheckCircle, FileText, Film, Folder, Image, RefreshCw, Smartphone, AlertTriangle, Zap } from 'lucide-react'
import DropZone from '../components/DropZone'
import FileQueue from '../components/upload/FileQueue'
import BrandSegregationPanel from '../components/BrandSegregationPanel'
import EventWizard, { type WizardConfig } from '../components/wizard/EventWizard'
import { Card, Btn, ProgressBar, Spinner } from '../components/ui'
import { useJobPolling } from '../hooks/useJobPolling'
import { generateAsync, generateFast, getJobResult } from '../api'
import { toast } from '../components/ui/Toast'
import { useAnalytics } from '../contexts/AnalyticsContext'
import { saveJob } from '../lib/cache'
import type { JobStatus } from '../api'
import { JOB_STEPS } from '../lib/constants'

interface Props { onResult: (data: { result: any; eventName: string; files: File[]; jobId: string }) => void }

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
          const StepIcon = info?.icon ?? Folder
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
              <StepIcon size={14} style={{ opacity: isFuture ? 0.3 : 1, flexShrink: 0 }} />
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
  const [brandMode, setBrandMode] = useState(false)
  const [brands, setBrands] = useState<string[]>(['', '', '', ''])
  const [selectedBrand, setSelectedBrand] = useState('')
  const [renderFilesByBrand, setRenderFilesByBrand] = useState<File[][]>([[], [], [], []])
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

    const cleanBrands = brands.map(b => b.trim())
    if (brandMode) {
      if (cleanBrands.filter(Boolean).length !== 4) {
        toast.error('Brand setup incomplete', 'Enter all four brand names before generating.')
        return
      }
      if (!selectedBrand || !cleanBrands.includes(selectedBrand)) {
        toast.error('Select content focus', 'Choose which brand should be prioritized.')
        return
      }
      const missingRenderBrands = cleanBrands.filter((_, i) => (renderFilesByBrand[i]?.length ?? 0) === 0)
      if (missingRenderBrands.length) {
        toast.error('Render images missing', `Add render/logo images for: ${missingRenderBrands.join(', ')}`)
        return
      }
    }

    setError(null)
    setSub(true)
    const loadingId = toast.loading('Submitting job…')

    try {
      const r = brandMode
        ? await generateFast(files, {
            eventName: cfg.eventName,
            eventDescription: cfg.eventDesc || cfg.eventName,
            mode: 'gff',
            brands: cleanBrands,
            selectedBrand,
            renderFilesByBrand,
            generateReel: cfg.platforms.includes('reel'),
          })
        : await generateAsync(files, cfg.eventName, cfg.eventDesc || cfg.eventName)
      setJobId(r.job_id)
      toast.dismiss(loadingId)
      toast.info(brandMode ? 'Brand job queued' : 'Job queued', `Backend: ${r.backend}`)
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
      // Call onResult with data to go to asset selection
      onResult({ result, eventName: result.event ?? 'Event', files, jobId })
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

  const updateRenderFiles = (index: number, nextFiles: File[]) => {
    setRenderFilesByBrand(prev => {
      const next = [...prev]
      next[index] = nextFiles
      return next
    })
  }

  const { pct, step, status } = useJobPolling(jobId, handleDone, handleFail)
  const isRunning = !!jobId && !['completed', 'SUCCESS', 'failed', 'FAILURE'].includes(status?.status ?? '')
  const isFailed  = status?.status === 'failed' || status?.status === 'FAILURE'
  const isDone    = status?.status === 'completed' || status?.status === 'SUCCESS'

  const imageCount = files.filter(f => f.type.startsWith('image/')).length
  const videoCount = files.filter(f => f.type.startsWith('video/')).length

  // Framer Motion variants
  const itemVariants: Variants = {
    initial: { opacity: 0, y: 20 },
    animate: {
      opacity: 1,
      y: 0,
      transition: { type: "spring", stiffness: 100, damping: 20 }
    }
  }

  const expandVariants: Variants = {
    initial: { opacity: 0, height: 0 },
    animate: {
      opacity: 1,
      height: "auto",
      transition: { type: "spring", stiffness: 150, damping: 20 }
    },
    exit: {
      opacity: 0,
      height: 0,
      transition: { duration: 0.2 }
    }
  }

  return (
    <div className="studio-container fade-in">

      {/* Studio Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="studio-header">
          <div className="header-title">
            <h1>Studio</h1>
            <p>Upload media and generate AI-powered content</p>
          </div>
          <div className="toggle-container">
            <span className="toggle-label">Brand Segregation</span>
            <div
              className={`toggle-switch ${brandMode ? 'active' : ''}`}
              onClick={() => {
                if (!jobId) setBrandMode(!brandMode)
              }}
            >
              <div className="toggle-knob" />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Upload Zone */}
      <motion.div
        variants={itemVariants}
        initial="initial"
        animate="animate"
      >
        <Card style={{ marginBottom: 20, background: 'var(--bg-card-glass)', borderColor: 'var(--border-default)' }}>
          <DropZone onFiles={addFiles} />
          <FileQueue files={files} onRemove={removeFile} />
        </Card>
      </motion.div>

      {/* Stats Bar */}
      <AnimatePresence>
        {files.length > 0 && !jobId && (
          <motion.div
            variants={expandVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="fade-in"
          >
            <div className="stats-bar">
              <div className="stat-item"><div className="stat-icon"><Camera size={18} /></div><div className="stat-info"><span className="stat-value">{imageCount}</span><span className="stat-label">Images</span></div></div>
              <div className="stat-item"><div className="stat-icon"><Film size={18} /></div><div className="stat-info"><span className="stat-value">{videoCount}</span><span className="stat-label">Videos</span></div></div>
              <div className="stat-item"><div className="stat-icon"><Folder size={18} /></div><div className="stat-info"><span className="stat-value">{files.length}</span><span className="stat-label">Total Files</span></div></div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Brand Segregation Expandable Section */}
      <AnimatePresence>
        {brandMode && files.length > 0 && !jobId && (
          <motion.div
            variants={expandVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="expandable-section fade-in"
          >
            <div className="expandable-content">
              <BrandSegregationPanel
                brands={brands}
                selectedBrand={selectedBrand}
                renderFilesByBrand={renderFilesByBrand}
                onBrandsChange={setBrands}
                onSelectedBrandChange={setSelectedBrand}
                onRenderFilesChange={updateRenderFiles}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Wizard / Config */}
      <AnimatePresence>
        {files.length > 0 && !jobId && (
          <motion.div
            variants={expandVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <Card style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Configure Event</h2>
                  <p style={{ fontSize: 12, color: 'var(--t3)' }}>
                    {brandMode ? 'Brand mode will segregate event photos by visual references before generating content.' : 'Set up your event details before generating'}
                  </p>
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
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {status?.backend === 'celery' ? <Zap size={11} /> : <RefreshCw size={11} />}
                    {status?.backend === 'celery' ? 'Celery' : 'In-process'}
                  </span>
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
              { icon: BriefcaseBusiness, title: 'LinkedIn Post',       desc: '4-6 image collage + professional copy' },
              { icon: Image, title: 'Instagram Carousel',  desc: 'Up to 10 slides, 4:5 ratio' },
              { icon: Film, title: 'Instagram Reel',      desc: '30-60s highlight video' },
              { icon: Smartphone, title: 'Instagram Stories',   desc: '3-4 vertical frames with captions' },
              { icon: FileText, title: 'Case Study',          desc: 'Structured Markdown document' },
              { icon: BarChart3, title: 'Selection Report',    desc: 'AI reasoning for every asset' },
            ].map(({ icon: OutputIcon, title, desc }) => (
              <motion.div
                key={title}
                whileHover={{ y: -3, boxShadow: 'var(--shadow-glow)' }}
                style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: 'var(--r)', padding: 16, cursor: 'default', transition: 'border-color .2s' }}
              >
                <div style={{ marginBottom: 8, color: 'var(--accent)' }}><OutputIcon size={28} /></div>
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
