import { useState, useEffect, lazy, Suspense } from 'react'
import type React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, AlertCircle, Sun, Moon, BarChart3, Home, FileText } from 'lucide-react'
import { checkHealth } from './api'
import { ThemeProvider, useTheme } from './contexts/ThemeContext'
import { JobProvider } from './contexts/JobContext'
import { AnalyticsProvider } from './contexts/AnalyticsContext'
import { ToastProvider } from './components/ui/Toast'
import { toast } from './components/ui/Toast'
import BottomNav from './components/navigation/BottomNav'
import { useIsMobile } from './hooks/useMediaQuery'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { Skeleton } from './components/ui/Skeleton'

// Lazy-load heavy pages
const StudioPage    = lazy(() => import('./pages/StudioPage'))
const ResultsPage   = lazy(() => import('./pages/ResultsPage'))
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'))

export type View = 'studio' | 'results' | 'analytics'

const PageFallback = () => (
  <div style={{ maxWidth: 860, margin: '0 auto', padding: '40px 24px' }}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Skeleton height={48} width="60%" />
      <Skeleton height={200} />
      <Skeleton height={120} />
    </div>
  </div>
)

// Inner app that can use ThemeContext
function AppInner() {
  const [view, setView]       = useState<View>('studio')
  const [result, setResult]   = useState<any>(null)
  const [eventName, setEvent] = useState('')
  const [apiOk, setApiOk]     = useState<boolean | null>(null)
  const { resolvedTheme, setTheme, theme } = useTheme()
  const isMobile = useIsMobile()

  useEffect(() => {
    checkHealth()
      .then(() => setApiOk(true))
      .catch(() => {
        setApiOk(false)
        toast.error('Backend offline', 'Start the API server to use the app')
      })
  }, [])

  const handleResult = (r: any, name: string) => {
    setResult(r)
    setEvent(name)
    setView('results')
    toast.success('Content generated!', `${name} is ready to review`)
  }

  // Keyboard shortcuts
  useKeyboardShortcuts([
    { key: 'h', ctrl: true, action: () => setView('studio'),    description: 'Go to Studio' },
    { key: 'a', ctrl: true, action: () => setView('analytics'), description: 'Go to Analytics' },
    { key: 'r', ctrl: true, action: () => result && setView('results'), description: 'Go to Results' },
  ])

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark'
    setTheme(next)
    toast.info(`Theme: ${next}`)
  }

  const themeIcon = resolvedTheme === 'dark' ? <Sun size={14} /> : <Moon size={14} />

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Skip link for a11y */}
      <a href="#main-content" className="skip-link">Skip to content</a>

      {/* Nav */}
      <nav
        role="navigation"
        aria-label="Main navigation"
        style={{
          borderBottom: '1px solid var(--b1)',
          background: 'rgba(7,7,13,.92)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
          padding: '0 24px',
        }}
      >
        <div style={{ maxWidth: 1100, margin: '0 auto', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Logo */}
          <button
            onClick={() => setView('studio')}
            aria-label="Go to Studio"
            style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
          >
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,#7c6aff,#a78bfa)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Zap size={16} color="#fff" />
            </div>
            <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--t1)' }}>Content Engine</span>
            <span style={{ fontSize: 11, color: 'var(--t3)', background: 'var(--s2)', borderRadius: 5, padding: '2px 8px', border: '1px solid var(--b1)' }}>AI</span>
          </button>

          {/* Desktop nav links */}
          {!isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {(
                [
                  { id: 'studio'    as View, label: 'Studio',    icon: <Home size={14} />,      disabled: false },
                  { id: 'results'   as View, label: 'Results',   icon: <FileText size={14} />,  disabled: !result },
                  { id: 'analytics' as View, label: 'Analytics', icon: <BarChart3 size={14} />, disabled: false },
                ] as { id: View; label: string; icon: React.ReactNode; disabled: boolean }[]
              ).map(item => (
                <button
                  key={item.id}
                  onClick={() => !item.disabled && setView(item.id)}
                  disabled={item.disabled}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '6px 14px', borderRadius: 'var(--rs)', border: 'none',
                    background: view === item.id ? 'rgba(124,106,255,.15)' : 'transparent',
                    color: item.disabled ? 'var(--t3)' : view === item.id ? 'var(--a2)' : 'var(--t2)',
                    cursor: item.disabled ? 'not-allowed' : 'pointer',
                    fontSize: 13, fontWeight: view === item.id ? 600 : 400,
                    transition: 'all .15s',
                  }}
                >
                  {item.icon} {item.label}
                </button>
              ))}
            </div>
          )}

          {/* Right controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              aria-label={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
              title="Toggle theme (Ctrl+T)"
              style={{ background: 'var(--s2)', border: '1px solid var(--b1)', borderRadius: 'var(--rs)', padding: '6px 10px', color: 'var(--t2)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}
            >
              {themeIcon}
            </button>

            {/* API status */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }} aria-live="polite">
              <div style={{
                width: 7, height: 7, borderRadius: '50%',
                background: apiOk === null ? 'var(--yellow)' : apiOk ? 'var(--green)' : 'var(--red)',
                animation: apiOk === null ? 'pulse 1s infinite' : 'none',
              }} />
              <span style={{ color: 'var(--t3)' }}>
                {apiOk === null ? 'Connecting…' : apiOk ? 'API ready' : 'API offline'}
              </span>
            </div>
          </div>
        </div>
      </nav>

      {/* Offline banner */}
      <AnimatePresence>
        {apiOk === false && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{ background: '#450a0a', borderBottom: '1px solid #7f1d1d', overflow: 'hidden' }}
          >
            <div style={{ padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <AlertCircle size={15} color="#fca5a5" />
              <span style={{ fontSize: 13, color: '#fca5a5' }}>
                Backend not reachable. Run:{' '}
                <code style={{ background: '#7f1d1d', borderRadius: 4, padding: '1px 8px', fontFamily: 'monospace' }}>
                  uvicorn api.main:app --reload
                </code>
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content */}
      <main id="main-content" style={{ flex: 1 }}>
        <Suspense fallback={<PageFallback />}>
          <AnimatePresence mode="wait">
            {view === 'studio' && (
              <motion.div
                key="studio"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
              >
                <StudioPage onResult={handleResult} />
              </motion.div>
            )}
            {view === 'results' && result && (
              <motion.div
                key="results"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
              >
                <ResultsPage result={result} eventName={eventName} onBack={() => setView('studio')} />
              </motion.div>
            )}
            {view === 'analytics' && (
              <motion.div
                key="analytics"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
              >
                <AnalyticsPage />
              </motion.div>
            )}
          </AnimatePresence>
        </Suspense>
      </main>

      {/* Mobile bottom nav */}
      {isMobile && <BottomNav view={view} onViewChange={setView} hasResults={!!result} />}

      {/* Footer */}
      {!isMobile && (
        <footer style={{ borderTop: '1px solid var(--b1)', padding: '14px 24px', textAlign: 'center', fontSize: 12, color: 'var(--t3)' }}>
          Content & Design Engine · AI-powered social media automation
        </footer>
      )}
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <JobProvider>
        <AnalyticsProvider>
          <AppInner />
          <ToastProvider />
        </AnalyticsProvider>
      </JobProvider>
    </ThemeProvider>
  )
}
