import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { toast } from 'react-hot-toast'
import type { JobStatus } from '../api'

// Types (extend existing)
interface JobState {
  jobId: string | null
  status: JobStatus | null
  progress: number
  step: string
  error: string | null
  isConnected: boolean
}

interface JobContextType {
  job: JobState
  startJob: (jobId: string) => void
  cancelJob: () => void
  retryJob: () => void
}

// Default state
const defaultJob: JobState = {
  jobId: null,
  status: null,
  progress: 0,
  step: '',
  error: null,
  isConnected: false,
}

// Context
const JobContext = createContext<JobContextType | undefined>(undefined)

// Provider
export function JobProvider({ children }: { children: ReactNode }) {
  const [job, setJob] = useState<JobState>(defaultJob)
  const [ws, setWs] = useState<WebSocket | null>(null)

  // WS connect
  const connectJobWS = useCallback((jobId: string) => {
    if (ws) ws.close()

    const url = `ws://localhost:8000/ws/jobs/${jobId}`
    const socket = new WebSocket(url)

    socket.onopen = () => {
      setJob(prev => ({ ...prev, isConnected: true, error: null }))
      toast.success('Connected to job updates')
    }

    socket.onmessage = (event) => {
      const data: JobStatus & { progress?: number; step?: string } = JSON.parse(event.data)
      setJob(prev => ({
        ...prev,
        status: data,
        progress: data.progress || prev.progress,
        step: data.step || prev.step,
        error: data.error || null,
      }))

      if (data.status === 'completed') {
        toast.success('Job complete!')
      } else if (data.status === 'failed') {
        toast.error(`Job failed: ${data.error || 'Unknown error'}`)
      }
    }

    socket.onclose = () => {
      setJob(prev => ({ ...prev, isConnected: false }))
      toast('Job connection closed')
    }

    socket.onerror = (err) => {
      console.error('WS error:', err)
      setJob(prev => ({ ...prev, isConnected: false, error: 'Connection failed' }))
      toast.error('Lost connection to job updates')
    }

    setWs(socket)
  }, [ws])

  const startJob = (jobId: string) => {
    setJob({ jobId, status: null, progress: 0, step: '', error: null, isConnected: false })
    connectJobWS(jobId)
  }

  const cancelJob = () => {
    if (ws) {
      ws.close()
      setWs(null)
    }
    setJob(defaultJob)
  }

  const retryJob = () => {
    if (job.jobId) startJob(job.jobId)
  }

  useEffect(() => {
    return () => {
      if (ws) ws.close()
    }
  }, [])

  return (
    <JobContext.Provider value={{ job, startJob, cancelJob, retryJob }}>
      {children}
    </JobContext.Provider>
  )
}

// Hook
export function useJob() {
  const context = useContext(JobContext)
  if (!context) throw new Error('useJob must be used within JobProvider')
  return context
}

