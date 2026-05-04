import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'

// Types
type Theme = 'dark' | 'light' | 'system'
interface ThemeContextType {
  theme: Theme
  setTheme: (theme: Theme) => void
  resolvedTheme: 'dark' | 'light'
}

// Context
const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

// Provider
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('system')
  const [resolvedTheme, setResolvedTheme] = useState<'dark' | 'light'>('dark')
  const [mounted, setMounted] = useState(false)

  // System preference
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      if (theme === 'system') {
        setResolvedTheme(mediaQuery.matches ? 'dark' : 'light')
      }
    }
    handleChange()
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme])

  // Persist theme
  useEffect(() => {
    const saved = localStorage.getItem('theme') as Theme | null
    if (saved && ['dark', 'light', 'system'].includes(saved)) {
      setTheme(saved)
    } else {
      localStorage.setItem('theme', theme)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('theme', theme)
  }, [theme])

  // Mount for SSR
  useEffect(() => {
    setMounted(true)
  }, [])

  const value = {
    theme,
    setTheme,
    resolvedTheme,
  }

  // Apply to html
  useEffect(() => {
    if (typeof document !== 'undefined') {
      if (theme === 'dark' || (theme === 'system' && resolvedTheme === 'dark')) {
        document.documentElement.classList.add('dark')
      } else {
        document.documentElement.classList.remove('dark')
      }
    }
  }, [theme, resolvedTheme])

  if (!mounted) {
    return <div className="h-screen bg-gray-50 dark:bg-gray-900" />
  }

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  )
}

// Hook
export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}

