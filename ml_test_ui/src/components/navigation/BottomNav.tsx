import React from 'react'
import { Home, BarChart3, Settings } from 'lucide-react'

interface Props {
  view: 'studio' | 'results' | 'analytics'
  onViewChange: (view: 'studio' | 'results' | 'analytics') => void
}

export default function BottomNav({ view, onViewChange }: Props) {
  const NavItem = ({ icon: Icon, label, active, onClick }: { icon: React.ComponentType<{ size?: number }>, label: string, active: boolean, onClick: () => void }) => (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '8px 16px',
        transition: 'all 0.2s ease',
        transform: active ? 'scale(1.05)' : 'scale(1)',
        color: active ? 'var(--accent)' : 'var(--t3)',
        minHeight: '60px',
        fontSize: '12px',
        fontWeight: active ? '600' : '400',
      }}
    >
      <Icon size={20} />
      <span style={{ marginTop: 4, fontSize: 12 }}>{label}</span>
    </button>
  )

  return (
    <div 
      style={{ 
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'rgba(22,22,42,0.95)',
        backdropFilter: 'blur(16px)',
        borderTop: '1px solid var(--b1)',
        zIndex: 50,
        paddingBottom: '20px',
        WebkitBackdropFilter: 'blur(16px)'
      }}
    >
      <div style={{ maxWidth: 400, margin: '0 auto', padding: '0 16px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-around' }}>
        <NavItem 
          icon={Home} 
          label="Studio" 
          active={view === 'studio'}
          onClick={() => onViewChange('studio')}
        />
        <NavItem 
          icon={BarChart3} 
          label="Results" 
          active={view === 'results'}
          onClick={() => onViewChange('results')}
        />
        <NavItem 
          icon={Settings} 
          label="Analytics" 
          active={view === 'analytics'}
          onClick={() => onViewChange('analytics')}
        />
      </div>
    </div>
  )
}

