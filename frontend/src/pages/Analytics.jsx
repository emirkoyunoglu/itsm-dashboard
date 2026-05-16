import { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, Radar, Legend, ComposedChart, Line, Cell
} from 'recharts'
import ChartCard from '../components/ChartCard'
import { useI18n } from '../I18nContext'
import './Analytics.css'

const API = 'http://localhost:5000/api'
const COLORS = ['#6366f1','#8b5cf6','#22d3ee','#34d399','#fbbf24','#fb7185','#fb923c','#a78bfa','#67e8f9','#f97316']

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload) return null
  return (
    <div className="custom-tooltip">
      <p className="tooltip-label">{label}</p>
      {payload.map((e, i) => (
        <p key={i} className="tooltip-value" style={{ color: e.color }}>
          {e.name}: <strong>{typeof e.value === 'number' ? e.value.toLocaleString() : e.value}</strong>
        </p>
      ))}
    </div>
  )
}

export default function Analytics() {
  const { t } = useI18n()
  const [slaData, setSlaData] = useState(null)
  const [groupData, setGroupData] = useState([])
  const [resolutionData, setResolutionData] = useState(null)
  const [heatmapData, setHeatmapData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch(`${API}/sla-performance`).then(r => r.json()),
      fetch(`${API}/assignment-groups`).then(r => r.json()),
      fetch(`${API}/resolution-analysis`).then(r => r.json()),
      fetch(`${API}/heatmap`).then(r => r.json()),
    ]).then(([sla, groups, resolution, heatmap]) => {
      setSlaData(sla); setGroupData(groups); setResolutionData(resolution); setHeatmapData(heatmap); setLoading(false)
    }).catch(err => { console.error(err); setLoading(false) })
  }, [])

  if (loading) return <div className="loading-container"><div className="loading-spinner" /></div>

  const radarData = groupData.slice(0, 6).map(g => ({
    group: g.assignment_group,
    sla: g.sla_compliance,
    incidents: Math.min(100, (g.total_incidents / Math.max(...groupData.map(x => x.total_incidents))) * 100),
    speed: Math.max(0, 100 - (g.avg_resolution_hours / Math.max(...groupData.map(x => x.avg_resolution_hours))) * 100),
  }))

  const days = [t('mon'), t('tue'), t('wed'), t('thu'), t('fri'), t('sat'), t('sun')]
  const maxHeat = Math.max(...heatmapData.map(h => h.count), 1)

  const getHeatColor = (intensity) => {
    if (intensity === 0) return 'var(--heatmap-empty)'
    if (intensity < 0.2) return 'rgba(52, 211, 153, 0.5)'
    if (intensity < 0.4) return 'rgba(74, 222, 128, 0.6)'
    if (intensity < 0.55) return 'rgba(250, 204, 21, 0.6)'
    if (intensity < 0.7) return 'rgba(251, 146, 60, 0.7)'
    if (intensity < 0.85) return 'rgba(239, 68, 68, 0.7)'
    return 'rgba(220, 38, 38, 0.85)'
  }

  return (
    <div className="analytics-page animate-fade-in">
      <div className="page-header">
        <h1>{t('analyticsTitle')}</h1>
        <p>{t('analyticsSub')}</p>
      </div>

      {/* SLA Overview */}
      {slaData && (
        <div className="sla-overview glass-card mb-4">
          <div className="sla-overview-main">
            <div className="sla-donut-container">
              <svg viewBox="0 0 120 120" className="sla-donut">
                <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(148,163,184,0.1)" strokeWidth="10" />
                <circle cx="60" cy="60" r="52" fill="none" stroke="url(#slaGrad)" strokeWidth="10" strokeLinecap="round"
                  strokeDasharray={`${slaData.overall.rate * 3.267} ${326.7 - slaData.overall.rate * 3.267}`}
                  strokeDashoffset="81.675" className="sla-donut-fill" />
                <defs>
                  <linearGradient id="slaGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#34d399" /><stop offset="100%" stopColor="#22d3ee" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="sla-donut-text">
                <span className="sla-donut-value">{slaData.overall.rate}%</span>
                <span className="sla-donut-label">{t('slaRate')}</span>
              </div>
            </div>
            <div className="sla-overview-stats">
              <div className="sla-stat-item">
                <span className="sla-stat-number text-emerald">{slaData.overall.met.toLocaleString()}</span>
                <span className="sla-stat-label">{t('slaMet')}</span>
              </div>
              <div className="sla-stat-item">
                <span className="sla-stat-number text-rose">{slaData.overall.breached.toLocaleString()}</span>
                <span className="sla-stat-label">{t('slaBreach')}</span>
              </div>
              <div className="sla-stat-item">
                <span className="sla-stat-number text-primary">{slaData.overall.total.toLocaleString()}</span>
                <span className="sla-stat-label">{t('totalIncidents')}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SLA by Priority + Resolution */}
      <div className="grid-2 mb-4">
        <ChartCard title={t('slaByPriority')} subtitle={t('slaByPrioritySub')}>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={slaData?.by_priority || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" />
              <XAxis dataKey="priority" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false}
                tickFormatter={v => v.split(' - ')[1] || v} />
              <YAxis yAxisId="left" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="right" orientation="right" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 100]} tickFormatter={v => `${v}%`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend formatter={v => <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>{v}</span>} />
              <Bar yAxisId="left" dataKey="met" name={t('slaMet')} fill="#34d399" radius={[4,4,0,0]} barSize={24} />
              <Bar yAxisId="left" dataKey="breached" name={t('slaBreach')} fill="#fb7185" radius={[4,4,0,0]} barSize={24} />
              <Line yAxisId="right" dataKey="rate" name={`${t('slaRate')} %`} stroke="#fbbf24" strokeWidth={2.5} dot={{ r: 4, fill: '#fbbf24' }} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={t('resolutionDist')} subtitle={t('resolutionDistSub')}>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={resolutionData?.histogram || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" />
              <XAxis dataKey="bucket" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" name={t('incidentsLabel')} radius={[6,6,0,0]} barSize={36}>
                {(resolutionData?.histogram || []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Team Performance */}
      <div className="grid-2 mb-4">
        <ChartCard title={t('teamRadar')} subtitle={t('teamRadarSub')}>
          <ResponsiveContainer width="100%" height={320}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="rgba(148,163,184,0.1)" />
              <PolarAngleAxis dataKey="group" tick={{ fill: '#94a3b8', fontSize: 9 }} />
              <PolarRadiusAxis tick={{ fill: '#64748b', fontSize: 10 }} domain={[0, 100]} />
              <Radar name={t('slaPercent')} dataKey="sla" stroke="#34d399" fill="#34d399" fillOpacity={0.15} strokeWidth={2} />
              <Radar name={t('volume')} dataKey="incidents" stroke="#6366f1" fill="#6366f1" fillOpacity={0.1} strokeWidth={2} />
              <Radar name={t('speed')} dataKey="speed" stroke="#22d3ee" fill="#22d3ee" fillOpacity={0.1} strokeWidth={2} />
              <Legend formatter={v => <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>{v}</span>} />
            </RadarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={t('groupMetrics')} subtitle={t('groupMetricsSub')}>
          <div className="team-table-wrapper">
            <table className="data-table team-table">
              <thead><tr><th>{t('team')}</th><th>{t('incidentsLabel')}</th><th>{t('slaPercent')}</th><th>{t('avgRes')}</th></tr></thead>
              <tbody>
                {groupData.map((g, i) => (
                  <tr key={i}>
                    <td className="team-name">{g.assignment_group}</td>
                    <td>{g.total_incidents}</td>
                    <td><span className={`badge ${g.sla_compliance >= 60 ? 'badge-sla-met' : 'badge-sla-breached'}`}>{g.sla_compliance}%</span></td>
                    <td>{g.avg_resolution_hours}h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      </div>

      {/* Heatmap */}
      <ChartCard title={t('heatmapTitle')} subtitle={t('heatmapSub')}>
        <div className="heatmap-container">
          <div className="heatmap-y-labels">
            {days.map(d => <span key={d} className="heatmap-y-label">{d}</span>)}
          </div>
          <div className="heatmap-grid">
            {days.map((day, dayIdx) => (
              <div key={day} className="heatmap-row">
                {Array.from({ length: 24 }, (_, hour) => {
                  const cell = heatmapData.find(h => h.day === dayIdx && h.hour === hour)
                  const count = cell ? cell.count : 0
                  const intensity = count / maxHeat
                  return (
                    <div key={hour} className="heatmap-cell"
                      style={{ background: getHeatColor(intensity) }}
                      title={`${day} ${hour}:00 — ${count} ${t('incidentsLabel').toLowerCase()}`} />
                  )
                })}
              </div>
            ))}
            <div className="heatmap-x-labels">
              {Array.from({ length: 24 }, (_, h) => <span key={h} className="heatmap-x-label">{h % 3 === 0 ? h : ''}</span>)}
            </div>
          </div>
        </div>
        <div className="heatmap-legend">
          <span className="heatmap-legend-label">{t('less')}</span>
          <div className="heatmap-legend-blocks">
            {['rgba(52,211,153,0.5)','rgba(74,222,128,0.6)','rgba(250,204,21,0.6)','rgba(251,146,60,0.7)','rgba(239,68,68,0.7)','rgba(220,38,38,0.85)']
              .map((c, i) => <div key={i} className="heatmap-legend-block" style={{ background: c }} />)}
          </div>
          <span className="heatmap-legend-label">{t('more')}</span>
        </div>
      </ChartCard>

      {/* Contact Type & Close Codes */}
      <div className="grid-2 mt-4">
        <ChartCard title={t('contactType')} subtitle={t('contactTypeSub')}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={resolutionData?.by_contact_type || []} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis dataKey="contact_type" type="category" width={100} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" name={t('count')} radius={[0,6,6,0]} barSize={24}>
                {(resolutionData?.by_contact_type || []).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={t('closeCodes')} subtitle={t('closeCodesSub')}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={resolutionData?.close_codes || []} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis dataKey="close_code" type="category" width={150} tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" name={t('count')} radius={[0,6,6,0]} barSize={24}>
                {(resolutionData?.close_codes || []).map((_, i) => <Cell key={i} fill={COLORS[(i+3) % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  )
}
