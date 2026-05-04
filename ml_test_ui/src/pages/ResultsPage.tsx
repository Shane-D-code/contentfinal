import { useState } from 'react'
import { Download, Copy, Check, AlertTriangle, ChevronLeft } from 'lucide-react'
import { Card, Btn, Tag, ScoreBar } from '../components/ui'
import { LinkedInPreview, InstagramCarousel, InstagramStories, InstagramReel } from '../components/PlatformPreview'

type Tab = 'linkedin' | 'instagram' | 'stories' | 'reel' | 'casestudy' | 'report'
interface Props { result: any; eventName: string; onBack: () => void }

// All /output/* paths go through Vite proxy → backend :8000
const px = (p: string) => p

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      style={{ background: 'none', border: '1px solid var(--b1)', borderRadius: 'var(--rs)', padding: '6px 12px', color: 'var(--t2)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
    >
      {copied ? <><Check size={12} color="var(--green)" /> Copied</> : <><Copy size={12} /> Copy</>}
    </button>
  )
}

function CaptionBox({ text, onChange }: { text: string; onChange: (v: string) => void }) {
  return (
    <div style={{ position: 'relative' }}>
      <textarea
        value={text}
        onChange={e => onChange(e.target.value)}
        style={{ width: '100%', background: 'var(--s2)', border: '1px solid var(--b1)', borderRadius: 'var(--rs)', padding: '12px 14px', color: 'var(--t1)', fontSize: 13, lineHeight: 1.65, resize: 'vertical', minHeight: 140, outline: 'none', fontFamily: 'inherit' }}
      />
      <div style={{ position: 'absolute', top: 8, right: 8 }}><CopyBtn text={text} /></div>
    </div>
  )
}

function Thumb({ url }: { url: string }) {
  return <img src={px(url)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
}

export default function ResultsPage({ result, eventName, onBack }: Props) {
  const [tab, setTab] = useState<Tab>('linkedin')

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

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: 'linkedin',   label: 'LinkedIn',   icon: '💼' },
    { id: 'instagram',  label: 'Instagram',  icon: '📸' },
    { id: 'stories',    label: 'Stories',    icon: '📱' },
    { id: 'reel',       label: 'Reel',       icon: '🎬' },
    { id: 'casestudy',  label: 'Case Study', icon: '📄' },
    { id: 'report',     label: 'AI Report',  icon: '📊' },
  ]

  const dl = (webUrl: string, filename: string) => {
    const a = document.createElement('a')
    a.href = webUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
        <button onClick={onBack} style={{ background: 'var(--s2)', border: '1px solid var(--b1)', borderRadius: 'var(--rs)', padding: '8px 14px', color: 'var(--t2)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <ChevronLeft size={15} /> New Event
        </button>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>{eventName}</h1>
          <p style={{ fontSize: 13, color: 'var(--t2)' }}>{fileNames.length} files generated</p>
        </div>
        <Tag label="✅ Generation complete" color="var(--green)" style={{ marginLeft: 'auto' }} />
      </div>

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 28, background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: 'var(--r)', padding: 5, overflowX: 'auto' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, minWidth: 100, padding: '9px 14px', borderRadius: 'var(--rs)', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, transition: 'all .15s', background: tab === t.id ? 'var(--accent)' : 'transparent', color: tab === t.id ? '#fff' : 'var(--t2)' }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* LinkedIn */}
      {tab === 'linkedin' && (
        <div className="fade-up" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
          <div>
            <p style={{ fontSize: 11, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>Live Preview</p>
            <LinkedInPreview images={collageUrl ? [collageUrl] : carouselUrls.slice(0, 6)} caption={liCaption} name={eventName} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Card>
              <p style={{ fontSize: 11, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Caption — edit before posting</p>
              <CaptionBox text={liCaption} onChange={setLiCaption} />
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <Tag label="Professional tone" color="var(--blue)" />
                <Tag label="~200 words" color="var(--t3)" />
              </div>
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

      {/* Instagram */}
      {tab === 'instagram' && (
        <div className="fade-up" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
          <div>
            <p style={{ fontSize: 11, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>Live Preview</p>
            <InstagramCarousel images={carouselUrls} caption={igCaption} name={eventName} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Card>
              <p style={{ fontSize: 11, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Caption — distinct from LinkedIn</p>
              <CaptionBox text={igCaption} onChange={setIgCaption} />
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <Tag label="Casual tone" color="var(--pink)" />
                <Tag label="Emoji-led" color="var(--t3)" />
              </div>
            </Card>
            {carouselUrls.length > 0 && (
              <Card>
                <p style={{ fontSize: 11, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>Slides ({carouselUrls.length})</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(72px,1fr))', gap: 8 }}>
                  {carouselUrls.map((url, i) => (
                    <div key={i} style={{ aspectRatio: '4/5', borderRadius: 8, overflow: 'hidden', cursor: 'pointer' }} onClick={() => dl(url, `instagram_carousel_${i + 1}.jpg`)}>
                      <Thumb url={url} />
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Stories */}
      {tab === 'stories' && (
        <div className="fade-up" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
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

      {/* Reel */}
      {tab === 'reel' && (
        <div className="fade-up" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
          <div>
            <p style={{ fontSize: 11, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>Preview</p>
            <InstagramReel videoUrl={reelUrl} caption={reelCaption} name={eventName} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Card>
              <p style={{ fontSize: 11, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>Reel caption</p>
              <CaptionBox text={reelCaption} onChange={setReelCaption} />
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
              : <Card style={{ borderColor: 'var(--yellow)', background: '#1a1500' }}>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <AlertTriangle size={16} color="var(--yellow)" style={{ flexShrink: 0, marginTop: 2 }} />
                    <p style={{ fontSize: 13, color: '#fde68a' }}>No video assets uploaded. Add MP4/MOV files to generate a Reel.</p>
                  </div>
                </Card>
            }
          </div>
        </div>
      )}

      {/* Case Study */}
      {tab === 'casestudy' && (
        <div className="fade-up">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700 }}>Case Study Draft</h2>
              <p style={{ fontSize: 13, color: 'var(--t2)', marginTop: 4 }}>Structured, post-ready document</p>
            </div>
            {getUrl(/case_study/) && (
              <Btn onClick={() => dl(getUrl(/case_study/)!, 'case_study.md')}><Download size={14} /> Download .md</Btn>
            )}
          </div>
          <Card>
            <pre style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--t2)', lineHeight: 1.8, whiteSpace: 'pre-wrap', maxHeight: 600, overflowY: 'auto' }}>
              {captions['case_study'] || `# Case Study: ${eventName}\n\nGenerated by Content & Design Engine.\nDownload the .md file to view the full document.`}
            </pre>
          </Card>
        </div>
      )}

      {/* AI Report */}
      {tab === 'report' && (
        <div className="fade-up">
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>AI Selection Report</h2>
            <p style={{ fontSize: 13, color: 'var(--t2)', marginTop: 4 }}>Why each asset was selected</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
            {[
              { label: 'Files Generated', value: fileNames.length,    icon: '📁' },
              { label: 'Carousel Slides', value: carouselUrls.length, icon: '🖼️' },
              { label: 'Story Frames',    value: storyUrls.length,    icon: '📱' },
              { label: 'Has Reel',        value: reelUrl ? 'Yes' : 'No', icon: '🎬' },
            ].map(({ label, value, icon }) => (
              <Card key={label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--a2)' }}>{value}</div>
                <div style={{ fontSize: 12, color: 'var(--t3)', marginTop: 4 }}>{label}</div>
              </Card>
            ))}
          </div>
          <Card style={{ marginBottom: 20 }}>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>Composite Scoring Formula</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <ScoreBar label="Technical Quality (30%)" value={0.7} color="var(--blue)" />
              <ScoreBar label="Aesthetic Quality (20%)" value={0.6} color="var(--pink)" />
              <ScoreBar label="Face Presence (30%)"     value={0.5} color="var(--green)" />
              <ScoreBar label="Concept Relevance (20%)" value={0.65} color="var(--yellow)" />
            </div>
          </Card>
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

    </div>
  )
}
