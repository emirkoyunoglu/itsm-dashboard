import { useState, useEffect } from 'react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import KPICard from '../components/KPICard'
import ChartCard from '../components/ChartCard'
import DateRangePicker from '../components/DateRangePicker'
import { useI18n } from '../I18nContext'
import { useDateRange } from '../DateRangeContext'
import './Dashboard.css'

const API = 'http://localhost:5000/api'
const COLORS = ['#6366f1', '#8b5cf6', '#22d3ee', '#34d399', '#fbbf24', '#fb7185']

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload) return null
  return (
    <div className="custom-tooltip">
      <p className="tooltip-label">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="tooltip-value" style={{ color: entry.color }}>
          {entry.name}: <strong>{typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}</strong>
        </p>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const { t } = useI18n()
  const { startDate, endDate, dateRange, setDates, dateParams } = useDateRange()
  const [summary, setSummary] = useState(null)
  const [trends, setTrends] = useState([])
  const [priorityDist, setPriorityDist] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const dp = dateParams()
    const qs = dp ? `&${dp}` : ''
    const qs2 = dp ? `?${dp}` : ''
    Promise.all([
      fetch(`${API}/summary${qs2}`).then(r => r.json()),
      fetch(`${API}/trends?granularity=monthly${qs}`).then(r => r.json()),
      fetch(`${API}/priority-distribution${qs2}`).then(r => r.json()),
      fetch(`${API}/category-analysis${qs2}`).then(r => r.json()),
    ]).then(([sum, trend, prio, cat]) => {
      setSummary(sum)
      setTrends(trend)
      setPriorityDist(prio)
      setCategories(cat.categories || [])
      setLoading(false)
    }).catch(err => {
      console.error('Failed to fetch dashboard data:', err)
      setLoading(false)
    })
  }, [startDate, endDate])

  if (loading) return <div className="loading-container"><div className="loading-spinner" /></div>
  if (!summary) return null

  return (
    <div className="dashboard-page animate-fade-in">
      <div className="page-header">
        <div>
          <h1>{t('dashTitle')}</h1>
          <p>{t('dashSubtitle')}</p>
        </div>
        <DateRangePicker startDate={startDate} endDate={endDate} onChange={setDates} dateRange={dateRange} />
      </div>

      {/* KPI Cards */}
      <div className="grid-4 mb-4">
        <KPICard title={t('totalIncidents')} value={summary.total_incidents} icon="🎫" color="primary" delay={1} />
        <KPICard title={t('activeIncidents')} value={summary.active_incidents} icon="⚡" color="amber" delay={2} />
        <KPICard title={t('slaCompliance')} value={summary.sla_compliance_rate} suffix="%" icon="✓" color="emerald" delay={3} />
        <KPICard title={t('avgResolution')} value={summary.avg_resolution_hours} suffix="h" icon="⏱" color="cyan" delay={4} />
      </div>

      <div className="grid-4 mb-4">
        <KPICard title={t('resolved')} value={summary.resolved_incidents} icon="✅" color="emerald" delay={5} />
        <KPICard title={t('reopenRate')} value={summary.reopen_rate} suffix="%" icon="🔄" color="rose" delay={6} />
        <KPICard title={t('reassignmentRate')} value={summary.reassignment_rate} suffix="%" icon="👥" color="amber" delay={7} />
        <KPICard title={t('knowledgeUsage')} value={summary.knowledge_usage_rate} suffix="%" icon="📚" color="primary" delay={8} />
      </div>

      {/* Charts Row 1 */}
      <div className="grid-2 mb-4">
        <ChartCard title={t('volumeTrend')} subtitle={t('volumeTrendSub')}>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={trends}>
              <defs>
                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" />
              <XAxis dataKey="period" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: 'rgba(148,163,184,0.1)' }} tickLine={false}
                tickFormatter={(v) => { const p = v.split('-'); return p.length >= 2 ? `${p[1]}/${p[0]?.slice(2)}` : v }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="incident_count" name={t('incidentsLabel')} stroke="#6366f1" strokeWidth={2.5}
                fill="url(#colorCount)" dot={false} activeDot={{ r: 5, fill: '#6366f1', stroke: '#fff', strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={t('priorityDist')} subtitle={t('priorityDistSub')}>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={priorityDist} cx="50%" cy="50%" innerRadius={65} outerRadius={100} paddingAngle={3}
                dataKey="count" nameKey="priority" stroke="none">
                {priorityDist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend formatter={(v) => <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Charts Row 2 */}
      <div className="grid-2 mb-4">
        <ChartCard title={t('categoryAnalysis')} subtitle={t('categoryAnalysisSub')}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={categories} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis dataKey="category" type="category" width={110} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" name={t('count')} fill="#8b5cf6" radius={[0, 6, 6, 0]} barSize={28}>
                {categories.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={t('slaTrend')} subtitle={t('slaTrendSub')}>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={trends}>
              <defs>
                <linearGradient id="colorSLA" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#34d399" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" />
              <XAxis dataKey="period" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={{ stroke: 'rgba(148,163,184,0.1)' }} tickLine={false}
                tickFormatter={(v) => { const p = v.split('-'); return p.length >= 2 ? `${p[1]}/${p[0]?.slice(2)}` : v }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="sla_rate" name={t('slaRate')} stroke="#34d399" strokeWidth={2.5}
                fill="url(#colorSLA)" dot={false} activeDot={{ r: 5, fill: '#34d399', stroke: '#fff', strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Priority SLA */}
      <ChartCard title={t('prioritySLA')} subtitle={t('prioritySLASub')}>
        <div className="priority-sla-grid">
          {priorityDist.map((item, i) => (
            <div key={i} className="priority-sla-item glass-card">
              <div className="psi-header">
                <span className="psi-color" style={{ background: COLORS[i] }} />
                <span className="psi-name">{item.priority}</span>
              </div>
              <div className="psi-stats">
                <div className="psi-stat">
                  <span className="psi-stat-value">{item.count}</span>
                  <span className="psi-stat-label">{t('incidentsLabel')}</span>
                </div>
                <div className="psi-stat">
                  <span className="psi-stat-value" style={{ color: item.sla_rate >= 70 ? '#34d399' : '#fb7185' }}>
                    {item.sla_rate}%
                  </span>
                  <span className="psi-stat-label">{t('slaMet')}</span>
                </div>
              </div>
              <div className="psi-bar-track">
                <div className="psi-bar-fill" style={{ width: `${item.sla_rate}%`, background: COLORS[i] }} />
              </div>
            </div>
          ))}
        </div>
      </ChartCard>
    </div>
  )
}
