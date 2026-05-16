import { createContext, useContext, useState, useEffect } from 'react'

const DateRangeContext = createContext()

const API = 'http://localhost:5000/api'

export function DateRangeProvider({ children }) {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [dateRange, setDateRange] = useState(null)

  useEffect(() => {
    fetch(`${API}/filters`)
      .then(r => r.json())
      .then(data => setDateRange(data.date_range))
      .catch(() => {})
  }, [])

  const setDates = (start, end) => {
    setStartDate(start)
    setEndDate(end)
  }

  // Build query string for API calls
  const dateParams = () => {
    const params = new URLSearchParams()
    if (startDate) params.set('start_date', startDate)
    if (endDate) params.set('end_date', endDate)
    return params.toString()
  }

  return (
    <DateRangeContext.Provider value={{ startDate, endDate, dateRange, setDates, dateParams }}>
      {children}
    </DateRangeContext.Provider>
  )
}

export function useDateRange() {
  return useContext(DateRangeContext)
}
