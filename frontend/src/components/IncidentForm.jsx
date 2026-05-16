import { useState, useEffect } from 'react'
import { useI18n } from '../I18nContext'
import './IncidentForm.css'

const API = 'http://localhost:5000/api'

const IMPACTS = ['1 - High', '2 - Medium', '3 - Low']
const URGENCIES = ['1 - High', '2 - Medium', '3 - Low']
const CONTACT_TYPES = ['Phone', 'Email', 'Self Service', 'IVR', 'Direct Opening']
const SYMPTOMS = [
  'System Slow', 'Service Unavailable', 'Error Message', 'Cannot Access',
  'Data Loss', 'Performance Degradation', 'Intermittent Failure',
  'Configuration Error', 'Security Alert', 'Login Issue'
]
const CLOSE_CODES = [
  'Solved (Permanently)', 'Solved (Work Around)', 'Not Solved (Not Reproducible)',
  'Not Solved (Too Costly)', 'Closed/Resolved by Caller'
]

const PRIORITY_MATRIX = {
  '1 - High|1 - High': '1 - Critical',
  '1 - High|2 - Medium': '2 - High',
  '1 - High|3 - Low': '3 - Moderate',
  '2 - Medium|1 - High': '2 - High',
  '2 - Medium|2 - Medium': '3 - Moderate',
  '2 - Medium|3 - Low': '4 - Low',
  '3 - Low|1 - High': '3 - Moderate',
  '3 - Low|2 - Medium': '4 - Low',
  '3 - Low|3 - Low': '4 - Low',
}

const PRIORITY_COLORS = {
  '1 - Critical': '#ef4444',
  '2 - High': '#f97316',
  '3 - Moderate': '#eab308',
  '4 - Low': '#22c55e',
}

export default function IncidentForm({ mode = 'create', incidentNumber, onClose, onSaved }) {
  const { t } = useI18n()
  const [form, setForm] = useState({
    caller_id: '', category: '', subcategory: '', u_symptom: '',
    impact: '2 - Medium', urgency: '2 - Medium', location: '',
    contact_type: 'Self Service', assignment_group: '',
  })
  const [filters, setFilters] = useState(null)
  const [subcategories, setSubcategories] = useState({})
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(null)
  const [error, setError] = useState(null)
  const [resolveMode, setResolveMode] = useState(false)
  const [closeCode, setCloseCode] = useState('Solved (Permanently)')

  useEffect(() => {
    Promise.all([
      fetch(`${API}/filters`).then(r => r.json()),
      fetch(`${API}/subcategories`).then(r => r.json()),
    ]).then(([f, sc]) => {
      setFilters(f)
      setSubcategories(sc)
    })
  }, [])

  useEffect(() => {
    if (mode === 'edit' && incidentNumber) {
      setLoading(true)
      fetch(`${API}/incidents/${incidentNumber}`)
        .then(r => r.json())
        .then(data => {
          setDetail(data)
          setForm({
            caller_id: data.caller_id || '',
            category: data.category || '',
            subcategory: data.subcategory || '',
            u_symptom: data.u_symptom || '',
            impact: data.impact || '2 - Medium',
            urgency: data.urgency || '2 - Medium',
            location: data.location || '',
            contact_type: data.contact_type || 'Self Service',
            assignment_group: data.assignment_group || '',
          })
          setLoading(false)
        })
        .catch(() => setLoading(false))
    }
  }, [mode, incidentNumber])

  const priority = PRIORITY_MATRIX[`${form.impact}|${form.urgency}`] || '3 - Moderate'
  const subOptions = subcategories[form.category] || []
  const isResolved = detail && (detail.incident_state === 'Resolved' || detail.incident_state === 'Closed')

  const handleChange = (field, value) => {
    setForm(prev => {
      const updated = { ...prev, [field]: value }
      if (field === 'category') updated.subcategory = ''
      return updated
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.category || !form.location || !form.assignment_group) {
      setError(t('fillRequired'))
      return
    }
    setSaving(true)
    setError(null)
    try {
      const url = mode === 'create' ? `${API}/incidents` : `${API}/incidents/${incidentNumber}`
      const method = mode === 'create' ? 'POST' : 'PUT'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, impact: form.impact, urgency: form.urgency }),
      })
      const result = await res.json()
      if (res.ok) {
        setSuccess(mode === 'create' ? `${t('incidentCreated')}: ${result.number}` : t('incidentUpdated'))
        setTimeout(() => { onSaved?.(); onClose() }, 1200)
      } else {
        setError(result.error || 'Error')
      }
    } catch (err) {
      setError(err.message)
    }
    setSaving(false)
  }

  const handleResolve = async () => {
    setSaving(true)
    try {
      const res = await fetch(`${API}/incidents/${incidentNumber}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ close_code: closeCode }),
      })
      if (res.ok) {
        setSuccess(t('incidentResolved'))
        setTimeout(() => { onSaved?.(); onClose() }, 1200)
      }
    } catch (err) {
      setError(err.message)
    }
    setSaving(false)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div>
            <h2>{mode === 'create' ? t('newIncident') : `${incidentNumber}`}</h2>
            <p className="modal-subtitle">
              {mode === 'create' ? t('newIncidentSub') : t('editIncidentSub')}
            </p>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {loading ? (
          <div className="modal-loading"><div className="loading-spinner" /></div>
        ) : (
          <>
            {/* Detail banner for edit mode */}
            {detail && (
              <div className="incident-detail-banner">
                <div className="detail-chip">{detail.incident_state}</div>
                <div className="detail-chip" style={{ background: PRIORITY_COLORS[detail.priority] + '22', color: PRIORITY_COLORS[detail.priority] }}>
                  {detail.priority}
                </div>
                {detail.opened_at && <div className="detail-meta">📅 {new Date(detail.opened_at).toLocaleString()}</div>}
                {detail.resolution_hours && <div className="detail-meta">⏱ {detail.resolution_hours}h</div>}
                <div className={`detail-chip ${detail.made_sla ? 'sla-met' : 'sla-breach'}`}>
                  SLA: {detail.made_sla ? '✓' : '✗'}
                </div>
              </div>
            )}

            {success && <div className="form-alert success">{success}</div>}
            {error && <div className="form-alert error">{error}</div>}

            <form onSubmit={handleSubmit} className="incident-form">
              {/* Row 1 */}
              <div className="form-row">
                <div className="form-group">
                  <label>{t('callerLabel')} </label>
                  <input type="text" value={form.caller_id} onChange={e => handleChange('caller_id', e.target.value)}
                    placeholder={t('callerPlaceholder')} />
                </div>
                <div className="form-group">
                  <label>{t('contactTypeLabel')}</label>
                  <select value={form.contact_type} onChange={e => handleChange('contact_type', e.target.value)}>
                    {CONTACT_TYPES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {/* Row 2 */}
              <div className="form-row">
                <div className="form-group">
                  <label>{t('categoryLabel')} <span className="req">*</span></label>
                  <select value={form.category} onChange={e => handleChange('category', e.target.value)} required>
                    <option value="">{t('selectCategory')}</option>
                    {filters?.categories?.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>{t('subcategoryLabel')}</label>
                  <select value={form.subcategory} onChange={e => handleChange('subcategory', e.target.value)}
                    disabled={!form.category}>
                    <option value="">{t('selectSubcategory')}</option>
                    {subOptions.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              {/* Row 3 */}
              <div className="form-row">
                <div className="form-group">
                  <label>{t('symptomLabel')}</label>
                  <select value={form.u_symptom} onChange={e => handleChange('u_symptom', e.target.value)}>
                    <option value="">{t('selectSymptom')}</option>
                    {SYMPTOMS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>{t('locationLabel')} <span className="req">*</span></label>
                  <select value={form.location} onChange={e => handleChange('location', e.target.value)} required>
                    <option value="">{t('selectLocation')}</option>
                    {filters?.locations?.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
              </div>

              {/* Row 4: Impact + Urgency → Priority */}
              <div className="form-row form-row-3">
                <div className="form-group">
                  <label>{t('impactLabel')}</label>
                  <select value={form.impact} onChange={e => handleChange('impact', e.target.value)}>
                    {IMPACTS.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>{t('urgencyLabel')}</label>
                  <select value={form.urgency} onChange={e => handleChange('urgency', e.target.value)}>
                    {URGENCIES.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>{t('priorityLabel')}</label>
                  <div className="priority-badge" style={{ background: PRIORITY_COLORS[priority] + '22', color: PRIORITY_COLORS[priority], borderColor: PRIORITY_COLORS[priority] }}>
                    {priority}
                  </div>
                </div>
              </div>

              {/* Row 5 */}
              <div className="form-row">
                <div className="form-group full-width">
                  <label>{t('assignGroupLabel')} <span className="req">*</span></label>
                  <select value={form.assignment_group} onChange={e => handleChange('assignment_group', e.target.value)} required>
                    <option value="">{t('selectGroup')}</option>
                    {filters?.assignment_groups?.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
              </div>

              {/* Resolve section */}
              {mode === 'edit' && !isResolved && (
                <div className="resolve-section">
                  <button type="button" className="resolve-toggle" onClick={() => setResolveMode(!resolveMode)}>
                    {resolveMode ? '▾' : '▸'} {t('resolveIncident')}
                  </button>
                  {resolveMode && (
                    <div className="resolve-form">
                      <div className="form-group">
                        <label>{t('closeCodeLabel')}</label>
                        <select value={closeCode} onChange={e => setCloseCode(e.target.value)}>
                          {CLOSE_CODES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <button type="button" className="btn-resolve" onClick={handleResolve} disabled={saving}>
                        ✓ {t('markResolved')}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="form-actions">
                <button type="button" className="btn-cancel" onClick={onClose}>{t('cancelBtn')}</button>
                {!isResolved && (
                  <button type="submit" className="btn-save" disabled={saving}>
                    {saving ? <><div className="btn-spinner" /> {t('saving')}</> : mode === 'create' ? t('createBtn') : t('saveBtn')}
                  </button>
                )}
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
