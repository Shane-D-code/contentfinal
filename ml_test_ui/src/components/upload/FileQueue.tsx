/**
 * FileQueue — shows uploaded files with size, type icon, warnings, and remove button.
 * Detects duplicates and large files (>50MB).
 */
import { X, Image, Film, AlertTriangle } from 'lucide-react'
import { fmtBytes } from '../../lib/formatters'
import { LARGE_FILE_WARNING_MB, MAX_FILE_SIZE_MB } from '../../lib/constants'

interface Props {
  files: File[]
  onRemove: (name: string) => void
}

export default function FileQueue({ files, onRemove }: Props) {
  if (!files.length) return null

  // Detect duplicates by name
  const nameCounts = files.reduce<Record<string, number>>((acc, f) => {
    acc[f.name] = (acc[f.name] ?? 0) + 1
    return acc
  }, {})

  const images = files.filter(f => f.type.startsWith('image/')).length
  const videos = files.filter(f => f.type.startsWith('video/')).length

  return (
    <div style={{ marginTop: 14 }}>
      {/* Summary row */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--t2)', fontWeight: 600 }}>{files.length} files queued</span>
        {images > 0 && <span style={{ fontSize: 11, background: '#1e3a5f', color: '#60a5fa', borderRadius: 5, padding: '2px 8px' }}>📷 {images} images</span>}
        {videos > 0 && <span style={{ fontSize: 11, background: '#3b1f5e', color: '#c084fc', borderRadius: 5, padding: '2px 8px' }}>🎬 {videos} videos</span>}
      </div>

      {/* File list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
        {files.map(f => {
          const isLarge = f.size > LARGE_FILE_WARNING_MB * 1024 * 1024
          const isTooBig = f.size > MAX_FILE_SIZE_MB * 1024 * 1024
          const isDuplicate = nameCounts[f.name] > 1
          const isVideo = f.type.startsWith('video/')

          return (
            <div
              key={f.name + f.size}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: isTooBig ? 'rgba(239,68,68,.08)' : isDuplicate ? 'rgba(245,158,11,.08)' : 'var(--s2)',
                border: `1px solid ${isTooBig ? 'rgba(239,68,68,.3)' : isDuplicate ? 'rgba(245,158,11,.3)' : 'var(--b1)'}`,
                borderRadius: 'var(--rs)', padding: '8px 12px',
              }}
            >
              {isVideo
                ? <Film size={14} color="var(--pink)" style={{ flexShrink: 0 }} />
                : <Image size={14} color="var(--blue)" style={{ flexShrink: 0 }} />
              }

              <span style={{ flex: 1, fontSize: 12, color: 'var(--t2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {f.name}
              </span>

              <span style={{ fontSize: 11, color: isTooBig ? 'var(--red)' : isLarge ? 'var(--yellow)' : 'var(--t3)', flexShrink: 0 }}>
                {fmtBytes(f.size)}
              </span>

              {/* Warnings */}
              {isTooBig && (
                <span title={`Exceeds ${MAX_FILE_SIZE_MB}MB limit`}>
                  <AlertTriangle size={13} color="var(--red)" />
                </span>
              )}
              {!isTooBig && isLarge && (
                <span title="Large file — may take longer">
                  <AlertTriangle size={13} color="var(--yellow)" />
                </span>
              )}
              {isDuplicate && (
                <span title="Duplicate filename" style={{ fontSize: 10, background: 'rgba(245,158,11,.2)', color: 'var(--yellow)', borderRadius: 4, padding: '1px 6px' }}>
                  DUP
                </span>
              )}

              <button
                onClick={() => onRemove(f.name)}
                aria-label={`Remove ${f.name}`}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--t3)', padding: 2, display: 'flex', flexShrink: 0, borderRadius: 4 }}
              >
                <X size={13} />
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
