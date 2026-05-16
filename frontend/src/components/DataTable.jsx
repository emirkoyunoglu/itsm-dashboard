import { useState } from 'react'
import './DataTable.css'

function getPriorityBadgeClass(priority) {
  if (!priority) return 'badge'
  const p = priority.toLowerCase()
  if (p.includes('critical')) return 'badge badge-critical'
  if (p.includes('high')) return 'badge badge-high'
  if (p.includes('moderate')) return 'badge badge-moderate'
  if (p.includes('low')) return 'badge badge-low'
  return 'badge'
}

function getStatusBadgeClass(status) {
  if (!status) return 'badge'
  const s = status.toLowerCase()
  if (s.includes('new') || s.includes('active')) return 'badge badge-active'
  if (s.includes('resolved')) return 'badge badge-resolved'
  if (s.includes('closed')) return 'badge badge-closed'
  if (s.includes('await')) return 'badge badge-moderate'
  return 'badge'
}

export default function DataTable({ 
  columns, 
  data, 
  page = 1, 
  totalPages = 1, 
  onPageChange, 
  onSort,
  sortBy,
  sortOrder,
  loading = false 
}) {
  const renderCell = (row, col) => {
    const value = row[col.key]
    
    if (col.key === 'priority') {
      return <span className={getPriorityBadgeClass(value)}>{value}</span>
    }
    if (col.key === 'incident_state') {
      return <span className={getStatusBadgeClass(value)}>{value}</span>
    }
    if (col.key === 'made_sla') {
      return (
        <span className={`badge ${value ? 'badge-sla-met' : 'badge-sla-breached'}`}>
          {value ? '✓ Met' : '✗ Breached'}
        </span>
      )
    }
    if (col.key === 'resolution_hours' && value != null) {
      return `${Math.round(value * 10) / 10}h`
    }
    if (value == null || value === '') return <span className="text-muted">—</span>
    return value
  }

  return (
    <div className="data-table-container">
      <div className="data-table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => onSort && col.sortable !== false && onSort(col.key)}
                  className={onSort && col.sortable !== false ? 'sortable' : ''}
                >
                  <div className="th-content">
                    {col.label}
                    {sortBy === col.key && (
                      <span className="sort-indicator">
                        {sortOrder === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="table-loading">
                  <div className="loading-spinner" />
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="table-empty">
                  No incidents found
                </td>
              </tr>
            ) : (
              data.map((row, i) => (
                <tr key={row.number || i} className="animate-fade-in" style={{ animationDelay: `${i * 20}ms` }}>
                  {columns.map((col) => (
                    <td key={col.key}>{renderCell(row, col)}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <button
            className="btn btn-ghost"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            ← Previous
          </button>
          <div className="pagination-info">
            Page <span className="page-current">{page}</span> of {totalPages}
          </div>
          <button
            className="btn btn-ghost"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}
