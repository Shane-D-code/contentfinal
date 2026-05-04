import { useState } from 'react'
import { motion } from 'framer-motion'
import { BarChart3, TrendingUp, Calendar, Download, Star } from 'lucide-react'
import { Card, Btn } from '../components/ui'
import { useAnalytics } from '../contexts/AnalyticsContext'
import { loadJobs } from '../lib/cache'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'
import { format } from 'date-fns'

// Build chart data from cached jobs
function buildChartData(jobs: ReturnType<typeof loadJobs>) {
  const byDay: Record<string, number> = {}
  jobs.forEach(j => {
    const day = format(new Date(j.timestamp), 'MMM d')
    byDay[day] = (byDay[day] ?? 0) + 1
  })
  return Object.entries(byDay).map(([date, count]) => ({ date, count }))
}

export default function AnalyticsPage() {
  const { analytics, exportCSV } = useAnalytics()
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const cachedJobs = loadJobs()
  const chartData = buildChartData(cachedJobs)

  const avgRating = analytics.feedbackScores.length
    ? (analytics.feedbackScores.reduce((a, b) => a + b, 0) / analytics.feedbackScores.length).toFixed(1)
    : '—'

  const stats = [
    { label: 'Total Jobs',       value: analytics.totalJobs || cachedJobs.length, icon: '📊', color: 'var(--accent)' },
    { label: 'Avg Gen Time',     value: analytics.avgTime > 0 ? `${analytics.avgTime.toFixed(0)}s` : '—', icon: '⏱️', color: 'var(--green)' },
    { label: 'Recent Jobs',      value: Math.max(analytics.recentJobs.length, cachedJobs.length), icon: '📁', color: 'var(--blue)' },
    { label: 'Avg Rating',       value: avgRating, icon: '⭐', color: 'var(--yellow)' },
  ]

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32, flexWrap: 'wrap' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg,#7c6aff,#a78bfa)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BarChart3 size={22} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700 }}>Usage Analytics</h1>
            <p style={{ fontSize: 13, color: 'var(--t2)' }}>Your content generation stats</p>
          </div>
        </div>
        <Btn variant="ghost" size="sm" style={{ marginLeft: 'auto' }} onClick={exportCSV}>
          <Download size={14} /> Export CSV
        </Btn>
      </motion.div>

      {/* Stats cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 32 }}>
        {stats.map(({ label, value, icon, color }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            whileHover={{ y: -3 }}
          >
            <Card style={{ textAlign: 'center', cursor: 'default' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>
              <div style={{ fontSize: 32, fontWeight: 800, color, marginBottom: 4 }} className="counter-anim">
                {value}
              </div>
              <div style={{ fontSize: 12, color: 'var(--t3)' }}>{label}</div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 24 }}>
        {/* Line chart */}
        <Card>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrendingUp size={16} color="var(--accent)" /> Jobs over time
          </h3>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--b1)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: 'var(--t3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--t3)', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: 'var(--s2)', border: '1px solid var(--b1)', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: 'var(--t1)' }}
                  itemStyle={{ color: 'var(--a2)' }}
                />
                <Line type="monotone" dataKey="count" stroke="var(--accent)" strokeWidth={2.5} dot={{ fill: 'var(--accent)', r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t3)', fontSize: 13 }}>
              No data yet — run your first job to see trends
            </div>
          )}
        </Card>

        {/* Platform usage */}
        <Card>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 20 }}>Platform usage</h3>
          {Object.values(analytics.platformsUsed).some(v => v > 0) ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={Object.entries(analytics.platformsUsed).map(([k, v]) => ({ name: k, count: v }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--b1)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: 'var(--t3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--t3)', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ background: 'var(--s2)', border: '1px solid var(--b1)', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count" fill="var(--accent)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t3)', fontSize: 13 }}>
              No platform data yet
            </div>
          )}
        </Card>
      </div>

      {/* Recent jobs */}
      <Card style={{ marginBottom: 24 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Calendar size={16} color="var(--accent)" /> Recent jobs ({cachedJobs.length})
        </h3>
        {cachedJobs.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--t3)', padding: '40px 0' }}>
            <BarChart3 size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
            <p style={{ fontSize: 13 }}>No jobs yet. Create your first content to see history here.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
            {cachedJobs.map(job => (
              <motion.div
                key={job.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--s2)', borderRadius: 'var(--rs)' }}
              >
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, fontWeight: 500 }}>{job.eventName}</p>
                  <p style={{ fontSize: 11, color: 'var(--t3)' }}>
                    {format(new Date(job.timestamp), 'MMM d, yyyy · h:mm a')} · {job.fileCount} files
                  </p>
                </div>
                <span style={{ fontSize: 11, background: '#1a3a2a', color: '#4ade80', borderRadius: 5, padding: '2px 8px', fontWeight: 600 }}>
                  Complete
                </span>
              </motion.div>
            ))}
          </div>
        )}
      </Card>

      {/* Feedback */}
      <Card>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Rate your last generation</h3>
        <p style={{ fontSize: 13, color: 'var(--t3)', marginBottom: 16 }}>How satisfied are you with the generated content?</p>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              onMouseEnter={() => setHoverRating(n)}
              onMouseLeave={() => setHoverRating(0)}
              onClick={() => {
                setRating(n)
                // Track feedback
                console.log('Feedback:', n)
              }}
              aria-label={`Rate ${n} star${n > 1 ? 's' : ''}`}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, transition: 'transform .1s' }}
            >
              <Star
                size={28}
                fill={(hoverRating || rating) >= n ? 'var(--yellow)' : 'none'}
                color={(hoverRating || rating) >= n ? 'var(--yellow)' : 'var(--b2)'}
                style={{ transition: 'all .15s' }}
              />
            </button>
          ))}
          {rating > 0 && (
            <span style={{ fontSize: 13, color: 'var(--t2)', alignSelf: 'center', marginLeft: 8 }}>
              {['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent!'][rating]}
            </span>
          )}
        </div>
        {rating > 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <p style={{ fontSize: 13, color: 'var(--green)' }}>✓ Thanks for your feedback!</p>
          </motion.div>
        )}
      </Card>
    </div>
  )
}
