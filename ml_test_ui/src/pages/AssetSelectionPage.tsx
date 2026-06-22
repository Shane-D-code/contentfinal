import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, Plus, Check, Zap, ChevronLeft, Star, LayoutGrid, Users, TrendingUp, Layout, Loader2, AlertCircle, Eye, RefreshCw, Mic, Store, Mic2, Handshake, Trophy, Tag, Search, Image as ImageIcon } from 'lucide-react'
import { Card, Btn } from '../components/ui'
import { toast } from '../components/ui/Toast'
import { getEnhancedAssets, getJobStatus, getLayoutPreview } from '../api'
import { LINKEDIN_LAYOUTS, STORY_LAYOUTS, REEL_LAYOUTS } from '../constants/layouts'
import './AssetSelectionPage.css'

const categoryIcons = {
  stage: Mic,
  booth: Store,
  crowd: Users,
  speakers: Mic2,
  networking: Handshake,
  awards: Trophy,
}


// Layout Preview Component
interface LayoutPreviewProps {
  layoutId: string
  layoutType: 'linkedin' | 'story' | 'reel'
  selectedAssets: EnhancedAsset[]
  jobId?: string
}

function LayoutPreview({ layoutId, layoutType, selectedAssets, jobId }: LayoutPreviewProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchPreview = useCallback(async () => {
    if (!layoutId || selectedAssets.length === 0 || !jobId) {
      setPreviewUrl(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const result = await getLayoutPreview({
        layout_type: layoutType,
        layout_id: layoutId,
        asset_ids: selectedAssets.map(a => a.id),
        job_id: jobId
      })
      setPreviewUrl(result.preview_url)
    } catch (err) {
      console.error('Preview failed:', err)
      setError('Preview failed')
    } finally {
      setLoading(false)
    }
  }, [layoutId, layoutType, selectedAssets, jobId])

  useEffect(() => {
    fetchPreview()
  }, [fetchPreview])

  return (
    <div style={{ marginTop: '16px', padding: '12px', background: 'var(--s2)', borderRadius: '12px', border: '1px solid var(--b1)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--t3)', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Eye size={12} /> Live Preview
        </span>
        <button onClick={fetchPreview} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }} disabled={loading}>
          <RefreshCw size={12} className={loading ? 'spin' : ''} style={{ color: 'var(--t3)' }} />
        </button>
      </div>
      <div style={{ aspectRatio: layoutType === 'linkedin' ? '1' : '9/16', background: 'var(--s1)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: 'var(--t3)' }}>
            <Loader2 size={20} className='spin' />
            <span style={{ fontSize: '12px' }}>Generating...</span>
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', color: 'var(--t3)', fontSize: '12px' }}>
            {error}
          </div>
        ) : previewUrl ? (
          <img src={previewUrl} alt='Preview' style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--t3)', fontSize: '12px' }}>
            Select assets to preview
          </div>
        )}
      </div>
    </div>
  )
}

interface EnhancedAsset {
  id: string
  url: string
  score: number
  faces: number
  concepts: string[]
}

interface CategoryAssets {
  name: string
  icon: string
  color?: string
  confidence?: number
  assets: EnhancedAsset[]
}

interface JobProgressState {
  message?: string
  percent?: number
  status?: string
}

interface Props {
  onContinue: (selectedAssetIds: string[], layouts: any) => void | Promise<void>
  onBack: () => void
  eventName: string
  jobId?: string
  files?: File[]
}

export default function AssetSelectionPage({ onContinue, onBack, eventName, jobId, files = [] }: Props) {
  const [isProcessing, setIsProcessing] = useState(true)
  const [jobProgress, setJobProgress] = useState<JobProgressState | null>(null)
  const [topAssets, setTopAssets] = useState<EnhancedAsset[]>([])
  const [categories, setCategories] = useState<Record<string, CategoryAssets>>({})
  const [stats, setStats] = useState({ total: 0, unique: 0, deduped: 0 })
  const [tab, setTab] = useState<'overall' | 'categories'>('overall')
  const [activeCat, setActiveCat] = useState<string | null>(null)
  const [selectedAssets, setSelectedAssets] = useState<string[]>([])
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [minScore, setMinScore] = useState(0)
  const [sortBy, setSortBy] = useState<'score' | 'faces' | 'name'>('score')
  const [searchQuery, setSearchQuery] = useState('')

  const [liLayout, setLiLayout] = useState('hero_right')
  const [stLayout, setStLayout] = useState('single')
  const [rlLayout, setRlLayout] = useState('standard')

  const MAX_SELECTIONS = 10

  const buildFallbackCategories = useCallback((assets: EnhancedAsset[]) => {
    const definitions: Record<string, Omit<CategoryAssets, 'assets'> & { keywords: string[] }> = {
      stage: { name: 'Stage', icon: '🎤', color: '#e3f2fd', confidence: 0, keywords: ['stage', 'presentation', 'podium', 'speaker', 'keynote', 'talk'] },
      booth: { name: 'Booth', icon: '🏪', color: '#e8f5e9', confidence: 0, keywords: ['booth', 'exhibit', 'display', 'stand', 'kiosk', 'table'] },
      crowd: { name: 'Crowd', icon: '👥', color: '#fff3e0', confidence: 0, keywords: ['crowd', 'audience', 'people', 'attendees', 'gathering', 'event', 'conference'] },
      speakers: { name: 'Speakers', icon: '🎙️', color: '#f3e5f5', confidence: 0, keywords: ['speaker', 'presenter', 'host', 'moderator', 'panel'] },
      networking: { name: 'Networking', icon: '🤝', color: '#e0f7fa', confidence: 0, keywords: ['networking', 'conversation', 'handshake', 'meeting', 'chat'] },
      awards: { name: 'Awards', icon: '🏆', color: '#ffebee', confidence: 0, keywords: ['award', 'trophy', 'winner', 'prize', 'ceremony'] },
    }
    const generated: Record<string, CategoryAssets> = {}

    assets.forEach(asset => {
      const searchable = [asset.url, ...(asset.concepts ?? [])].join(' ').toLowerCase()
      for (const [id, definition] of Object.entries(definitions)) {
        if (!definition.keywords.some(keyword => searchable.includes(keyword))) continue
        generated[id] ??= { name: definition.name, icon: definition.icon, color: definition.color, confidence: 0, assets: [] }
        generated[id].assets.push(asset)
        break
      }
    })

    Object.values(generated).forEach(category => {
      const averageScore = category.assets.reduce((sum, asset) => sum + asset.score, 0) / category.assets.length
      category.confidence = Math.round(Math.min(1, averageScore || 0) * 100)
    })

    return generated
  }, [])

  const loadFallback = useCallback(() => {
    const seenHashes = new Set<string>()
    const newAssets: EnhancedAsset[] = []
    const filesToUse = files || []

    const getSimpleFileHash = (file: File): string => {
      return `${file.name}-${file.size}`
    }

    filesToUse.forEach((file, i) => {
      const fileHash = getSimpleFileHash(file)
      if (seenHashes.has(fileHash)) return
      seenHashes.add(fileHash)
      const url = URL.createObjectURL(file)
      const nameConcepts = file.name.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
      newAssets.push({
        id: `asset-${i + 1}`,
        url,
        score: Math.floor(Math.random() * 25 + 75) / 100,
        faces: Math.floor(Math.random() * 5),
        concepts: Array.from(new Set(['event', 'conference', ...nameConcepts])).slice(0, 6),
      })
    })

    newAssets.sort((a, b) => b.score - a.score)
    const fallbackAssets = newAssets.slice(0, 10)
    setTopAssets(fallbackAssets)
    setCategories(buildFallbackCategories(fallbackAssets))
    setStats({ total: filesToUse.length, unique: fallbackAssets.length, deduped: filesToUse.length - fallbackAssets.length })
    setSelectedAssets(fallbackAssets.slice(0, 6).map(a => a.id))
    setIsProcessing(false)
    setError(null)
  }, [buildFallbackCategories, files])

  const fetchAssets = useCallback(async (allowFallback = true) => {
    if (!jobId) {
      loadFallback()
      return true
    }

    try {
      const data = await getEnhancedAssets(jobId)
      console.log('Enhanced Assets Response:', {
        topOverallCount: data.top_overall?.length ?? 0,
        categoriesCount: Object.values(data.per_category || {}).filter(cat => cat.assets?.length > 0).length,
        stats: data.stats,
      })

      if (data.stats?.pending_processing && (!data.top_overall || data.top_overall.length === 0)) {
        setIsProcessing(true)
        setJobProgress(prev => prev ?? { message: 'Processing your assets...', percent: 0, status: 'processing' })
        return false
      }

      if ((!data.top_overall || data.top_overall.length === 0) && files.length > 0 && allowFallback) {
        console.warn('No enhanced assets from API, using local fallback')
        loadFallback()
        return true
      }

      const top = data.top_overall || []
      const generatedCategories = Object.values(data.per_category || {}).some(cat => cat.assets?.length > 0)
        ? data.per_category
        : buildFallbackCategories(top)

      setTopAssets(top)
      setCategories(generatedCategories || {})
      setStats({
        total: data.stats?.total ?? 0,
        unique: data.stats?.unique ?? top.length,
        deduped: data.stats?.deduped ?? data.stats?.duplicates_removed ?? 0,
      })
      setSelectedAssets(top.slice(0, 6).map(a => a.id))
      setIsProcessing(false)
      setError(null)
      return true
    } catch (err) {
      console.error('Failed to fetch enhanced assets:', err)
      const response = (err as { response?: { status?: number; data?: { detail?: string } } }).response
      const detail = response?.data?.detail || ''
      if (jobId && response?.status === 400 && detail.toLowerCase().includes('not completed')) {
        setIsProcessing(true)
        setJobProgress(prev => prev ?? { message: 'Processing your assets...', percent: 0, status: 'processing' })
        return false
      }

      if (files.length > 0 && allowFallback) {
        toast.warning('Using local asset fallback', 'Enhanced asset scoring is not available yet.')
        loadFallback()
        return true
      }

      setError('Failed to load assets. Please check the backend and try again.')
      setIsProcessing(false)
      return true
    }
  }, [buildFallbackCategories, files.length, jobId, loadFallback])

  useEffect(() => {
    let cancelled = false
    let pollInterval: number | undefined

    const syncStatus = async () => {
      if (!jobId) return
      try {
        const status = await getJobStatus(jobId)
        if (cancelled) return

        const progress = status.progress
        const percent = typeof progress?.pct === 'number' ? progress.pct : undefined
        setJobProgress({
          message: progress?.step || status.error || undefined,
          percent,
          status: status.status,
        })

        if (status.status === 'completed') {
          if (pollInterval) window.clearInterval(pollInterval)
          await fetchAssets(true)
        } else if (status.status === 'failed') {
          if (pollInterval) window.clearInterval(pollInterval)
          setError(status.error || 'Asset processing failed.')
          setIsProcessing(false)
        }
      } catch (err) {
        console.error('Job status poll failed:', err)
      }
    }

    fetchAssets(true).then(done => {
      if (cancelled || done || !jobId) return
      syncStatus()
      pollInterval = window.setInterval(syncStatus, 2000)
    })

    return () => {
      cancelled = true
      if (pollInterval) window.clearInterval(pollInterval)
    }
  }, [fetchAssets, jobId])

  const progressPercent = jobProgress?.percent ?? (isProcessing ? 0 : 100)
  const currentMessage = jobProgress?.message || (jobProgress?.status ? `Job ${jobProgress.status}` : 'Processing your assets...')

  const toggleAsset = useCallback((assetId: string) => {
    setSelectedAssets(prev => {
      if (prev.includes(assetId)) {
        return prev.filter(id => id !== assetId)
      } else if (prev.length < MAX_SELECTIONS) {
        return [...prev, assetId]
      }
      toast.warning(`You can select up to ${MAX_SELECTIONS} assets only.`)
      return prev
    })
  }, [])

  const handleGenerate = async () => {
    if (selectedAssets.length === 0) {
      toast.error('Please select at least one asset', 'You need to select at least one image to generate content.')
      return
    }
    setGenerating(true)
    try {
      await onContinue(selectedAssets, { linkedin: liLayout, story: stLayout, reel: rlLayout })
      toast.success('Content generated!', `${eventName || 'Event'} content is ready!`)
    } catch (e) {
      console.error('Generation failed', e)
      toast.error('Generation failed', 'Please try again')
    } finally {
      setGenerating(false)
    }
  }

  const categoryEntries = useMemo(
    () => Object.entries(categories).filter(([, cat]) => cat.assets.length > 0),
    [categories]
  )

  const baseDisplayAssets = tab === 'categories' && activeCat
    ? categories[activeCat]?.assets || []
    : topAssets

  const displayAssets = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return [...baseDisplayAssets]
      .filter(asset => asset.score >= minScore)
      .filter(asset => {
        if (!query) return true
        return asset.url.toLowerCase().includes(query) ||
          (asset.concepts || []).some(concept => concept.toLowerCase().includes(query))
      })
      .sort((a, b) => {
        if (sortBy === 'score') return b.score - a.score
        if (sortBy === 'faces') return b.faces - a.faces
        return a.url.localeCompare(b.url)
      })
  }, [baseDisplayAssets, minScore, searchQuery, sortBy])

  const allKnownAssets = useMemo(() => {
    const byId = new Map<string, EnhancedAsset>()
    ;[...topAssets, ...Object.values(categories).flatMap(c => c.assets)].forEach(asset => {
      byId.set(asset.id, asset)
    })
    return Array.from(byId.values())
  }, [categories, topAssets])

  const selectTop = useCallback((count: number) => {
    const top = [...displayAssets].sort((a, b) => b.score - a.score).slice(0, count)
    setSelectedAssets(top.map(a => a.id))
  }, [displayAssets])

  const selectAllDisplayed = useCallback(() => {
    setSelectedAssets(displayAssets.slice(0, MAX_SELECTIONS).map(a => a.id))
  }, [displayAssets])

  // Get selected asset objects
  const selectedAssetList = selectedAssets
    .map(id => allKnownAssets.find(a => a.id === id))
    .filter(Boolean) as EnhancedAsset[]

  if (error) {
    return (
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '80px 24px', textAlign: 'center' }}>
        <AlertCircle size={64} style={{ color: 'var(--red)', marginBottom: '24px' }} />
        <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '12px' }}>Something went wrong</h2>
        <p style={{ color: 'var(--t2)', marginBottom: '32px' }}>{error}</p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <Btn onClick={onBack} variant="ghost">
            <ChevronLeft size={16} /> Back to Studio
          </Btn>
          <Btn onClick={() => window.location.reload()}>
            Retry
          </Btn>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', padding: '32px 24px', paddingBottom: '180px' }}>
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 style={{ fontSize: 'clamp(28px, 5vw, 42px)', fontWeight: 800, lineHeight: 1.15, marginBottom: '12px' }}>
            {isProcessing ? 'Processing Assets' : 'Curate Your Content'}
          </h1>
        </motion.div>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} style={{ fontSize: '16px', color: 'var(--t2)', maxWidth: '520px', margin: '0 auto', lineHeight: 1.6 }}>
          {isProcessing
            ? 'AI is analyzing your uploaded media and selecting the best assets.'
            : 'Choose your top ' + MAX_SELECTIONS + ' images for final content generation.'
          }
        </motion.p>
        {!isProcessing && (stats.deduped > 0 || stats.unique > 0) && (
          <div style={{ display: 'inline-flex', gap: '0.5rem', background: 'rgba(16,185,129,0.1)', color: '#10b981', padding: '0.375rem 0.875rem', borderRadius: '40px', fontSize: '0.75rem', marginTop: '0.5rem' }}>
            <Sparkles size={14} />
            {stats.deduped > 0 && `${stats.deduped} duplicates removed • `}
            {stats.unique} unique assets
          </div>
        )}
      </div>

      {isProcessing && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ maxWidth: '640px', margin: '0 auto 48px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--t2)' }}>{currentMessage}</span>
            <span style={{ fontSize: '24px', fontWeight: 700, color: 'var(--t1)' }}>{Math.round(progressPercent)}%</span>
          </div>
          <div style={{ position: 'relative', height: '12px', background: 'var(--s2)', borderRadius: '9999px', overflow: 'hidden' }}>
            <motion.div style={{ height: '100%', background: 'linear-gradient(90deg, #8B5CF6, #22D3EE)', borderRadius: '9999px' }} animate={{ width: `${progressPercent}%` }} transition={{ width: { duration: 0.3 } }} />
            <motion.div animate={{ x: ['-100%', '100%'] }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }} style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)' }} />
          </div>
        </motion.div>
      )}

      {!isProcessing && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '32px' }}>
          <div>
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--b1)', paddingBottom: '0.75rem' }}>
              <button className={`tab ${tab === 'overall' ? 'active' : ''}`} onClick={() => setTab('overall')} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.625rem 1.25rem', background: tab === 'overall' ? 'var(--s1)' : 'transparent', border: 'none', borderRadius: '12px', color: tab === 'overall' ? 'var(--a2)' : 'var(--t2)', cursor: 'pointer', fontSize: '14px', fontWeight: 600, transition: 'all 0.2s' }}>
                <Star size={16} /> Top {topAssets.length} Overall
              </button>
              <button className={`tab ${tab === 'categories' ? 'active' : ''}`} onClick={() => setTab('categories')} disabled={categoryEntries.length === 0} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.625rem 1.25rem', background: tab === 'categories' ? 'var(--s1)' : 'transparent', border: 'none', borderRadius: '12px', color: tab === 'categories' ? 'var(--a2)' : 'var(--t2)', cursor: categoryEntries.length === 0 ? 'not-allowed' : 'pointer', opacity: categoryEntries.length === 0 ? 0.55 : 1, fontSize: '14px', fontWeight: 600, transition: 'all 0.2s' }}>
                <LayoutGrid size={16} /> By Category ({categoryEntries.length})
              </button>
            </div>

            <Card style={{ padding: '16px', marginBottom: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1fr) minmax(180px, 220px) minmax(140px, 180px)', gap: '14px', alignItems: 'end' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', fontWeight: 700, color: 'var(--t2)' }}>
                  Search
                  <div style={{ position: 'relative' }}>
                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--t3)' }} />
                    <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Filename or concept" style={{ width: '100%', height: '40px', padding: '0 12px 0 36px', background: 'var(--s2)', border: '1px solid var(--b1)', borderRadius: '10px', color: 'var(--t1)', outline: 'none' }} />
                  </div>
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', fontWeight: 700, color: 'var(--t2)' }}>
                  Min Score: {Math.round(minScore * 100)}%
                  <input type="range" min={0} max={1} step={0.05} value={minScore} onChange={e => setMinScore(Number(e.target.value))} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', fontWeight: 700, color: 'var(--t2)' }}>
                  Sort
                  <select value={sortBy} onChange={e => setSortBy(e.target.value as 'score' | 'faces' | 'name')} style={{ height: '40px', padding: '0 12px', background: 'var(--s2)', border: '1px solid var(--b1)', borderRadius: '10px', color: 'var(--t1)', outline: 'none' }}>
                    <option value="score">Score</option>
                    <option value="faces">Faces</option>
                    <option value="name">Name</option>
                  </select>
                </label>
              </div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '14px' }}>
                <Btn variant="ghost" size="sm" onClick={() => selectTop(5)} disabled={displayAssets.length === 0}>Select Top 5</Btn>
                <Btn variant="ghost" size="sm" onClick={selectAllDisplayed} disabled={displayAssets.length === 0}>Select All</Btn>
                <Btn variant="ghost" size="sm" onClick={() => setSelectedAssets([])} disabled={selectedAssets.length === 0}>Clear All</Btn>
              </div>
            </Card>

            {tab === 'categories' && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.5rem' }}>
                {categoryEntries.map(([id, cat]) => {
                  const CategoryIcon = categoryIcons[id as keyof typeof categoryIcons] ?? Tag
                  return (
                    <motion.button key={id} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setActiveCat(activeCat === id ? null : id)} style={{ minWidth: '150px', display: 'flex', flexDirection: 'column', gap: '0.45rem', padding: '0.65rem 0.85rem', background: activeCat === id ? 'var(--accent)' : 'var(--s1)', border: activeCat === id ? '1px solid var(--accent)' : '1px solid var(--b1)', borderRadius: '12px', fontSize: '0.8125rem', cursor: 'pointer', color: activeCat === id ? 'white' : 'var(--t2)', transition: 'all 0.2s', textAlign: 'left' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
                        <CategoryIcon size={14} /> {cat.name} ({cat.assets.length})
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '11px', opacity: 0.85 }}>
                        <span style={{ flex: 1, height: '4px', background: activeCat === id ? 'rgba(255,255,255,0.25)' : 'var(--s2)', borderRadius: '999px', overflow: 'hidden' }}>
                          <span style={{ display: 'block', width: `${cat.confidence ?? Math.round(cat.assets[0]?.score * 100) ?? 0}%`, height: '100%', background: activeCat === id ? '#fff' : 'var(--accent)' }} />
                        </span>
                        {cat.confidence ?? Math.round(cat.assets[0]?.score * 100) ?? 0}%
                      </span>
                    </motion.button>
                  )
                })}
              </div>
            )}

            {topAssets.length === 0 ? (
              <Card style={{ padding: '48px 24px', textAlign: 'center' }}>
                <ImageIcon size={48} style={{ color: 'var(--t3)', marginBottom: '16px' }} />
                <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>No Assets Found</h3>
                <p style={{ color: 'var(--t2)', marginBottom: '24px' }}>Upload images or videos to see AI-curated selections here.</p>
                <Btn onClick={onBack}><ChevronLeft size={16} /> Go to Upload</Btn>
              </Card>
            ) : displayAssets.length === 0 ? (
              <Card style={{ padding: '40px 24px', textAlign: 'center' }}>
                <Search size={40} style={{ color: 'var(--t3)', marginBottom: '16px' }} />
                <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>No Matching Assets</h3>
                <p style={{ color: 'var(--t2)', marginBottom: '20px' }}>Adjust the search text, category, or minimum score.</p>
                <Btn variant="ghost" onClick={() => { setSearchQuery(''); setMinScore(0); setActiveCat(null) }}>Clear Filters</Btn>
              </Card>
            ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))', gap: '1rem' }}>
              {displayAssets.map((asset, idx) => {
                const isSelected = selectedAssets.includes(asset.id)
                const isMaxReached = selectedAssets.length >= MAX_SELECTIONS && !isSelected
                return (
                  <motion.div key={asset.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: idx * 0.025 }} onClick={() => !isMaxReached && toggleAsset(asset.id)} whileHover={{ scale: isMaxReached ? 1 : 1.03 }} whileTap={{ scale: isMaxReached ? 1 : 0.97 }} style={{ position: 'relative', aspectRatio: '1', background: 'var(--s1)', borderRadius: '16px', overflow: 'hidden', cursor: isMaxReached ? 'not-allowed' : 'pointer', border: isSelected ? '2px solid var(--accent)' : '2px solid transparent', opacity: isMaxReached ? 0.5 : 1, transition: 'all 0.2s', boxShadow: isSelected ? '0 0 32px rgba(124,106,255,.25)' : 'none' }}>
                    <img src={asset.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    <div style={{ position: 'absolute', inset: 0, background: isSelected ? 'rgba(124,106,255,0.75)' : 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s' }} className="hover:opacity-100">
                      <div style={{ width: '44px', height: '44px', borderRadius: '9999px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isSelected ? '#fff' : 'rgba(255,255,255,0.2)', color: isSelected ? 'var(--accent)' : '#fff', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
                        {isSelected ? <Check size={22} /> : <Plus size={22} />}
                      </div>
                    </div>
                    <div style={{ position: 'absolute', top: '10px', right: '10px', padding: '4px 10px', background: 'rgba(0,0,0,0.65)', borderRadius: '9999px', backdropFilter: 'blur(6px)' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <TrendingUp size={12} /> {Math.round(asset.score * 100)}%
                      </span>
                    </div>
                    {asset.faces > 0 && (
                      <div style={{ position: 'absolute', top: '10px', left: '10px', padding: '4px 10px', background: 'rgba(0,0,0,0.65)', borderRadius: '9999px', backdropFilter: 'blur(6px)' }}>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Users size={10} /> {asset.faces}
                        </span>
                      </div>
                    )}
                    {isSelected && (
                      <motion.div animate={{ opacity: [0.25, 0.5, 0.25] }} transition={{ duration: 2, repeat: Infinity }} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', border: '2px solid var(--accent)' }} />
                    )}
                  </motion.div>
                )
              })}
            </div>
            )}
          </div>

          <div>
            <Card style={{ padding: '24px', marginBottom: '24px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--t1)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Layout size={20} /> Customize Layouts
              </h3>

              <div style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', fontSize: '14px', fontWeight: 600, color: 'var(--t2)' }}>
                  LinkedIn
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {LINKEDIN_LAYOUTS.map(l => (
                    (() => {
                      const LayoutIcon = l.icon
                      return (
                        <motion.button key={l.id} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} onClick={() => setLiLayout(l.id)} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', background: liLayout === l.id ? 'rgba(124,106,255,.15)' : 'var(--s2)', border: liLayout === l.id ? '1px solid var(--accent)' : '1px solid var(--b1)', borderRadius: '14px', cursor: 'pointer', transition: 'all 0.2s' }}>
                          <LayoutIcon size={18} color={liLayout === l.id ? 'var(--accent)' : 'var(--t2)'} />
                          <div style={{ textAlign: 'left', flex: 1 }}>
                            <div style={{ fontWeight: 600, color: 'var(--t1)', fontSize: '14px' }}>{l.name}</div>
                            <div style={{ fontSize: '12px', color: 'var(--t3)', marginTop: '2px' }}>{l.desc}</div>
                          </div>
                          {liLayout === l.id && <Check size={16} color="var(--accent)" />}
                        </motion.button>
                      )
                    })()
                  ))}
                </div>
                <LayoutPreview layoutId={liLayout} layoutType="linkedin" selectedAssets={selectedAssetList} jobId={jobId} />
              </div>

              <div style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', fontSize: '14px', fontWeight: 600, color: 'var(--t2)' }}>
                  Instagram Stories
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {STORY_LAYOUTS.map(l => (
                    (() => {
                      const StoryIcon = l.icon
                      return (
                        <motion.button key={l.id} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} onClick={() => setStLayout(l.id)} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', background: stLayout === l.id ? 'rgba(124,106,255,.15)' : 'var(--s2)', border: stLayout === l.id ? '1px solid var(--accent)' : '1px solid var(--b1)', borderRadius: '14px', cursor: 'pointer', transition: 'all 0.2s' }}>
                          <StoryIcon size={18} color={stLayout === l.id ? 'var(--accent)' : 'var(--t2)'} />
                          <div style={{ textAlign: 'left', flex: 1 }}>
                            <div style={{ fontWeight: 600, color: 'var(--t1)', fontSize: '14px' }}>{l.name}</div>
                            <div style={{ fontSize: '12px', color: 'var(--t3)', marginTop: '2px' }}>{l.desc}</div>
                          </div>
                          {stLayout === l.id && <Check size={16} color="var(--accent)" />}
                        </motion.button>
                      )
                    })()
                  ))}
                </div>
                <LayoutPreview layoutId={stLayout} layoutType="story" selectedAssets={selectedAssetList} jobId={jobId} />
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', fontSize: '14px', fontWeight: 600, color: 'var(--t2)' }}>
                  Instagram Reel
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {REEL_LAYOUTS.map(l => (
                    (() => {
                      const ReelIcon = l.icon
                      return (
                        <motion.button key={l.id} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }} onClick={() => setRlLayout(l.id)} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', background: rlLayout === l.id ? 'rgba(124,106,255,.15)' : 'var(--s2)', border: rlLayout === l.id ? '1px solid var(--accent)' : '1px solid var(--b1)', borderRadius: '14px', cursor: 'pointer', transition: 'all 0.2s' }}>
                          <ReelIcon size={18} color={rlLayout === l.id ? 'var(--accent)' : 'var(--t2)'} />
                          <div style={{ textAlign: 'left', flex: 1 }}>
                            <div style={{ fontWeight: 600, color: 'var(--t1)', fontSize: '14px' }}>{l.name}</div>
                            <div style={{ fontSize: '12px', color: 'var(--t3)', marginTop: '2px' }}>{l.desc}</div>
                          </div>
                          {rlLayout === l.id && <Check size={16} color="var(--accent)" />}
                        </motion.button>
                      )
                    })()
                  ))}
                </div>
                <LayoutPreview layoutId={rlLayout} layoutType="reel" selectedAssets={selectedAssetList} jobId={jobId} />
              </div>
            </Card>
          </div>
        </div>
      )}

      {!isProcessing && (
        <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} style={{ position: 'fixed', bottom: '24px', left: '24px', right: '24px', zIndex: 1000 }}>
          <Card style={{ padding: '18px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', boxShadow: '0 10px 40px rgba(0,0,0,0.3)', maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: '1 1 auto', minWidth: '0' }}>
              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', maxWidth: '360px', paddingRight: '8px' }}>
                {selectedAssets.slice(0, 6).map((assetId) => {
                  const asset = [...topAssets, ...Object.values(categories).flatMap(c => c.assets)].find(a => a.id === assetId)
                  return asset ? (
                    <div key={assetId} style={{ width: '48px', height: '48px', borderRadius: '12px', overflow: 'hidden', flexShrink: 0, border: '2px solid var(--accent)' }}>
                      <img src={asset.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ) : null
                })}
                {selectedAssets.length > 6 && (
                  <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--s2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t1)', fontSize: '14px', fontWeight: 700, flexShrink: 0 }}>+{selectedAssets.length - 6}</div>
                )}
                {selectedAssets.length === 0 && (
                  <div style={{ color: 'var(--t3)', fontSize: '14px', padding: '0 4px' }}>Select images to continue</div>
                )}
              </div>
              <div style={{ padding: '6px 14px', background: selectedAssets.length === MAX_SELECTIONS ? 'rgba(16,185,129,0.1)' : 'var(--s2)', borderRadius: '12px', color: selectedAssets.length === MAX_SELECTIONS ? 'var(--green)' : 'var(--t2)', fontSize: '14px', fontWeight: 700, flexShrink: 0 }}>
                {selectedAssets.length}/{MAX_SELECTIONS}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexShrink: 0 }}>
              <Btn variant="ghost" size="md" onClick={onBack} style={{ borderRadius: '12px' }}>
                <ChevronLeft size={16} /> Back
              </Btn>
              <Btn variant="primary" size="lg" onClick={handleGenerate} disabled={selectedAssets.length === 0 || generating} style={{ borderRadius: '12px', padding: '12px 24px', fontSize: '15px', fontWeight: 600 }}>
                {generating ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Zap size={18} />}
                {generating ? 'Generating...' : 'Generate Content'}
              </Btn>
            </div>
          </Card>
        </motion.div>
      )}
    </div>
  )
}
