import { useState, useEffect, useRef } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Legend, Cell
} from 'recharts'
import ChartCard from '../components/ChartCard'
import { useI18n } from '../I18nContext'
import './Reports.css'

const API = 'http://localhost:5000/api'
const COLORS = ['#6366f1', '#8b5cf6', '#22d3ee', '#34d399', '#fbbf24']

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

/* ────────────────── Professional PDF Generator ──────────────────── */
function generateProfessionalPDF(report, t, locale) {
  return new Promise(async (resolve) => {
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF('p', 'mm', 'a4')
    const W = 210, H = 297
    const margin = 18
    const contentW = W - margin * 2
    let y = 0

    // Load Roboto font for Turkish character support
    try {
      const fontResp = await fetch('/fonts/Roboto-Regular.ttf')
      const fontBuf = await fontResp.arrayBuffer()
      const bytes = new Uint8Array(fontBuf)
      let binary = ''
      const chunkSize = 8192
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize))
      }
      const fontBase64 = btoa(binary)
      doc.addFileToVFS('Roboto-Regular.ttf', fontBase64)
      doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal')
      doc.addFont('Roboto-Regular.ttf', 'Roboto', 'bold')
      doc.setFont('Roboto')
    } catch (e) {
      console.warn('Roboto font load failed, falling back to helvetica', e)
    }

    const fontFamily = doc.getFontList()['Roboto'] ? 'Roboto' : 'helvetica'

    const colors = {
      primary: [99, 102, 241],
      dark: [15, 23, 42],
      text: [30, 41, 59],
      muted: [100, 116, 139],
      white: [255, 255, 255],
      emerald: [16, 185, 129],
      rose: [239, 68, 68],
      amber: [245, 158, 11],
      cyan: [6, 182, 212],
      lightBg: [241, 245, 249],
      border: [226, 232, 240],
    }

    const dateStr = new Date().toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-US', {
      day: 'numeric', month: 'long', year: 'numeric'
    })

    // ─── PAGE 1: Cover ───
    // Header band
    doc.setFillColor(...colors.primary)
    doc.rect(0, 0, W, 55, 'F')
    doc.setFillColor(139, 92, 246) // secondary purple
    doc.rect(0, 55, W, 3, 'F')

    // Title
    doc.setFont(fontFamily, 'bold')
    doc.setTextColor(...colors.white)
    doc.setFontSize(22)
    doc.text(t('pdfTitle'), W / 2, 28, { align: 'center' })
    doc.setFontSize(10)
    doc.setFont(fontFamily, 'normal')
    doc.text(dateStr, W / 2, 38, { align: 'center' })
    doc.setFontSize(8)
    doc.text(t('pdfPrepared'), W / 2, 46, { align: 'center' })

    y = 70

    // Executive Summary Box
    doc.setFillColor(...colors.lightBg)
    doc.roundedRect(margin, y, contentW, 28, 3, 3, 'F')
    doc.setDrawColor(...colors.border)
    doc.roundedRect(margin, y, contentW, 28, 3, 3, 'S')

    doc.setFont(fontFamily, 'bold')
    doc.setTextColor(...colors.primary)
    doc.setFontSize(11)
    doc.text(t('pdfExecSummary'), margin + 8, y + 10)
    doc.setFont(fontFamily, 'normal')
    doc.setTextColor(...colors.text)
    doc.setFontSize(8.5)
    doc.text(t('pdfExecDesc'), margin + 8, y + 19, { maxWidth: contentW - 16 })

    y += 40

    // ─── KPI Section ───
    doc.setFont(fontFamily, 'bold')
    doc.setTextColor(...colors.dark)
    doc.setFontSize(13)
    doc.text(t('pdfKpiTitle'), margin, y)
    y += 3
    doc.setDrawColor(...colors.primary)
    doc.setLineWidth(0.8)
    doc.line(margin, y, margin + 60, y)
    y += 10

    const { overview } = report
    const kpis = [
      { label: t('totalIncidentsLabel'), value: overview.total_incidents.toLocaleString(), color: colors.primary },
      { label: t('resolutionRate'), value: `${overview.resolution_rate}%`, color: colors.emerald },
      { label: t('slaComplianceLabel'), value: `${overview.overall_sla}%`, color: colors.cyan },
      { label: t('avgResolutionLabel'), value: `${overview.avg_resolution}h`, color: colors.amber },
      { label: t('resolvedLabel'), value: overview.resolved_count.toLocaleString(), color: colors.emerald },
      { label: t('activeLabel'), value: overview.active_count.toString(), color: colors.rose },
    ]

    const kpiW = (contentW - 10) / 3
    kpis.forEach((kpi, i) => {
      const col = i % 3
      const row = Math.floor(i / 3)
      const x = margin + col * (kpiW + 5)
      const ky = y + row * 28

      doc.setFillColor(248, 250, 252)
      doc.roundedRect(x, ky, kpiW, 24, 2, 2, 'F')
      doc.setDrawColor(...colors.border)
      doc.roundedRect(x, ky, kpiW, 24, 2, 2, 'S')

      // Left accent bar
      doc.setFillColor(...kpi.color)
      doc.rect(x, ky, 2.5, 24, 'F')

      doc.setFont(fontFamily, 'bold')
      doc.setTextColor(...kpi.color)
      doc.setFontSize(16)
      doc.text(kpi.value, x + 10, ky + 11)

      doc.setFont(fontFamily, 'normal')
      doc.setTextColor(...colors.muted)
      doc.setFontSize(7.5)
      doc.text(kpi.label, x + 10, ky + 19)
    })

    y += 68

    // ─── SLA Analysis ───
    doc.setFont(fontFamily, 'bold')
    doc.setTextColor(...colors.dark)
    doc.setFontSize(13)
    doc.text(t('pdfSlaTitle'), margin, y)
    y += 3
    doc.setDrawColor(...colors.primary)
    doc.line(margin, y, margin + 60, y)
    y += 10

    // SLA by Priority Table
    const slaPriorities = report.monthly_data || []
    const tableHeaders = [
      locale === 'tr' ? 'Öncelik' : 'Priority',
      locale === 'tr' ? 'Toplam' : 'Total',
      locale === 'tr' ? 'SLA Met' : 'SLA Met',
      locale === 'tr' ? 'SLA Oran' : 'SLA Rate',
    ]

    // Fetch priority data from overview if not available
    const teamData = report.team_performance || []
    const teamHeaders = [
      locale === 'tr' ? 'Ekip' : 'Team',
      locale === 'tr' ? 'Olay' : 'Incidents',
      locale === 'tr' ? 'SLA %' : 'SLA %',
      locale === 'tr' ? 'Ort. Çözüm' : 'Avg Res.',
    ]

    // Team table
    const colWidths = [contentW * 0.4, contentW * 0.18, contentW * 0.18, contentW * 0.24]

    // Header row
    doc.setFillColor(...colors.primary)
    doc.rect(margin, y, contentW, 8, 'F')
    doc.setFont(fontFamily, 'bold')
    doc.setTextColor(...colors.white)
    doc.setFontSize(7.5)
    let tx = margin + 3
    teamHeaders.forEach((h, i) => {
      doc.text(h, tx, y + 5.5)
      tx += colWidths[i]
    })
    y += 8

    // Data rows
    teamData.slice(0, 10).forEach((t2, idx) => {
      const bgColor = idx % 2 === 0 ? [248, 250, 252] : [255, 255, 255]
      doc.setFillColor(...bgColor)
      doc.rect(margin, y, contentW, 7, 'F')

      doc.setFont(fontFamily, 'normal')
      doc.setTextColor(...colors.text)
      doc.setFontSize(7.5)

      tx = margin + 3
      doc.text(t2.assignment_group, tx, y + 5)
      tx += colWidths[0]
      doc.text(t2.incidents.toString(), tx, y + 5)
      tx += colWidths[1]

      const slaColor = t2.sla_rate >= 60 ? colors.emerald : colors.rose
      doc.setTextColor(...slaColor)
      doc.setFont(fontFamily, 'bold')
      doc.text(`${t2.sla_rate}%`, tx, y + 5)
      tx += colWidths[2]

      doc.setTextColor(...colors.text)
      doc.setFont(fontFamily, 'normal')
      doc.text(`${t2.avg_resolution}h`, tx, y + 5)

      y += 7
    })

    // Border
    doc.setDrawColor(...colors.border)
    doc.rect(margin, y - 7 * Math.min(teamData.length, 10) - 8, contentW, 7 * Math.min(teamData.length, 10) + 8, 'S')

    y += 12

    // ─── PAGE 2: Insights & Categories ───
    doc.addPage()
    y = 20

    // Page 2 header bar
    doc.setFillColor(...colors.primary)
    doc.rect(0, 0, W, 12, 'F')
    doc.setFont(fontFamily, 'bold')
    doc.setTextColor(...colors.white)
    doc.setFontSize(8)
    doc.text(t('pdfTitle'), margin, 8)
    doc.text(dateStr, W - margin, 8, { align: 'right' })

    // Insights Section
    doc.setFont(fontFamily, 'bold')
    doc.setTextColor(...colors.dark)
    doc.setFontSize(13)
    doc.text(t('pdfInsightsTitle'), margin, y)
    y += 3
    doc.setDrawColor(...colors.primary)
    doc.line(margin, y, margin + 60, y)
    y += 10

    const insightColors = {
      warning: colors.amber,
      success: colors.emerald,
      info: colors.cyan,
    }

    report.insights.forEach((insight) => {
      const accentColor = insightColors[insight.type] || colors.primary
      const boxH = 22

      doc.setFillColor(248, 250, 252)
      doc.roundedRect(margin, y, contentW, boxH, 2, 2, 'F')
      doc.setDrawColor(...colors.border)
      doc.roundedRect(margin, y, contentW, boxH, 2, 2, 'S')

      // Left accent
      doc.setFillColor(...accentColor)
      doc.rect(margin, y, 3, boxH, 'F')

      // Icon label
      const typeLabel = insight.type === 'warning' ? t('insightWarning') :
                        insight.type === 'success' ? t('insightSuccess') : t('insightInfo')

      doc.setFillColor(...accentColor)
      doc.roundedRect(margin + 8, y + 3, 16, 5, 1, 1, 'F')
      doc.setFont(fontFamily, 'bold')
      doc.setTextColor(...colors.white)
      doc.setFontSize(5.5)
      doc.text(typeLabel.toUpperCase(), margin + 16, y + 6.5, { align: 'center' })

      // Title
      doc.setFont(fontFamily, 'bold')
      doc.setTextColor(...colors.dark)
      doc.setFontSize(9)
      doc.text(insight.title, margin + 28, y + 8)

      // Description
      doc.setFont(fontFamily, 'normal')
      doc.setTextColor(...colors.muted)
      doc.setFontSize(7.5)
      doc.text(insight.description, margin + 8, y + 17, { maxWidth: contentW - 16 })

      y += boxH + 5
    })

    y += 8

    // Category Distribution
    doc.setFont(fontFamily, 'bold')
    doc.setTextColor(...colors.dark)
    doc.setFontSize(13)
    doc.text(t('pdfCategoryTitle'), margin, y)
    y += 3
    doc.setDrawColor(...colors.primary)
    doc.line(margin, y, margin + 60, y)
    y += 10

    const maxCatCount = Math.max(...report.top_categories.map(c => c.count))
    report.top_categories.forEach((cat, i) => {
      const barWidth = (cat.count / maxCatCount) * (contentW - 70)

      doc.setFont(fontFamily, 'normal')
      doc.setTextColor(...colors.text)
      doc.setFontSize(8)
      doc.text(cat.category, margin, y + 4)

      // Bar background
      doc.setFillColor(241, 245, 249)
      doc.roundedRect(margin + 42, y, contentW - 70, 6, 1.5, 1.5, 'F')

      // Bar fill
      const barColors = [[99,102,241],[139,92,246],[34,211,238],[52,211,153],[251,191,36]]
      doc.setFillColor(...barColors[i % barColors.length])
      doc.roundedRect(margin + 42, y, barWidth, 6, 1.5, 1.5, 'F')

      // Count
      doc.setFont(fontFamily, 'bold')
      doc.setTextColor(...colors.dark)
      doc.text(cat.count.toString(), W - margin, y + 4, { align: 'right' })

      y += 11
    })

    y += 10

    // Top Symptoms
    if (report.top_symptoms && report.top_symptoms.length > 0) {
      doc.setFont(fontFamily, 'bold')
      doc.setTextColor(...colors.dark)
      doc.setFontSize(11)
      doc.text(locale === 'tr' ? 'En Çok Bildirilen Belirtiler' : 'Top Reported Symptoms', margin, y)
      y += 8

      report.top_symptoms.forEach((s, i) => {
        doc.setFont(fontFamily, 'normal')
        doc.setTextColor(...colors.muted)
        doc.setFontSize(7.5)
        doc.text(`${i + 1}.`, margin, y + 3.5)
        doc.setTextColor(...colors.text)
        doc.text(s.symptom, margin + 8, y + 3.5)
        doc.setFont(fontFamily, 'bold')
        doc.text(s.count.toString(), W - margin, y + 3.5, { align: 'right' })
        y += 7
      })
    }

    // Footer on all pages
    const pageCount = doc.internal.getNumberOfPages()
    for (let p = 1; p <= pageCount; p++) {
      doc.setPage(p)
      doc.setDrawColor(...colors.border)
      doc.line(margin, H - 15, W - margin, H - 15)
      doc.setFont(fontFamily, 'normal')
      doc.setTextColor(...colors.muted)
      doc.setFontSize(6.5)
      doc.text(t('pdfFooter'), margin, H - 10)
      doc.text(t('pdfConfidential'), W / 2, H - 10, { align: 'center' })
      doc.text(`${t('pdfPage')} ${p}/${pageCount}`, W - margin, H - 10, { align: 'right' })
    }

    const filename = `IT_Executive_Report_${new Date().toISOString().slice(0, 10)}.pdf`
    doc.save(filename)
    resolve()
  })
}

/* ────────────────── Reports Component ──────────────────── */
export default function Reports() {
  const { t, locale } = useI18n()
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    fetch(`${API}/reports/executive-summary?locale=${locale}`)
      .then(r => r.json())
      .then(data => { setReport(data); setLoading(false) })
      .catch(err => { console.error(err); setLoading(false) })
  }, [locale])

  const exportPDF = async () => {
    setExporting(true)
    try {
      await generateProfessionalPDF(report, t, locale)
    } catch (err) {
      console.error('PDF export failed:', err)
    }
    setExporting(false)
  }

  if (loading) return <div className="loading-container"><div className="loading-spinner" /></div>
  if (!report) return null

  const { overview, monthly_data, top_categories, top_symptoms, team_performance, insights } = report

  return (
    <div className="reports-page animate-fade-in">
      <div className="page-header">
        <div className="flex justify-between items-center">
          <div>
            <h1>{t('execReport')}</h1>
            <p>{t('execReportSub')}</p>
          </div>
          <div className="report-header-actions">
            <div className="report-date-badge">
              <span>📅</span>
              <span>{new Date().toLocaleDateString(locale === 'tr' ? 'tr-TR' : 'en-US', { month: 'long', year: 'numeric' })}</span>
            </div>
            <button className="btn btn-primary pdf-export-btn" onClick={exportPDF} disabled={exporting}>
              {exporting ? <><div className="btn-spinner" /> {t('generating')}</> : t('exportPdf')}
            </button>
          </div>
        </div>
      </div>

      {/* Executive Summary Cards */}
      <div className="exec-summary glass-card mb-4">
        <h2 className="exec-title">{t('perfOverview')}</h2>
        <div className="exec-grid">
          <div className="exec-item">
            <span className="exec-value">{overview.total_incidents.toLocaleString()}</span>
            <span className="exec-label">{t('totalIncidentsLabel')}</span>
          </div>
          <div className="exec-item">
            <span className="exec-value text-emerald">{overview.resolution_rate}%</span>
            <span className="exec-label">{t('resolutionRate')}</span>
          </div>
          <div className="exec-item">
            <span className="exec-value text-cyan">{overview.overall_sla}%</span>
            <span className="exec-label">{t('slaComplianceLabel')}</span>
          </div>
          <div className="exec-item">
            <span className="exec-value text-amber">{overview.avg_resolution}h</span>
            <span className="exec-label">{t('avgResolutionLabel')}</span>
          </div>
          <div className="exec-item">
            <span className="exec-value text-emerald">{overview.resolved_count.toLocaleString()}</span>
            <span className="exec-label">{t('resolvedLabel')}</span>
          </div>
          <div className="exec-item">
            <span className="exec-value text-rose">{overview.active_count}</span>
            <span className="exec-label">{t('activeLabel')}</span>
          </div>
        </div>
      </div>

      {/* Insights */}
      <div className="insights-section mb-4">
        <h2 className="section-title">{t('keyInsights')}</h2>
        <div className="insights-grid">
          {insights.map((insight, i) => (
            <div key={i} className={`insight-card glass-card insight-${insight.type}`}>
              <div className="insight-icon">
                {insight.type === 'warning' && '⚠️'}
                {insight.type === 'success' && '✅'}
                {insight.type === 'info' && 'ℹ️'}
              </div>
              <div className="insight-content">
                <h4 className="insight-title">{insight.title}</h4>
                <p className="insight-desc">{insight.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Monthly Trend */}
      <ChartCard title={t('monthlyTrend')} subtitle={t('monthlyTrendSub')} className="mb-4">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={monthly_data}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" />
            <XAxis dataKey="opened_month" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false}
              tickFormatter={(v) => { const p = v.split('-'); return p.length >= 2 ? `${p[1]}/${p[0]?.slice(2)}` : v }} />
            <YAxis yAxisId="left" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
            <Tooltip content={<CustomTooltip />} />
            <Legend formatter={(v) => <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>{v}</span>} />
            <Line yAxisId="left" dataKey="incidents" name={t('incidentsLabel')} stroke="#6366f1" strokeWidth={2.5} dot={{ r: 3 }} />
            <Line yAxisId="left" dataKey="resolved" name={t('resolvedLabel')} stroke="#34d399" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="5 5" />
            <Line yAxisId="right" dataKey="sla_rate" name={`${t('slaRate')} %`} stroke="#fbbf24" strokeWidth={2.5} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Top Issues */}
      <div className="grid-2 mb-4">
        <ChartCard title={t('topCategories')} subtitle={t('topCategoriesSub')}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={top_categories} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis dataKey="category" type="category" width={100} tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" name={t('incidentsLabel')} radius={[0, 6, 6, 0]} barSize={24}>
                {top_categories.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={t('topSymptoms')} subtitle={t('topSymptomsSub')}>
          <div className="symptoms-list">
            {top_symptoms.map((s, i) => (
              <div key={i} className="symptom-item">
                <div className="symptom-info">
                  <span className="symptom-rank">#{i + 1}</span>
                  <span className="symptom-name">{s.symptom}</span>
                </div>
                <div className="symptom-bar-wrap">
                  <div className="symptom-bar" style={{
                    width: `${(s.count / Math.max(...top_symptoms.map(x => x.count))) * 100}%`,
                    background: COLORS[i]
                  }} />
                </div>
                <span className="symptom-count">{s.count}</span>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      {/* Team Performance */}
      <ChartCard title={t('teamRanking')} subtitle={t('teamRankingSub')}>
        <div className="team-ranking-table">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('rank')}</th>
                <th>{t('team')}</th>
                <th>{t('incidentsLabel')}</th>
                <th>{t('slaComplianceLabel')}</th>
                <th>{t('avgResolutionLabel')}</th>
                <th>{t('performance')}</th>
              </tr>
            </thead>
            <tbody>
              {team_performance.map((tp, i) => (
                <tr key={i}>
                  <td>
                    <span className={`rank-badge rank-${i < 3 ? i + 1 : 'default'}`}>
                      {i < 3 ? ['🥇', '🥈', '🥉'][i] : `#${i + 1}`}
                    </span>
                  </td>
                  <td className="team-name">{tp.assignment_group}</td>
                  <td>{tp.incidents}</td>
                  <td>
                    <span className={`badge ${tp.sla_rate >= 60 ? 'badge-sla-met' : 'badge-sla-breached'}`}>
                      {tp.sla_rate}%
                    </span>
                  </td>
                  <td>{tp.avg_resolution}h</td>
                  <td>
                    <div className="perf-bar-track">
                      <div className="perf-bar-fill" style={{
                        width: `${tp.sla_rate}%`,
                        background: tp.sla_rate >= 70 ? '#34d399' : tp.sla_rate >= 50 ? '#fbbf24' : '#fb7185'
                      }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>
    </div>
  )
}
