import { useState, useEffect, useCallback } from 'react'
import DataTable from '../components/DataTable'
import DateRangePicker from '../components/DateRangePicker'
import IncidentForm from '../components/IncidentForm'
import { useI18n } from '../I18nContext'
import { useDateRange } from '../DateRangeContext'
import './Incidents.css'

const API = 'http://localhost:5000/api'

const COLUMNS = [
  { key: 'number', label: 'ID' },
  { key: 'incident_state', label: 'Status' },
  { key: 'priority', label: 'Priority' },
  { key: 'category', label: 'Category' },
  { key: 'u_symptom', label: 'Symptom' },
  { key: 'assignment_group', label: 'Group' },
  { key: 'location', label: 'Location' },
  { key: 'made_sla', label: 'SLA' },
  { key: 'resolution_hours', label: 'Res. Time' },
]

export default function Incidents() {
  const { t } = useI18n()
  const { startDate, endDate, dateRange, setDates, dateParams } = useDateRange()
  const [incidents, setIncidents] = useState([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState(null)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [priority, setPriority] = useState('')
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState('')
  const [location, setLocation] = useState('')
  const [sortBy, setSortBy] = useState('opened_at')
  const [sortOrder, setSortOrder] = useState('desc')

  // Modal state
  const [showForm, setShowForm] = useState(false)
  const [formMode, setFormMode] = useState('create')
  const [editNumber, setEditNumber] = useState(null)

  useEffect(() => {
    fetch(`${API}/filters`).then(r => r.json()).then(setFilters).catch(console.error)
  }, [])

  const fetchIncidents = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({
      page, per_page: 20, search, priority, category, status, location,
      sort_by: sortBy, sort_order: sortOrder,
    })
    if (startDate) params.set('start_date', startDate)
    if (endDate) params.set('end_date', endDate)
    fetch(`${API}/incidents?${params}`)
      .then(r => r.json())
      .then(data => {
        setIncidents(data.incidents || [])
        setTotalPages(data.total_pages || 1)
        setTotal(data.total || 0)
        setLoading(false)
      })
      .catch(err => { console.error(err); setLoading(false) })
  }, [page, search, priority, category, status, location, sortBy, sortOrder, startDate, endDate])

  useEffect(() => { fetchIncidents() }, [fetchIncidents])

  const handleSort = (col) => {
    if (sortBy === col) { setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc') }
    else { setSortBy(col); setSortOrder('asc') }
    setPage(1)
  }

  const handleSearch = (e) => { e.preventDefault(); setSearch(searchInput); setPage(1) }
  const clearFilters = () => { setSearch(''); setSearchInput(''); setPriority(''); setCategory(''); setStatus(''); setLocation(''); setPage(1) }
  const hasFilters = search || priority || category || status || location

  const openCreate = () => { setFormMode('create'); setEditNumber(null); setShowForm(true) }
  const openEdit = (row) => { setFormMode('edit'); setEditNumber(row.number); setShowForm(true) }

  return (
    <div className="incidents-page animate-fade-in">
      <div className="page-header">
        <div>
          <h1>{t('incidentMgmt')}</h1>
          <p>{t('incidentMgmtSub')} • {total.toLocaleString()} {t('totalRecords')}</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-primary new-incident-btn" onClick={openCreate}>
            {t('addNewIncident')}
          </button>
          <DateRangePicker startDate={startDate} endDate={endDate} onChange={setDates} dateRange={dateRange} />
        </div>
      </div>

      <div className="incidents-filters glass-card">
        <form onSubmit={handleSearch} className="filter-search">
          <input type="text" className="input" placeholder={t('searchPlaceholder')}
            value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
          <button type="submit" className="btn btn-primary">{t('search')}</button>
        </form>
        <div className="filter-row">
          <select className="input" value={priority} onChange={e => { setPriority(e.target.value); setPage(1) }}>
            <option value="">{t('allPriorities')}</option>
            {filters?.priorities?.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select className="input" value={category} onChange={e => { setCategory(e.target.value); setPage(1) }}>
            <option value="">{t('allCategories')}</option>
            {filters?.categories?.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="input" value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}>
            <option value="">{t('allStatuses')}</option>
            {filters?.statuses?.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="input" value={location} onChange={e => { setLocation(e.target.value); setPage(1) }}>
            <option value="">{t('allLocations')}</option>
            {filters?.locations?.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          {hasFilters && <button className="btn btn-ghost" onClick={clearFilters}>{t('clear')}</button>}
        </div>
      </div>

      <div className="incidents-table-wrap glass-card mt-4">
        <DataTable columns={COLUMNS} data={incidents} page={page} totalPages={totalPages}
          onPageChange={setPage} onSort={handleSort} sortBy={sortBy} sortOrder={sortOrder}
          loading={loading} onRowClick={openEdit} />
      </div>

      {showForm && (
        <IncidentForm
          mode={formMode}
          incidentNumber={editNumber}
          onClose={() => setShowForm(false)}
          onSaved={fetchIncidents}
        />
      )}
    </div>
  )
}
