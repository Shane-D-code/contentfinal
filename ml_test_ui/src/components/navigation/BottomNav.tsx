import { motion } from 'framer-motion'
import { Home, BarChart3, FileText } from 'lucide-react'
import type { View } from '../../App'

interface Props {
  view: View
  onViewChange: (view: View) => void
  hasResults?: boolean
}

const NAV_ITEMS = [
  { id: 'studio'    as const, label: 'Studio',    icon: Home },
  { id: 'results'   as const, label: 'Results',   icon: FileText },
  { id: 'analytics' as const, label: 'Analytics', icon: BarChart3 },
]

export default function BottomNav({ view, onViewChange, hasResults = false }: Props) {
  return (
    <nav
      role="navigation"
      aria-label="Mobile navigation"
      className="mobile-nav"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'rgba(15,15,26,.96)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '1px solid var(--b1)',
        zIndex: 100,
        paddingBottom: 'env(safe-area-inset-bottom, 8px)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'stretch', height: 56 }}>
        {NAV_ITEMS.map(item => {
          const isActive   = view === item.id
          const isDisabled = item.id === 'results' && !hasResults
          const Icon = item.icon

          return (
            <button
              key={item.id}
              onClick={() => !isDisabled && onViewChange(item.id)}
              disabled={isDisabled}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                background: 'none',
                border: 'none',
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                color: isDisabled ? 'var(--t3)' : isActive ? 'var(--accent)' : 'var(--t2)',
                fontSize: 11,
                fontWeight: isActive ? 600 : 400,
                position: 'relative',
                transition: 'color .15s',
                opacity: isDisabled ? 0.4 : 1,
                minHeight: 44,
              }}
            >
              {/* Active indicator */}
              {isActive && (
                <motion.div
                  layoutId="nav-indicator"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: '20%',
                    right: '20%',
                    height: 2,
                    background: 'var(--accent)',
                    borderRadius: '0 0 2px 2px',
                  }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}

              <motion.div
                animate={{ scale: isActive ? 1.1 : 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              >
                <Icon size={20} />
              </motion.div>
              <span>{item.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
