interface Props {
  value: number  // 0 = Professional, 100 = Casual
  onChange: (v: number) => void
}

export default function BrandVoiceSlider({ value, onChange }: Props) {
  const label = value < 25 ? 'Very Professional' : value < 50 ? 'Professional' : value < 75 ? 'Balanced' : value < 90 ? 'Casual' : 'Very Casual'
  const color = value < 40 ? 'var(--blue)' : value < 70 ? 'var(--accent)' : 'var(--pink)'

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 12 }}>
        <span style={{ color: 'var(--blue)', fontWeight: 600 }}>💼 Professional</span>
        <span style={{ color, fontWeight: 700, fontSize: 13 }}>{label}</span>
        <span style={{ color: 'var(--pink)', fontWeight: 600 }}>😎 Casual</span>
      </div>
      <input
        type="range" min={0} max={100} value={value}
        onChange={e => onChange(Number(e.target.value))}
        aria-label="Brand voice"
        style={{ width: '100%', accentColor: color, cursor: 'pointer', height: 6 }}
      />
      <p style={{ fontSize: 12, color: 'var(--t3)', marginTop: 8, textAlign: 'center' }}>
        {value < 40
          ? 'Formal language, no emojis, insight-focused'
          : value < 70
          ? 'Balanced tone, occasional emojis, engaging'
          : 'Casual language, emojis welcome, behind-the-scenes energy'}
      </p>
    </div>
  )
}
