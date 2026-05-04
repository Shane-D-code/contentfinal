/**
 * BulkDownload — downloads all generated files as individual downloads
 * (browser ZIP requires JSZip; we use sequential downloads as fallback).
 */
import { useState } from 'react'
import { Package } from 'lucide-react'
import { Spinner } from '../ui'

interface Props {
  files: Record<string, string>  // filename → web URL
}

export default function BulkDownload({ files }: Props) {
  const [downloading, setDownloading] = useState(false)
  const [done, setDone] = useState(false)

  const downloadAll = async () => {
    setDownloading(true)
    const entries = Object.entries(files).filter(([n]) => /\.(jpg|jpeg|png|mp4|mov|md|json)$/i.test(n))

    for (const [name, url] of entries) {
      await new Promise<void>(resolve => {
        const a = document.createElement('a')
        a.href = url
        a.download = name
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        setTimeout(resolve, 300)  // stagger to avoid browser blocking
      })
    }

    setDownloading(false)
    setDone(true)
    setTimeout(() => setDone(false), 3000)
  }

  const count = Object.keys(files).length

  return (
    <button
      onClick={downloadAll}
      disabled={downloading || count === 0}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 18px', borderRadius: 'var(--rs)', border: 'none', cursor: downloading ? 'wait' : 'pointer',
        background: done ? 'var(--green)' : downloading ? 'var(--s3)' : 'linear-gradient(135deg,#7c6aff,#a78bfa)',
        color: downloading ? 'var(--t3)' : '#fff', fontSize: 13, fontWeight: 600, transition: 'all .2s',
      }}
    >
      {downloading ? <Spinner size={15} color="#fff" /> : done ? '✓' : <Package size={15} />}
      {downloading ? 'Downloading…' : done ? 'Downloaded!' : `Download All (${count} files)`}
    </button>
  )
}
