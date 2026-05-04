import { useState, useEffect } from 'react'
import { Zap, AlertCircle, Sun, Moon } from 'lucide-react'
import StudioPage from './pages/StudioPage'
import ResultsPage from './pages/ResultsPage'
import AnalyticsPage from './pages/AnalyticsPage'
import BottomNav from './components/navigation/BottomNav'
import { checkHealth } from './api'
import { ThemeProvider } from './contexts/ThemeContext'
import { JobProvider } from './contexts/JobContext'
import { AnalyticsProvider } from './contexts/AnalyticsContext'
import { useTheme } from './contexts/ThemeContext'

type View = 'studio' | 'results' | 'analytics'

export default function App() {
  const [view, setView]         = useState<View>('studio')
  const [result, setResult]     = useState<any>(null)
  const [eventName, setEvent]   = useState('')
  const [apiOk, setApiOk]       = useState<boolean|null>(null)

  useEffect(() => {
    checkHealth()
      .then(() => setApiOk(true))
      .catch(() => setApiOk(false))
  }, [])

  const handleResult = (r: any, name: string) => {
    setResult(r)
    setEvent(name)
    setView('results')
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Nav */}
      <nav style={{ borderBottom: '1px solid var(--b1)', background: 'rgba(7,7,13,.9)', backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 100, padding: '0 24px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => setView('studio')}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,#7c6aff,#a78bfa)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Zap size={16} color="#fff" />
            </div>
            <span style={{ fontWeight: 700, fontSize: 15 }}>Content Engine</span>
            <span style={{ fontSize: 11, color: 'var(--t3)', background: 'var(--s2)', borderRadius: 5, padding: '2px 8px', border: '1px solid var(--b1)' }}>AI</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            {view === 'results' && (
              <button onClick={() => setView('studio')} style={{ background: 'var(--s2)', border: '1px solid var(--b1)', borderRadius: 'var(--rs)', padding: '7px 14px', color: 'var(--t2)', fontSize: 13, cursor: 'pointer' }}>
                ← New Event
              </button>
            )}
            <button 
              onClick={() => {
                const html = document.documentElement
                html.classList.toggle('dark')
              }}
              style={{ 
                background: 'var(--s2)', 
                border: '1px solid var(--b1)', 
                borderRadius: 'var(--rs)', 
                padding: '6px 12px', 
                color: 'var(--t2)', 
                cursor: 'pointer',
                fontSize: 13,
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}
              title="Toggle theme"
            >
              <Sun size={14} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: apiOk === null ? 'var(--yellow)' : apiOk ? 'var(--green)' : 'var(--red)', animation: apiOk === null ? 'pulse 1s infinite' : 'none' }} />
              <span style={{ color: 'var(--t3)' }}>
                {apiOk === null ? 'Connecting…' : apiOk ? 'API connected' : 'API offline'}
              </span>
            </div>
            <button onClick={() => setView('analytics')} style={{ background: 'var(--s2)', border: '1px solid var(--b1)', borderRadius: 'var(--rs)', padding: '7px 14px', color: 'var(--t2)', fontSize: 13, cursor: 'pointer' }}>
              Analytics
            </button>
          </div>
        </div>
      </nav>

      {/* Offline banner */}
      {apiOk === false && (
        <div style={{ background: '#450a0a', borderBottom: '1px solid #7f1d1d', padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertCircle size={15} color="#fca5a5" />
          <span style={{ fontSize: 13, color: '#fca5a5' }}>
            Backend not reachable. Run: <code style={{ background: '#7f1d1d', borderRadius: 4, padding: '1px 8px', fontFamily: 'monospace' }}>source .venv/bin/activate && uvicorn api.main:app --reload</code>
          </span>
        </div>
      )}

      {/* Main content */}
      <ThemeProvider>
        <JobProvider>
          <AnalyticsProvider>
            <main style={{ flex: 1 }}>
              {view === 'studio'  && <StudioPage onResult={handleResult} />}
              {view === 'results' && result && <ResultsPage result={result} eventName={eventName} onBack={() => setView('studio')} />}
              {view === 'analytics' && <AnalyticsPage />}
            </main>
            <BottomNav view={view} onViewChange={setView} />
          </AnalyticsProvider>
        </JobProvider>
      </ThemeProvider>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--b1)', padding: '16px 24px', textAlign: 'center', fontSize: 12, color: 'var(--t3)' }}>
        Content & Design Engine · AI-powered social media automation
      </footer>
    </div>
  )
}
