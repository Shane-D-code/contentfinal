/**
 * HashtagGenerator — suggests hashtags based on event name + detected concepts.
 * Allows adding/removing, then copying the full set.
 */
import { useState } from 'react'
import { Plus, X, Copy, Check } from 'lucide-react'
import { slug } from '../../lib/formatters'

interface Props {
  eventName: string
  concepts?: string[]
  onInsert: (tags: string) => void
}

function generateHashtags(eventName: string, concepts: string[]): string[] {
  const base = [
    `#${slug(eventName).replace(/_/g, '')}`,
    '#EventLife',
    '#ContentCreator',
    '#BehindTheScenes',
  ]
  const conceptTags = concepts
    .slice(0, 4)
    .map(c => `#${c.replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '')}`)
    .filter(t => t.length > 2)

  return [...new Set([...base, ...conceptTags])].slice(0, 10)
}

export default function HashtagGenerator({ eventName, concepts = [], onInsert }: Props) {
  const [tags, setTags] = useState<string[]>(() => generateHashtags(eventName, concepts))
  const [custom, setCustom] = useState('')
  const [copied, setCopied] = useState(false)

  const addCustom = () => {
    const t = custom.trim().startsWith('#') ? custom.trim() : `#${custom.trim()}`
    if (t.length > 1 && !tags.includes(t)) {
      setTags(prev => [...prev, t])
      setCustom('')
    }
  }

  const remove = (t: string) => setTags(prev => prev.filter(x => x !== t))

  const copyAll = () => {
    navigator.clipboard.writeText(tags.join(' '))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ background: 'var(--s2)', border: '1px solid var(--b1)', borderRadius: 'var(--rs)', padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--t2)' }}>Hashtags ({tags.length})</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={copyAll} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: '1px solid var(--b1)', borderRadius: 5, padding: '3px 10px', cursor: 'pointer', fontSize: 11, color: 'var(--t2)' }}>
            {copied ? <><Check size={11} color="var(--green)" /> Copied</> : <><Copy size={11} /> Copy all</>}
          </button>
          <button onClick={() => onInsert(tags.join(' '))} style={{ background: 'var(--accent)', border: 'none', borderRadius: 5, padding: '3px 10px', cursor: 'pointer', fontSize: 11, color: '#fff', fontWeight: 600 }}>
            Insert
          </button>
        </div>
      </div>

      {/* Tag chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {tags.map(t => (
          <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(124,106,255,.15)', color: 'var(--a2)', border: '1px solid rgba(124,106,255,.3)', borderRadius: 20, padding: '3px 10px', fontSize: 12 }}>
            {t}
            <button onClick={() => remove(t)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', padding: 0, display: 'flex', lineHeight: 1 }}>
              <X size={11} />
            </button>
          </span>
        ))}
      </div>

      {/* Add custom */}
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          value={custom}
          onChange={e => setCustom(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addCustom() }}
          placeholder="Add hashtag…"
          style={{ flex: 1, background: 'var(--s3)', border: '1px solid var(--b1)', borderRadius: 6, padding: '6px 10px', color: 'var(--t1)', fontSize: 12, outline: 'none' }}
        />
        <button onClick={addCustom} style={{ background: 'var(--s3)', border: '1px solid var(--b1)', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', color: 'var(--t2)', display: 'flex', alignItems: 'center' }}>
          <Plus size={14} />
        </button>
      </div>
    </div>
  )
}
