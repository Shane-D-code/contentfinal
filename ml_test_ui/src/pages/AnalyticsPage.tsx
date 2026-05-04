import React from 'react'
import { BarChart, Calendar, TrendingUp } from 'lucide-react'
import { Card } from '../components/ui'
import Badge from '../components/Badge'
import { useAnalytics } from '../contexts/AnalyticsContext'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const dummyData = [
  { date: '2024-01-01', jobs: 3 },
  { date: '2024-01-02', jobs: 5 },
  { date: '2024-01-03', jobs: 2 },
  { date: '2024-01-04', jobs: 8 },
]

export default function AnalyticsPage() {
  const { analytics, exportCSV } = useAnalytics()

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
        <BarChart size={28} color="var(--accent)" />
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>Usage Analytics</h1>
          <p style={{ fontSize: 14, color: 'var(--t2)' }}>Your content generation stats</p>
        </div>
        <button onClick={exportCSV} style={{ marginLeft: 'auto', background: 'var(--s2)', border: '1px solid var(--b1)', borderRadius: 'var(--rs)', padding: '8px 16px', color: 'var(--t2)', cursor: 'pointer' }}>
          Export CSV
        </button>
      </div>

      {/* Stats cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, marginBottom: 32 }}>
        <Card>
          <div style={{ fontSize: 36, fontWeight: 700, color: 'var(--accent)', marginBottom: 8 }}>
            {analytics.totalJobs}
          </div>
          <div style={{ color: 'var(--t2)', fontSize: 13 }}>Total jobs</div>
        </Card>
        <Card>
          <div style={{ fontSize: 36, fontWeight: 700, color: 'var(--green)' }}>
            {analytics.avgTime.toFixed(0)}s
          </div>
          <div style={{ color: 'var(--t2)', fontSize: 13 }}>Avg generation time</div>
        </Card>
        <Card>
          <div style={{ fontSize: 36, fontWeight: 700, color: 'var(--blue)' }}>
            {analytics.recentJobs.length}
          </div>
          <div style={{ color: 'var(--t2)', fontSize: 13 }}>Recent jobs</div>
        </Card>
        <Card>
          <div style={{ fontSize: 36, fontWeight: 700, color: 'var(--pink)' }}>
            {(analytics.feedbackScores.reduce((a, b) => a + b, 0) / analytics.feedbackScores.length || 0).toFixed(1)}
          </div>
          <div style={{ color: 'var(--t2)', fontSize: 13 }}>Avg rating</div>
        </Card>
      </div>

      {/* Charts */}
      <Card style={{ marginBottom: 32 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
          <TrendingUp size={18} />
          Jobs over time
        </h3>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={dummyData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="jobs" stroke="var(--accent)" strokeWidth={3} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* Recent jobs */}
      <Card>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Calendar size={18} />
          Recent jobs ({analytics.recentJobs.length})
        </h3>
        <div style={{ maxHeight: 300, overflowY: 'auto' }}>
          {analytics.recentJobs.map(id => (
            <div key={id} style={{ padding: '12px 0', borderBottom: '1px solid var(--b1)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <Badge label="Complete" />
              <span style={{ flex: 1, fontSize: 13 }}>Job {id.slice(-6)}</span>
              <Badge label="Re-run" />


            </div>
          ))}
        </div>
        {analytics.recentJobs.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--t3)', padding: '40px' }}>
            <BarChart size={48} style={{ opacity: 0.5, marginBottom: 12 }} />
            <p>No jobs yet. Create your first content to see stats here.</p>
          </div>
        )}
      </Card>
    </div>
  )
}

