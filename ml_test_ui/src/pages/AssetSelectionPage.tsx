import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Sparkles, Plus, Check, Zap, ChevronLeft, Star, LayoutGrid, Users, TrendingUp, Layout, Loader2, AlertCircle, Eye, RefreshCw, Mic, Store, Mic2, Handshake, Trophy, Tag } from 'lucide-react'
import { Card, Btn } from '../components/ui'
import { toast } from '../components/ui/Toast'
import { getEnhancedAssets, getLayoutPreview } from '../api'
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
  assets: EnhancedAsset[]
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
  const [progress, setProgress] = useState(0)
  const [topAssets, setTopAssets] = useState<EnhancedAsset[]>([])
  const [categories, setCategories] = useState<Record<string, CategoryAssets>>({})
  const [stats, setStats] = useState({ total: 0, unique: 0, deduped: 0 })
  const [tab, setTab] = useState<'overall' | 'categories'>('overall')
  const [activeCat, setActiveCat] = useState<string | null>(null)
  const [selectedAssets, setSelectedAssets] = useState<string[]>([])
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [liLayout, setLiLayout] = useState('hero_right')
  const [stLayout, setStLayout] = useState('single')
  const [rlLayout, setRlLayout] = useState('standard')

  const MAX_SELECTIONS = 10

  const STATUS_MESSAGES = [
    'Analyzing uploaded visuals...',
    'Detecting event highlights...',
    'Identifying crowd moments...',
    'Selecting best compositions...',
    'Grouping similar scenes...',
    'Optimizing media recommendations...',
  ]

  useEffect(() => {
    if (jobId) {
      getEnhancedAssets(jobId)
        .then(data => {
          setTopAssets(data.top_overall)
          setCategories(data.per_category)
          setStats({
            total: data.stats?.total ?? 0,
            unique: data.stats?.unique ?? 0,
            deduped: data.stats?.deduped ?? data.stats?.duplicates_removed ?? 0,
          })
          const def = data.top_overall.slice(0, 6).map(a => a.id)
          setSelectedAssets(def)
          setIsProcessing(false)
          setError(null)
        })
        .catch(err => {
          console.log('Failed to load enhanced assets, using fallback', err)
          loadFallback()
        })
    } else {
      loadFallback()
    }
  }, [jobId])

  const loadFallback = () => {
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
      newAssets.push({
        id: `asset-${i + 1}`,
        url,
        score: Math.floor(Math.random() * 25 + 75) / 100,
        faces: Math.floor(Math.random() * 5),
        concepts: ['event', 'conference'],
      })
    })

    newAssets.sort((a, b) => b.score - a.score)
    setTopAssets(newAssets.slice(0, 10))
    setStats({ total: filesToUse.length, unique: newAssets.length, deduped: filesToUse.length - newAssets.length })
    setSelectedAssets(newAssets.slice(0, 6).map(a => a.id))
    setIsProcessing(false)
  }

  useEffect(() => {
    if (!isProcessing) return
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval)
          return 100
        }
        return prev + 2
      })
    }, 100)

    return () => clearInterval(interval)
  }, [isProcessing])

  const currentMessage = STATUS_MESSAGES[Math.min(Math.floor((progress / 100) * STATUS_MESSAGES.length), STATUS_MESSAGES.length - 1)]

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

  const displayAssets = tab === 'categories' && activeCat
    ? categories[activeCat]?.assets || []
    : topAssets

  // Get selected asset objects
  const selectedAssetList = selectedAssets
    .map(id => topAssets.find(a => a.id === id) || Object.values(categories).flatMap(c => c.assets).find(a => a.id === id))
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
            {isProcessing ? 'Generating Content' : 'Curate Your Content'}
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
            <span style={{ fontSize: '24px', fontWeight: 700, color: 'var(--t1)' }}>{Math.round(progress)}%</span>
          </div>
          <div style={{ position: 'relative', height: '12px', background: 'var(--s2)', borderRadius: '9999px', overflow: 'hidden' }}>
            <motion.div style={{ background: 'linear-gradient(90deg, #8B5CF6, #22D3EE, #8B5CF6)', backgroundSize: '200% 100%', borderRadius: '9999px' }} animate={{ width: `${progress}%`, backgroundPosition: ['0% 0%', '200% 0%'] }} transition={{ width: { duration: 0.3 }, backgroundPosition: { duration: 1.5, repeat: Infinity, ease: 'linear' } }} />
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
              <button className={`tab ${tab === 'categories' ? 'active' : ''}`} onClick={() => setTab('categories')} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.625rem 1.25rem', background: tab === 'categories' ? 'var(--s1)' : 'transparent', border: 'none', borderRadius: '12px', color: tab === 'categories' ? 'var(--a2)' : 'var(--t2)', cursor: 'pointer', fontSize: '14px', fontWeight: 600, transition: 'all 0.2s' }}>
                <LayoutGrid size={16} /> By Category
              </button>
            </div>

            {tab === 'categories' && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.5rem' }}>
                {Object.entries(categories).map(([id, cat]) => (
                  cat.assets.length > 0 && (
                    (() => {
                      const CategoryIcon = categoryIcons[id as keyof typeof categoryIcons] ?? Tag
                      return (
                        <motion.button key={id} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setActiveCat(activeCat === id ? null : id)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', background: activeCat === id ? 'var(--accent)' : 'var(--s1)', border: activeCat === id ? '1px solid var(--accent)' : '1px solid var(--b1)', borderRadius: '40px', fontSize: '0.8125rem', cursor: 'pointer', color: activeCat === id ? 'white' : 'var(--t2)', transition: 'all 0.2s' }}>
                          <CategoryIcon size={14} /> {cat.name} ({cat.assets.length})
                        </motion.button>
                      )
                    })()
                  )
                ))}
              </div>
            )}

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
