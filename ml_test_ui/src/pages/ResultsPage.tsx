import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { BarChart3, BriefcaseBusiness, Camera, ChevronLeft, Download, File, FileDown, FileText, Film, Folder, Image, RefreshCw, Smartphone, Tag as TagIcon, Zap, AlertTriangle } from 'lucide-react'
import { Card, Btn, Tag } from '../components/ui'
import { LinkedInPreview, InstagramCarousel, InstagramStories, InstagramReel } from '../components/PlatformPreview'
import CaptionEditor from '../components/results/CaptionEditor'
import HashtagGenerator from '../components/results/HashtagGenerator'
import BulkDownload from '../components/export/BulkDownload'
import SocialShareButtons from '../components/export/SocialShareButtons'
import { toast } from '../components/ui/Toast'
import { useAnalytics } from '../contexts/AnalyticsContext'
import { useIsMobile } from '../hooks/useMediaQuery'
import { regenerateCaptions } from '../api'

type Tab = 'linkedin' | 'instagram' | 'stories' | 'reel' | 'casestudy' | 'report'
interface Props { result: any; eventName: string; onBack: () => void }

function Thumb({ url }: { url: string }) {
  return <img src={url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
}

const TABS = [
  { id: 'linkedin' as const,  label: 'LinkedIn',   icon: BriefcaseBusiness },
  { id: 'instagram' as const, label: 'Instagram',  icon: Camera },
  { id: 'stories' as const,   label: 'Stories',    icon: Smartphone },
  { id: 'reel' as const,      label: 'Reel',       icon: Film },
  { id: 'casestudy' as const, label: 'Case Study', icon: FileText },
  { id: 'report' as const,    label: 'AI Report',  icon: BarChart3 },
]

export default function ResultsPage({ result, eventName, onBack }: Props) {
  const { trackEvent } = useAnalytics()
  const isMobile = useIsMobile()
  const [regenLoading, setRegenLoading] = useState(false)
  const [groqBackend, setGroqBackend] = useState<string | null>(null)

  const files: Record<string, string>    = result?.files    ?? {}
  const captions: Record<string, string> = result?.captions ?? {}
  const fileNames = Object.keys(files)
  const isBrandMode = result?.mode === 'gff'
  const brandCounts: Record<string, number> = result?.brand_counts ?? {}
  const brandIds = Object.keys(brandCounts)
  const initialBrandId = result?.selected_brand && brandIds.includes(result.selected_brand)
    ? result.selected_brand
    : brandIds[0] ?? ''
  const [tab, setTab] = useState<Tab>('linkedin')
  const [activeBrandId, setActiveBrandId] = useState(initialBrandId)
  const activeFileNames = isBrandMode && activeBrandId
    ? fileNames.filter(n => n.startsWith(`${activeBrandId}/`))
    : fileNames

  const getUrl  = (pat: RegExp) => { const k = activeFileNames.find(n => pat.test(n)); return k ? files[k] : undefined }
  const getUrls = (pat: RegExp) => activeFileNames.filter(n => pat.test(n)).sort().map(n => files[n])
  const caption = (key: string) => {
    if (isBrandMode && activeBrandId) {
      return captions[`${activeBrandId}__${key}`] || captions[key] || ''
    }
    return captions[key] || ''
  }

  const collageUrl   = getUrl(/linkedin_collage/)
  const carouselUrls = getUrls(/(?:instagram_carousel_\d+|carousel_\d+)/)
  const reelUrl      = getUrl(/(?:instagram_reel|reel)\.mp4$/)
  const storyUrls    = getUrls(/(?:instagram_story_\d+|story_\d+)/)

  const [liCaption,   setLiCaption]   = useState(caption('linkedin_caption') || caption('instagram_caption') || `Just wrapped ${eventName} — here's what stood out.\n\nThe energy in the room was electric.\n\nWhat's your biggest takeaway from recent events?\n\n#${eventName.replace(/\s+/g, '')} #EventInsights`)
  const [igCaption,   setIgCaption]   = useState(caption('instagram_caption') || `POV: You attend ${eventName} and forget to eat.\n\nSwipe for the moments that did not make the recap.\n\n#${eventName.replace(/\s+/g, '')} #EventLife`)
  const [reelCaption, setReelCaption] = useState(caption('instagram_reel_caption') || caption('reel_caption') || `24 hours at ${eventName}.\n\nTag someone who needs to be in the room next year.\n\n#${eventName.replace(/\s+/g, '')}`)
  const [storyCaps, setStoryCaps]     = useState<string[]>(() => {
    const raw = caption('story_captions') || caption('stories__story_captions') || ''
    if (raw) {
      const lines = raw.split('\n').filter(Boolean).map((l: string) => l.replace(/^Story \d+:\s*/i, '').trim()).filter(Boolean)
      if (lines.length) return lines
    }
    return [`We are at ${eventName}`, 'The main stage', 'Best moment of the day', 'See you next year']
  })

  useEffect(() => {
    if (!isBrandMode) return
    setLiCaption(caption('linkedin_caption') || caption('instagram_caption') || '')
    setIgCaption(caption('instagram_caption') || '')
    setReelCaption(caption('instagram_reel_caption') || caption('reel_caption') || '')
    const rawStories = caption('story_captions') || caption('stories__story_captions') || ''
    const nextStories = rawStories
      .split('\n')
      .filter(Boolean)
      .map((line: string) => line.replace(/^Story \d+:\s*/i, '').trim())
      .filter(Boolean)
    setStoryCaps(nextStories.length ? nextStories : [`${activeBrandId.replace(/_/g, ' ')} at ${eventName}`])
  }, [activeBrandId])

  const dl = (webUrl: string, filename: string) => {
    const a = document.createElement('a')
    a.href = webUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    toast.success('Download started', filename)
    trackEvent({ type: 'export' })
  }

  const handleRegen = async (platform: 'linkedin' | 'instagram' | 'reel' | 'stories') => {
    setRegenLoading(true)
    const loadId = toast.loading('Regenerating with Groq AI…')
    try {
      const r = await regenerateCaptions({
        eventName,
        eventDescription: result?.event_description ?? eventName,
        platform,
        sceneConcepts: result?.scene_concepts ?? [],
        faceCount: result?.face_count ?? 0,
      })
      setGroqBackend(r.backend)
      if (platform === 'linkedin'   && r.linkedin)   setLiCaption(r.linkedin)
      if (platform === 'instagram'  && r.instagram)  setIgCaption(r.instagram)
      if (platform === 'reel'       && r.reel)        setReelCaption(r.reel)
      toast.dismiss(loadId)
      const label = r.backend === 'groq' ? 'Groq AI' : 'Template'
      toast.success(`Caption regenerated (${label})`)
      trackEvent({ type: 'regen', platform })
    } catch (e: any) {
      toast.dismiss(loadId)
      toast.error('Regeneration failed', e?.response?.data?.detail ?? e.message)
    } finally {
      setRegenLoading(false)
    }
  }

  const gridCols = isMobile ? '1fr' : '1fr 1fr'

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <button
            onClick={onBack}
            aria-label="Back to Studio"
            style={{ background: 'var(--s2)', border: '1px solid var(--b1)', borderRadius: 'var(--rs)', padding: '8px 14px', color: 'var(--t2)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
          >
            <ChevronLeft size={15} /> New Event
          </button>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700 }}>{eventName}</h1>
            <p style={{ fontSize: 13, color: 'var(--t2)' }}>{fileNames.length} files generated</p>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Tag label="Generation complete" color="var(--green)" />
            <BulkDownload files={files} />
          </div>
        </div>

        {isBrandMode && brandIds.length > 0 && (
          <Card style={{ padding: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, color: 'var(--t3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>Brand outputs</span>
              {brandIds.map(id => (
                <button
                  key={id}
                  onClick={() => setActiveBrandId(id)}
                  style={{
                    border: `1px solid ${activeBrandId === id ? 'var(--accent)' : 'var(--b1)'}`,
                    background: activeBrandId === id ? 'rgba(124,106,255,.15)' : 'var(--s2)',
                    color: activeBrandId === id ? 'var(--a2)' : 'var(--t2)',
                    borderRadius: 8,
                    padding: '7px 10px',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {id.replace(/_/g, ' ')} · {brandCounts[id]} photos
                </button>
              ))}
              {typeof result?.unmatched_count === 'number' && (
                <Tag label={`${result.unmatched_count} unmatched`} color="var(--yellow)" />
              )}
            </div>
          </Card>
        )}
        
        {/* Selected Layouts Info */}
        {!isBrandMode && <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <p style={{ fontSize: 12, color: 'var(--t3)', margin: 0 }}>Selected Layouts:</p>
          {result.linkedin_layout && (
            <Tag label={`LinkedIn: ${result.linkedin_layout}`} color="var(--accent)" />
          )}
          {result.story_layout && (
            <Tag label={`Stories: ${result.story_layout}`} color="var(--accent)" />
          )}
          {result.reel_layout && (
            <Tag label={`Reel: ${result.reel_layout}`} color="var(--accent)" />
          )}
        </div>}
      </motion.div>

      {/* Tab bar */}
      <div
        role="tablist"
        aria-label="Content platforms"
        style={{ display: 'flex', gap: 4, marginBottom: 28, background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: 'var(--r)', padding: 5, overflowX: 'auto' }}
      >
        {TABS.map(t => {
          const TabIcon = t.icon
          return (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1, minWidth: 90, padding: '9px 12px', borderRadius: 'var(--rs)', border: 'none',
              cursor: 'pointer', fontSize: 13, fontWeight: 600, transition: 'all .15s',
              background: tab === t.id ? 'var(--accent)' : 'transparent',
              color: tab === t.id ? '#fff' : 'var(--t2)',
              whiteSpace: 'nowrap',
            }}
          >
            <TabIcon size={16} /> {!isMobile && t.label}
          </button>
        )})}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.2 }}
        >

          {/* ── LinkedIn ── */}
          {tab === 'linkedin' && (
            <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 24, alignItems: 'start' }}>
              <div>
                <p style={{ fontSize: 11, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>Live Preview</p>
                <LinkedInPreview images={collageUrl ? [collageUrl] : carouselUrls.slice(0, 6)} caption={liCaption} name={isBrandMode ? activeBrandId.replace(/_/g, ' ') : eventName} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <Card>
                  <p style={{ fontSize: 11, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Caption</p>
                  <CaptionEditor value={liCaption} onChange={setLiCaption} platform="linkedin" />
                  <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <HashtagGenerator eventName={eventName} onInsert={tags => setLiCaption(v => v + '\n\n' + tags)} />
                    <Btn size="sm" variant="ghost" onClick={() => handleRegen('linkedin')} disabled={regenLoading}
                      style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      {regenLoading ? <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Zap size={12} color="var(--accent)" />}
                      Regenerate with AI
                    </Btn>
                  </div>
                  {groqBackend && <p style={{ fontSize: 10, color: 'var(--t3)', marginTop: 6 }}>
                    Last generated by: {groqBackend === 'groq' ? 'Groq (llama-3.3-70b)' : 'Template'}
                  </p>}
                </Card>
                <Card>
                  <SocialShareButtons platform="linkedin" caption={liCaption} />
                </Card>
                {(collageUrl || carouselUrls[0]) && (
                  <Card>
                    <p style={{ fontSize: 11, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>Download</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--s2)', borderRadius: 'var(--rs)', padding: '10px 14px' }}>
                      <div style={{ width: 56, height: 56, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}><Thumb url={collageUrl || carouselUrls[0]} /></div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 13, fontWeight: 500 }}>{isBrandMode ? 'Brand hero slide' : 'LinkedIn Collage'}</p>
                        <p style={{ fontSize: 11, color: 'var(--t3)' }}>1080×1080 JPEG</p>
                      </div>
                      <Btn size="sm" onClick={() => dl(collageUrl || carouselUrls[0], isBrandMode ? `${activeBrandId}_hero.jpg` : 'linkedin_collage.jpg')}><Download size={13} /> Download</Btn>
                    </div>
                  </Card>
                )}
              </div>
            </div>
          )}

          {/* ── Instagram ── */}
          {tab === 'instagram' && (
            <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 24, alignItems: 'start' }}>
              <div>
                <p style={{ fontSize: 11, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>Live Preview</p>
                <InstagramCarousel images={carouselUrls} caption={igCaption} name={eventName} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <Card>
                  <p style={{ fontSize: 11, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Caption</p>
                  <CaptionEditor value={igCaption} onChange={setIgCaption} platform="instagram" />
                  <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <HashtagGenerator eventName={eventName} onInsert={tags => setIgCaption(v => v + '\n\n' + tags)} />
                    <Btn size="sm" variant="ghost" onClick={() => handleRegen('instagram')} disabled={regenLoading}
                      style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      {regenLoading ? <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Zap size={12} color="var(--accent)" />}
                      Regenerate with AI
                    </Btn>
                  </div>
                  {groqBackend && <p style={{ fontSize: 10, color: 'var(--t3)', marginTop: 6 }}>
                    Last generated by: {groqBackend === 'groq' ? 'Groq (llama-3.3-70b)' : 'Template'}
                  </p>}
                </Card>
                <Card>
                  <SocialShareButtons platform="instagram" caption={igCaption} />
                </Card>
                {carouselUrls.length > 0 && (
                  <Card>
                    <p style={{ fontSize: 11, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>Slides ({carouselUrls.length})</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(72px,1fr))', gap: 8 }}>
                      {carouselUrls.map((url, i) => (
                        <div
                          key={i}
                          style={{ aspectRatio: '4/5', borderRadius: 8, overflow: 'hidden', cursor: 'pointer', position: 'relative' }}
                          onClick={() => dl(url, `instagram_carousel_${i + 1}.jpg`)}
                          title={`Download slide ${i + 1}`}
                        >
                          <Thumb url={url} />
                          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background .2s' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,.4)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0)')}
                          >
                            <Download size={16} color="#fff" style={{ opacity: 0 }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </div>
            </div>
          )}

          {/* ── Stories ── */}
          {tab === 'stories' && (
            <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 24, alignItems: 'start' }}>
              <div>
                <p style={{ fontSize: 11, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>Preview — tap to advance</p>
                <InstagramStories images={storyUrls} captions={storyCaps} name={eventName} />
              </div>
              <Card>
                <p style={{ fontSize: 11, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 16 }}>Story frames ({storyUrls.length})</p>
                {storyUrls.length === 0 && <p style={{ color: 'var(--t3)', fontSize: 13 }}>No story frames generated.</p>}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {storyUrls.map((url, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--s2)', borderRadius: 'var(--rs)', padding: '10px 14px' }}>
                      <div style={{ width: 40, height: 70, borderRadius: 6, overflow: 'hidden', flexShrink: 0 }}><Thumb url={url} /></div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 13, fontWeight: 500 }}>Frame {i + 1}</p>
                        <p style={{ fontSize: 12, color: 'var(--t2)' }}>{storyCaps[i] ?? ''}</p>
                        <p style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>1080×1920 · 9:16</p>
                      </div>
                      <Btn size="sm" onClick={() => dl(url, `instagram_story_${i + 1}.jpg`)}><Download size={13} /></Btn>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {/* ── Reel ── */}
          {tab === 'reel' && (
            <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: 24, alignItems: 'start' }}>
              <div>
                <p style={{ fontSize: 11, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>Preview</p>
                <InstagramReel videoUrl={reelUrl} caption={reelCaption} name={eventName} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <Card>
                  <p style={{ fontSize: 11, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Reel caption</p>
                  <CaptionEditor value={reelCaption} onChange={setReelCaption} platform="reel" />
                  <div style={{ marginTop: 10 }}>
                    <Btn size="sm" variant="ghost" onClick={() => handleRegen('reel')} disabled={regenLoading}
                      style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      {regenLoading ? <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Zap size={12} color="var(--accent)" />}
                      Regenerate with AI
                    </Btn>
                  </div>
                </Card>
                <Card>
                  <SocialShareButtons platform="reel" caption={reelCaption} />
                </Card>
                {reelUrl
                  ? <Card>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--s2)', borderRadius: 'var(--rs)', padding: '10px 14px' }}>
                        <Film size={20} />
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 13, fontWeight: 500 }}>instagram_reel.mp4</p>
                          <p style={{ fontSize: 11, color: 'var(--t3)' }}>1080×1920 · H.264</p>
                        </div>
                        <Btn size="sm" onClick={() => dl(reelUrl, 'instagram_reel.mp4')}><Download size={13} /> Download</Btn>
                      </div>
                    </Card>
                  : <Card style={{ borderColor: 'var(--yellow)', background: 'rgba(245,158,11,.05)' }}>
                      <p style={{ fontSize: 13, color: '#fde68a', display: 'flex', alignItems: 'center', gap: 8 }}><AlertTriangle size={14} /> No video assets uploaded. Add MP4/MOV files to generate a Reel.</p>
                    </Card>
                }
              </div>
            </div>
          )}

          {/* ── Case Study ── */}
          {tab === 'casestudy' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <h2 style={{ fontSize: 18, fontWeight: 700 }}>Case Study Draft</h2>
                  <p style={{ fontSize: 13, color: 'var(--t2)', marginTop: 4 }}>Structured, post-ready document</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {getUrl(/case_study/) && (
                    <Btn onClick={() => dl(getUrl(/case_study/)!, 'case_study.md')}>
                      <FileDown size={14} /> Download .md
                    </Btn>
                  )}
                </div>
              </div>
              <Card>
                <pre style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: 'var(--t2)', lineHeight: 1.8, whiteSpace: 'pre-wrap', maxHeight: 600, overflowY: 'auto' }}>
                  {caption('case_study') || `# Case Study: ${eventName}\n\nGenerated by Content & Design Engine.\nDownload the .md file to view the full document.`}
                </pre>
              </Card>
            </div>
          )}

          {/* ── AI Report ── */}
          {tab === 'report' && (
            <div>
              <div style={{ marginBottom: 20 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700 }}>AI Selection Report</h2>
                <p style={{ fontSize: 13, color: 'var(--t2)', marginTop: 4 }}>Why each asset was selected</p>
              </div>

              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 12, marginBottom: 24 }}>
                {[
                  { label: 'Files Generated', value: fileNames.length,    icon: Folder },
                  { label: 'Carousel Slides', value: carouselUrls.length, icon: Image },
                  { label: 'Story Frames',    value: storyUrls.length,    icon: Smartphone },
                  { label: 'Has Reel',        value: reelUrl ? 'Yes' : 'No', icon: Film },
                  ...(isBrandMode ? [{ label: 'Brands Matched', value: brandIds.length, icon: TagIcon }] : []),
                ].map(({ label, value, icon: StatIcon }) => (
                  <motion.div
                    key={label}
                    whileHover={{ y: -2 }}
                    style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: 'var(--r)', padding: 16, textAlign: 'center' }}
                  >
                    <div style={{ marginBottom: 8, color: 'var(--a2)' }}><StatIcon size={28} /></div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--a2)' }}>{value}</div>
                    <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 4 }}>{label}</div>
                  </motion.div>
                ))}
              </div>

              {/* File list */}
              <Card>
                <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>All Generated Files</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {fileNames.map(name => {
                    const ext = name.split('.').pop()?.toLowerCase() ?? ''
                    const isImg = ['jpg', 'jpeg', 'png'].includes(ext)
                    const isVid = ['mp4', 'mov'].includes(ext)
                    return (
                      <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--s2)', borderRadius: 'var(--rs)', padding: '9px 14px' }}>
                        {isImg
                          ? <div style={{ width: 36, height: 36, borderRadius: 6, overflow: 'hidden', flexShrink: 0 }}><Thumb url={files[name]} /></div>
                          : <span style={{ color: 'var(--t2)' }}>{isVid ? <Film size={16} /> : <File size={16} />}</span>
                        }
                        <span style={{ flex: 1, fontSize: 13, color: 'var(--t2)' }}>{name}</span>
                        <span style={{ fontSize: 11, background: isImg ? '#1e3a5f' : isVid ? '#3b1f5e' : '#1a3a2a', color: isImg ? '#60a5fa' : isVid ? '#c084fc' : '#4ade80', borderRadius: 5, padding: '2px 8px', fontWeight: 600 }}>
                          {ext.toUpperCase()}
                        </span>
                        <Btn size="sm" variant="ghost" onClick={() => dl(files[name], name)}><Download size={12} /></Btn>
                      </div>
                    )
                  })}
                </div>
              </Card>
            </div>
          )}

        </motion.div>
      </AnimatePresence>
    </div>
  )
}
