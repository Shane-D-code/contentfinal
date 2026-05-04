import { useState, useEffect, useRef, useCallback } from 'react'
import { getJobStatus } from '../api'
import type { JobStatus } from '../api'

/**
 * Polls /api/jobs/{jobId}/status every 2 seconds until terminal state.
 *
 * Root cause of ERR_INSUFFICIENT_RESOURCES fix:
 *   onDone/onFail are inline arrow functions — they get a new reference on
 *   every parent render, which caused poll → useEffect deps to change every
 *   render, restarting the interval hundreds of times per second.
 *
 * Fix: store callbacks in refs so they never appear in dependency arrays.
 *   The interval is started exactly once per jobId change.
 */
export function useJobPolling(
  jobId: string | null,
  onDone?: (s: JobStatus) => void,
  onFail?: (e: string) => void,
) {
  const [status, setStatus] = useState<JobStatus | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Store callbacks in refs — never stale, never trigger re-renders
  const onDoneRef = useRef(onDone)
  const onFailRef = useRef(onFail)
  useEffect(() => { onDoneRef.current = onDone }, [onDone])
  useEffect(() => { onFailRef.current = onFail }, [onFail])

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  // Restart interval only when jobId changes
  useEffect(() => {
    if (!jobId) {
      stopPolling()
      setStatus(null)
      return
    }

    let cancelled = false

    const poll = async () => {
      if (cancelled) return
      try {
        const s = await getJobStatus(jobId)
        if (cancelled) return
        setStatus(s)

        if (['completed', 'SUCCESS'].includes(s.status)) {
          stopPolling()
          onDoneRef.current?.(s)
        } else if (['failed', 'FAILURE'].includes(s.status)) {
          stopPolling()
          onFailRef.current?.(s.error ?? 'Job failed')
        }
      } catch {
        // Network hiccup — keep polling, don't crash
      }
    }

    poll() // immediate first poll
    intervalRef.current = setInterval(poll, 2000)

    return () => {
      cancelled = true
      stopPolling()
    }
  }, [jobId, stopPolling]) // ← only jobId here, NOT poll/onDone/onFail

  const pct  = status?.progress?.pct  ?? _toPct(status?.status)
  const step = status?.progress?.step ?? _toStep(status?.status)
  const polling = !!intervalRef.current

  return { status, polling, pct, step }
}

function _toPct(s?: string) {
  if (s === 'completed' || s === 'SUCCESS')  return 100
  if (s === 'PROGRESS')                      return 60
  if (s === 'running'  || s === 'STARTED')   return 30
  return 5
}

function _toStep(s?: string) {
  if (s === 'completed' || s === 'SUCCESS') return 'Done'
  if (s === 'running'   || s === 'STARTED') return 'Processing…'
  if (s === 'failed'    || s === 'FAILURE') return 'Failed'
  return 'Queued'
}
