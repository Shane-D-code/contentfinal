/**
 * JobStatus — shows live progress for an async job.
 * Displays a progress bar, current step, and backend indicator.
 * Used in PipelineTab and GenerateTab when async mode is active.
 */
import { CheckCircle, XCircle, Loader } from 'lucide-react'
import { useJobPolling } from '../hooks/useJobPolling'
import type { JobStatus as JobStatusType } from '../api'

interface Props {
  jobId: string
  onComplete: (status: JobStatusType) => void
  onError?: (msg: string) => void
}

const STEP_LABELS: Record<string, string> = {
  queued:           'Queued — waiting for worker',
  loading_models:   'Loading ML models…',
  processing_assets:'Scoring assets…',
  ml_selection:     'Running ML selection…',
  layout_assembly:  'Assembling layouts…',
  copy_generation:  'Generating captions…',
  case_study:       'Writing case study…',
  serialising:      'Finalising results…',
  finalising:       'Finalising…',
  done:             'Complete',
}

export default function JobStatus({ jobId, onComplete, onError }: Props) {
  const { status, isPolling, pct, step, error } = useJobPolling(jobId, {
    onComplete,
    onError,
  })

  const label = STEP_LABELS[step] ?? step ?? 'Processing…'
  const failed = status?.status === 'failed' || status?.status === 'FAILURE'
  const done   = status?.status === 'completed' || status?.status === 'SUCCESS'

  return (
    <div style={{
      background: '#1a1d27',
      border: `1px solid ${failed ? '#7f1d1d' : done ? '#14532d' : '#2e3250'}`,
      borderRadius: 12,
      padding: '18px 20px',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        {failed
          ? <XCircle size={18} color="#ef4444" />
          : done
          ? <CheckCircle size={18} color="#22c55e" />
          : <Loader size={18} color="#6c63ff" style={{ animation: 'spin 1s linear infinite' }} />
        }
        <span style={{ fontWeight: 600, fontSize: 14, color: failed ? '#ef4444' : done ? '#22c55e' : '#e2e8f0' }}>
          {failed ? 'Job failed' : done ? 'Complete' : label}
        </span>
        {status?.backend && (
          <span style={{
            marginLeft: 'auto', fontSize: 11, color: '#475569',
            background: '#22263a', borderRadius: 5, padding: '2px 8px',
          }}>
            {status.backend === 'celery' ? '⚡ Celery' : '🔄 In-process'}
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div style={{ height: 6, background: '#22263a', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: failed ? '#ef4444' : done ? '#22c55e' : '#6c63ff',
          borderRadius: 3,
          transition: 'width 0.4s ease',
        }} />
      </div>

      {/* Percentage + step */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11, color: '#64748b' }}>
        <span>{label}</span>
        <span>{pct}%</span>
      </div>

      {/* Error message */}
      {error && (
        <p style={{ marginTop: 10, fontSize: 12, color: '#ef4444', background: '#450a0a', borderRadius: 6, padding: '8px 12px' }}>
          {error}
        </p>
      )}

      {/* Job ID for debugging */}
      <p style={{ marginTop: 8, fontSize: 10, color: '#334155', fontFamily: 'monospace' }}>
        job: {jobId}
      </p>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
