import { useState, useRef, useEffect } from 'react'
import DatePicker, { registerLocale } from 'react-datepicker'
import { tr } from 'date-fns/locale/tr'
import { getMonth, getYear } from 'date-fns'
import 'react-datepicker/dist/react-datepicker.css'
import { useI18n } from '../I18nContext'
import './DateRangePicker.css'

registerLocale('tr', tr)

const MONTHS_TR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']
const MONTHS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December']

export default function DateRangePicker({ startDate, endDate, onChange, dateRange }) {
  const { t, locale } = useI18n()
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef(null)

  const start = startDate ? new Date(startDate + 'T00:00:00') : null
  const end = endDate ? new Date(endDate + 'T00:00:00') : null
  const minDate = dateRange?.min ? new Date(dateRange.min + 'T00:00:00') : undefined
  const maxDate = dateRange?.max ? new Date(dateRange.max + 'T00:00:00') : undefined
  const hasFilter = startDate || endDate
  const months = locale === 'tr' ? MONTHS_TR : MONTHS_EN

  const minYear = minDate ? getYear(minDate) : 2020
  const maxYear = maxDate ? getYear(maxDate) : 2030
  const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i)

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setIsOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleChange = (dates) => {
    const [s, e] = dates
    const fmt = (d) => d ? d.toISOString().slice(0, 10) : ''
    onChange(fmt(s), fmt(e))
    if (s && e) setTimeout(() => setIsOpen(false), 400)
  }

  const handleClear = () => { onChange('', ''); setIsOpen(false) }

  const formatDisplay = () => {
    if (!startDate && !endDate) return t('allDates')
    const opts = { day: '2-digit', month: 'short', year: 'numeric' }
    const loc = locale === 'tr' ? 'tr-TR' : 'en-US'
    const s = start ? start.toLocaleDateString(loc, opts) : '...'
    const e = end ? end.toLocaleDateString(loc, opts) : '...'
    return `${s}  →  ${e}`
  }

  const renderHeader = ({
    date, changeYear, changeMonth,
    decreaseMonth, increaseMonth,
    prevMonthButtonDisabled, nextMonthButtonDisabled,
  }) => (
    <div className="custom-header">
      <button className="nav-btn" onClick={decreaseMonth} disabled={prevMonthButtonDisabled}>‹</button>
      <div className="header-selects">
        <select value={months[getMonth(date)]} onChange={({ target: { value } }) => changeMonth(months.indexOf(value))}>
          {months.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={getYear(date)} onChange={({ target: { value } }) => changeYear(Number(value))}>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      <button className="nav-btn" onClick={increaseMonth} disabled={nextMonthButtonDisabled}>›</button>
    </div>
  )

  return (
    <div className="date-range-picker" ref={ref}>
      <button
        className={`date-range-toggle ${hasFilter ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="date-icon">📅</span>
        <span className="date-label">{formatDisplay()}</span>
        {hasFilter && <span className="date-dot" />}
      </button>
      {isOpen && (
        <div className="date-range-dropdown">
          <DatePicker
            selected={start}
            onChange={handleChange}
            startDate={start}
            endDate={end}
            selectsRange
            inline
            monthsShown={2}
            locale={locale === 'tr' ? 'tr' : undefined}
            minDate={minDate}
            maxDate={maxDate}
            renderCustomHeader={renderHeader}
            calendarClassName="itsm-calendar"
          />
          {hasFilter && (
            <div className="date-actions">
              <button className="date-clear" onClick={handleClear}>{t('clear')}</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
