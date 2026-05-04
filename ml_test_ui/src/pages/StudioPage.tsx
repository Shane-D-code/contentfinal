/**
 * Studio Page — Upload assets, configure event, run the full pipeline.
 * Shows live job progress then hands off to ResultsPage.
 */
import { useState, useCallback } from 'react'
import { Zap, X, Image, Film, AlertTriangle, CheckCircle, ChevronRight } from 'lucide-react'
import DropZone from '../components/DropZone'
import { Card, Btn, Input, ProgressBar, Spinner, SectionTitle, Tag } from '../components/ui'
import { useJobPolling } from '../hooks/useJobPolling'
import { generateAsync, getJobResult } from '../api'
import type { JobStatus } from '../api'

const STEP_LABELS: Record<string,string> = {
  queued:'Queued — waiting for worker',
  loading_models:'Loading ML models…',
  processing_assets:'Scoring assets with AI…',
  ml_selection:'Running selection pipeline…',
  layout_assembly:'Assembling platform layouts…',
  copy_generation:'Writing captions…',
  case_study:'Generating case study…',
  finalising:'Finalising outputs…',
  done:'Complete ✓',
}

interface Props { onResult: (result: any, eventName: string) => void }

export default function StudioPage({ onResult }: Props) {
  const [files, setFiles]       = useState<File[]>([])
  const [eventName, setName]    = useState('')
  const [eventDesc, setDesc]    = useState('')
  const [jobId, setJobId]       = useState<string|null>(null)
  const [error, setError]       = useState<string|null>(null)
  const [submitting, setSub]    = useState(false)

  const addFiles = useCallback((newFiles: File[]) => {
    setFiles(prev => {
      const existing = new Set(prev.map(f => f.name))
      return [...prev, ...newFiles.filter(f => !existing.has(f.name))]
    })
  }, [])

  const removeFile = (name: string) => setFiles(p => p.filter(f => f.name !== name))

  const handleSubmit = async () => {
    if (!files.length || !eventName.trim()) return
    setError(null); setSub(true)
    try {
      const r = await generateAsync(files, eventName, eventDesc || eventName)
      setJobId(r.job_id)
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e.message)
    } finally {
      setSub(false)
    }
  }

  const handleDone = async (s: JobStatus) => {
    if (!jobId) return
    try {
      const result = await getJobResult(jobId)
      onResult(result, eventName)
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e.message)
    }
  }

  const { pct, step, status } = useJobPolling(jobId, handleDone, setError)
  const isRunning = !!jobId && !['completed','SUCCESS','failed','FAILURE'].includes(status?.status ?? '')
  const images = files.filter(f => f.type.startsWith('image/'))
  const videos = files.filter(f => f.type.startsWith('video/'))

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '40px 24px' }}>
      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: 48 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--s2)', border: '1px solid var(--b1)', borderRadius: 20, padding: '6px 16px', fontSize: 12, color: 'var(--a2)', marginBottom: 20 }}>
          <Zap size={13} /> AI-Powered Content Engine
        </div>
        <h1 style={{ fontSize: 42, fontWeight: 800, lineHeight: 1.15, marginBottom: 14 }}>
          Turn event photos into<br /><span className="grad">ready-to-post content</span>
        </h1>
        <p style={{ fontSize: 16, color: 'var(--t2)', maxWidth: 520, margin: '0 auto' }}>
          Upload 50–150 photos & videos. Get LinkedIn posts, Instagram carousels, Reels, Stories, and a case study — automatically.
        </p>
      </div>

      {/* Upload card */}
      <Card style={{ marginBottom: 20 }}>
        <DropZone onFiles={addFiles} />

        {files.length > 0 && (
          <div style={{ marginTop: 16 }}>
            {/* Stats row */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
              <Tag label={`${files.length} files total`} color="var(--accent)" />
              {images.length > 0 && <Tag label={`${images.length} images`} color="var(--blue)" />}
              {videos.length > 0 && <Tag label={`${videos.length} videos`} color="var(--pink)" />}
              <DropZone onFiles={addFiles} compact label="Add more" />
            </div>

            {/* File list */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 8, maxHeight: 200, overflowY: 'auto' }}>
              {files.map(f => (
                <div key={f.name} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--s2)', borderRadius: 'var(--rs)', padding: '7px 10px' }}>
                  {f.type.startsWith('video/') ? <Film size={13} color="var(--pink)" /> : <Image size={13} color="var(--blue)" />}
                  <span style={{ fontSize: 12, color: 'var(--t2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                  <X size={12} color="var(--t3)" style={{ cursor: 'pointer', flexShrink: 0 }} onClick={() => removeFile(f.name)} />
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Event config */}
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Input label="Event Name *" value={eventName} onChange={setName} placeholder="Tech Summit 2024" />
          <Input label="Description (optional)" value={eventDesc} onChange={setDesc} placeholder="Annual tech conference with keynotes…" />
        </div>
      </Card>

      {/* Job progress */}
      {jobId && (
        <Card style={{ marginBottom: 20, border: `1px solid ${isRunning ? 'var(--accent)' : status?.status === 'failed' ? 'var(--red)' : 'var(--green)'}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            {isRunning ? <Spinner size={18} /> : status?.status === 'failed' ? <AlertTriangle size={18} color="var(--red)" /> : <CheckCircle size={18} color="var(--green)" />}
            <span style={{ fontWeight: 600, fontSize: 14 }}>
              {isRunning ? (STEP_LABELS[step] ?? step ?? 'Processing…') : status?.status === 'failed' ? 'Generation failed' : 'Generation complete!'}
            </span>
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--t3)', background: 'var(--s2)', borderRadius: 5, padding: '2px 8px' }}>
              {status?.backend === 'celery' ? '⚡ Celery' : '🔄 In-process'}
            </span>
          </div>
          <ProgressBar pct={pct} color={status?.status === 'failed' ? 'var(--red)' : 'var(--accent)'} />
          <p style={{ fontSize: 11, color: 'var(--t3)', marginTop: 8, fontFamily: 'monospace' }}>job: {jobId}</p>
        </Card>
      )}

      {error && (
        <Card style={{ marginBottom: 20, borderColor: 'var(--red)', background: '#1a0505' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <AlertTriangle size={16} color="var(--red)" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <p style={{ color: 'var(--red)', fontWeight: 600, marginBottom: 4 }}>Error</p>
              <p style={{ color: '#fca5a5', fontSize: 13 }}>{error}</p>
            </div>
          </div>
          <Btn variant="ghost" size="sm" style={{ marginTop: 10 }} onClick={() => { setError(null); setJobId(null) }}>Try again</Btn>
        </Card>
      )}

      {/* Submit */}
      <Btn
        size="lg" full
        disabled={!files.length || !eventName.trim() || submitting || isRunning}
        onClick={handleSubmit}
        style={{ fontSize: 16 }}
      >
        {submitting ? <><Spinner size={18} /> Submitting…</> : isRunning ? <><Spinner size={18} /> Generating content…</> : <><Zap size={18} /> Generate All Content <ChevronRight size={16} /></>}
      </Btn>

      {/* What you'll get */}
      {!jobId && (
        <div style={{ marginTop: 40 }}>
          <p style={{ fontSize: 12, color: 'var(--t3)', textAlign: 'center', marginBottom: 20, textTransform: 'uppercase', letterSpacing: '.08em' }}>What gets generated</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12 }}>
            {[
              { icon: '💼', title: 'LinkedIn Post', desc: '4–6 image collage + professional copy' },
              { icon: '📸', title: 'Instagram Carousel', desc: 'Up to 10 slides, 4:5 ratio' },
              { icon: '🎬', title: 'Instagram Reel', desc: '30–60s highlight video' },
              { icon: '📱', title: 'Instagram Stories', desc: '3–4 vertical frames with captions' },
              { icon: '📄', title: 'Case Study', desc: 'Structured Markdown document' },
              { icon: '📊', title: 'Selection Report', desc: 'AI reasoning for every asset' },
            ].map(({ icon, title, desc }) => (
              <div key={title} style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: 'var(--r)', padding: 16 }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{title}</div>
                <div style={{ fontSize: 12, color: 'var(--t3)' }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
