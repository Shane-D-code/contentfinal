import { useDropzone } from 'react-dropzone'
import { Upload } from 'lucide-react'

export default function DropZone({ onFiles, multiple=true, label, compact }: {
  onFiles:(files:File[])=>void; multiple?:boolean; label?:string; compact?:boolean
}) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onFiles,
    accept: { 'image/*':[], 'video/*':[] },
    multiple,
  })

  if (compact) return (
    <div {...getRootProps()} style={{ border:`1.5px dashed ${isDragActive?'var(--accent)':'var(--b1)'}`, borderRadius:'var(--rs)', padding:'10px 16px', cursor:'pointer', background:isDragActive?'rgba(124,106,255,.06)':'transparent', display:'flex', alignItems:'center', gap:8, transition:'all .2s' }}>
      <input {...getInputProps()} />
      <Upload size={13} color={isDragActive?'var(--accent)':'var(--t3)'} />
      <span style={{ fontSize:12, color:isDragActive?'var(--a2)':'var(--t3)' }}>{isDragActive?'Drop files':label??'Add more files'}</span>
    </div>
  )

  return (
    <div {...getRootProps()} style={{ border:`2px dashed ${isDragActive?'var(--accent)':'var(--b1)'}`, borderRadius:'var(--r)', padding:'48px 24px', textAlign:'center', cursor:'pointer', background:isDragActive?'rgba(124,106,255,.05)':'var(--s1)', transition:'all .2s' }}>
      <input {...getInputProps()} />
      <div style={{ width:56, height:56, borderRadius:'50%', background:'var(--s2)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
        <Upload size={24} color={isDragActive?'var(--accent)':'var(--t3)'} />
      </div>
      <p style={{ fontWeight:600, fontSize:16, color:isDragActive?'var(--a2)':'var(--t1)', marginBottom:6 }}>
        {isDragActive?'Release to upload':'Drop event photos & videos here'}
      </p>
      <p style={{ fontSize:12, color:'var(--t3)' }}>JPG · PNG · MP4 · MOV · up to 200MB each</p>
    </div>
  )
}
