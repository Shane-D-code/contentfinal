/**
 * SocialShareButtons — platform-specific share/copy actions.
 */
import { useState } from 'react'
import { Copy, Check, ExternalLink } from 'lucide-react'

interface Props {
  platform: 'linkedin' | 'instagram' | 'stories' | 'reel'
  caption: string
  imageUrl?: string
}

export default function SocialShareButtons({ platform, caption, imageUrl }: Props) {
  const [copied, setCopied] = useState(false)

  const copyCaption = () => {
    navigator.clipboard.writeText(caption)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const shareLinkedIn = () => {
    const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}&summary=${encodeURIComponent(caption.slice(0, 700))}`
    window.open(url, '_blank', 'width=600,height=500')
  }

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <button
        onClick={copyCaption}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--s2)', border: '1px solid var(--b1)', borderRadius: 'var(--rs)', cursor: 'pointer', fontSize: 12, color: 'var(--t2)', fontWeight: 500 }}
      >
        {copied ? <><Check size={13} color="var(--green)" /> Caption copied!</> : <><Copy size={13} /> Copy caption</>}
      </button>

      {platform === 'linkedin' && (
        <button
          onClick={shareLinkedIn}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: '#0a66c2', border: 'none', borderRadius: 'var(--rs)', cursor: 'pointer', fontSize: 12, color: '#fff', fontWeight: 600 }}
        >
          <ExternalLink size={13} /> Share on LinkedIn
        </button>
      )}

      {(platform === 'instagram' || platform === 'stories' || platform === 'reel') && (
        <div style={{ fontSize: 11, color: 'var(--t3)', display: 'flex', alignItems: 'center', gap: 4 }}>
          ℹ️ Instagram requires the mobile app to post
        </div>
      )}
    </div>
  )
}
