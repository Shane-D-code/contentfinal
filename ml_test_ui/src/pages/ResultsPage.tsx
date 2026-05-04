import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Download, ChevronLeft, FileDown } from 'lucide-react'
import { Card, Btn, Tag } from '../components/ui'
import { LinkedInPreview, InstagramCarousel, InstagramStories, InstagramReel } from '../components/PlatformPreview'
import CaptionEditor from '../components/results/CaptionEditor'
import HashtagGenerator from '../components/results/HashtagGenerator'
import BulkDownload from '../components/export/BulkDownload'
import SocialShareButtons from '../components/export/SocialShareButtons'
import { toast } from '../components/ui/Toast'
import { useAnalytics } from '../contexts/AnalyticsContext'
import { useIsMobile } from '../hooks/useMediaQuery'

type Tab = 'linkedin' | 'instagram' | 'stories' | 'reel' | 'casestudy' | 'report'
interface Props { result: any; eventName: string; onBack: () => void }

function Thumb({ url }: { url: string }) {
  return <img src={url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
}

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'linkedin',  label: 'LinkedIn',   icon: '💼' },
  { id: 'instagram', label: 'Instagram',  icon: '📸' },
  { id: 'stories',   label: 'Stories',    icon: '📱' },
  { id: 'reel',      label: 'Reel',       icon: '🎬' },
  { id: 'casestudy', label: 'Case Study', icon: '📄' },
  { id: 'report',    label: 'AI Report',  icon: '📊' },
]

export default function ResultsPage({ result, eventName, onBack }: Props) {
  const [tab, setTab] = useState<Tab>('linkedin')
  const { trackEvent } = useAnalytics()
  const isMobile = useIsMobile()

  const files: Record<string, string>    = result?.files    ?? {}
  const captions: Record<string, string> = result?.captions ?? {}
  const fileNames = Object.keys(files)

  const getUrl  = (pat: RegExp) => { const k = fileNames.find(n => pat.test(n)); return k ? files[k] : undefined }
  const getUrls = (pat: RegExp) => fileNames.filter(n => pat.test(n)).sort().map(n => files[n])

  const collageUrl   = getUrl(/linkedin_collage/)
  const carouselUrls = getUrls(/instagram_carousel_\d+/)
  const reelUrl      = getUrl(/instagram_reel\.mp4/)
  const storyUrls    = getUrls(/instagram_story_\d+/)

  const [liCaption,   setLiCaption]   = useState(captions['linkedin_caption']       || `Just wrapped ${eventName} — here's what stood out.\n\nThe energy in the room was electric.\n\nWhat's your biggest takeaway from recent events?\n\n#${eventName.replace(/\s+/g, '')} #EventInsights`)
  const [igCaption,   setIgCaption]   = useState(captions['instagram_caption']      || `POV: You attend ${eventName} and forget to eat 😅\n\nSwipe for the moments that didn't make the recap →\n\n#${eventName.replace(/\s+/g, '')} #EventLife`)
  const [reelCaption, setReelCaption] = useState(captions['instagram_reel_caption'] || `24 hours at ${eventName} 🎬\n\nTag someone who needs to be in the room next year 👇\n\n#${eventName.replace(/\s+/g, '')}`)
  const [storyCaps]                   = useState<string[]>(() => {
    const raw = captions['story_captions'] || ''
    if (raw) {
      const lines = raw.split('\n').filter(Boolean).map((l: string) => l.replace(/^Story \d+:\s*/i, '').trim()).filter(Boolean)
      if (lines.length) return lines
    }
    return [`We're at ${eventName} ✨`, 'The main stage 👀', 'Best moment of the day 🎯', 'See you next year 👋']
  })

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

  const gridCols = isMobile ? '1fr' : '1fr 1fr'

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28, flexWrap: 'wrap' }}
      >
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
          <Tag label="✅ Generation complete" color="var(--green)" />
          <BulkDownload files={files} />
        </div>
      </motion.div>

      {/* Tab bar */}
      <div
        role="tablist"
        aria-label="Content platforms"
        style={{ display: 'flex', gap: 4, marginBottom: 28, background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: 'var(--r)', padding: 5, overflowX: 'auto' }}
      >
        {TABS.map(t => (
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
            {t.icon} {!isMobile && t.label}
          </button>
        ))}
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
                <LinkedInPreview images={collageUrl ? [collageUrl] : carouselUrls.slice(0, 6)} caption={liCaption} name={eventName} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <Card>
                  <p style={{ fontSize: 11, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Caption</p>
                  <CaptionEditor value={liCaption} onChange={setLiCaption} platform="linkedin" />
                  <div style={{ marginTop: 12 }}>
                    <HashtagGenerator eventName={eventName} onInsert={tags => setLiCaption(v => v + '\n\n' + tags)} />
                  </div>
                </Card>
                <Card>
                  <SocialShareButtons platform="linkedin" caption={liCaption} />
                </Card>
                {collageUrl && (
                  <Card>
                    <p style={{ fontSize: 11, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>Download</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--s2)', borderRadius: 'var(--rs)', padding: '10px 14px' }}>
                      <div style={{ width: 56, height: 56, borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}><Thumb url={collageUrl} /></div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 13, fontWeight: 500 }}>LinkedIn Collage</p>
                        <p style={{ fontSize: 11, color: 'var(--t3)' }}>1080×1080 JPEG</p>
                      </div>
                      <Btn size="sm" onClick={() => dl(collageUrl, 'linkedin_collage.jpg')}><Download size={13} /> Download</Btn>
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
                  <div style={{ marginTop: 12 }}>
                    <HashtagGenerator eventName={eventName} onInsert={tags => setIgCaption(v => v + '\n\n' + tags)} />
                  </div>
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
                </Card>
                <Card>
                  <SocialShareButtons platform="reel" caption={reelCaption} />
                </Card>
                {reelUrl
                  ? <Card>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--s2)', borderRadius: 'var(--rs)', padding: '10px 14px' }}>
                        <span style={{ fontSize: 20 }}>🎬</span>
                        <div style={{ flex: 1 }}>
                          <p style={{ fontSize: 13, fontWeight: 500 }}>instagram_reel.mp4</p>
                          <p style={{ fontSize: 11, color: 'var(--t3)' }}>1080×1920 · H.264</p>
                        </div>
                        <Btn size="sm" onClick={() => dl(reelUrl, 'instagram_reel.mp4')}><Download size={13} /> Download</Btn>
                      </div>
                    </Card>
                  : <Card style={{ borderColor: 'var(--yellow)', background: 'rgba(245,158,11,.05)' }}>
                      <p style={{ fontSize: 13, color: '#fde68a' }}>⚠ No video assets uploaded. Add MP4/MOV files to generate a Reel.</p>
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
                  {captions['case_study'] || `# Case Study: ${eventName}\n\nGenerated by Content & Design Engine.\nDownload the .md file to view the full document.`}
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
                  { label: 'Files Generated', value: fileNames.length,    icon: '📁' },
                  { label: 'Carousel Slides', value: carouselUrls.length, icon: '🖼️' },
                  { label: 'Story Frames',    value: storyUrls.length,    icon: '📱' },
                  { label: 'Has Reel',        value: reelUrl ? 'Yes' : 'No', icon: '🎬' },
                ].map(({ label, value, icon }) => (
                  <motion.div
                    key={label}
                    whileHover={{ y: -2 }}
                    style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: 'var(--r)', padding: 16, textAlign: 'center' }}
                  >
                    <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>
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
                          : <span style={{ fontSize: 16 }}>{isVid ? '🎬' : '📄'}</span>
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
