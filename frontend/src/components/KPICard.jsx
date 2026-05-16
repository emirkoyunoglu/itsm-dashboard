import { useEffect, useState, useRef } from 'react'
import './KPICard.css'

export default function KPICard({ title, value, suffix = '', icon, trend, trendLabel, color = 'primary', delay = 0 }) {
  const [displayValue, setDisplayValue] = useState(0)
  const [isVisible, setIsVisible] = useState(false)
  const cardRef = useRef(null)

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay * 100)
    return () => clearTimeout(timer)
  }, [delay])

  useEffect(() => {
    if (!isVisible || typeof value !== 'number') {
      if (typeof value !== 'number') setDisplayValue(value)
      return
    }

    const duration = 1200
    const steps = 40
    const stepDuration = duration / steps
    const increment = value / steps
    let current = 0
    let step = 0

    const timer = setInterval(() => {
      step++
      current = Math.min(value, increment * step)
      // Easing
      const progress = step / steps
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayValue(Math.round(value * eased * 10) / 10)
      
      if (step >= steps) {
        setDisplayValue(value)
        clearInterval(timer)
      }
    }, stepDuration)

    return () => clearInterval(timer)
  }, [value, isVisible])

  const formatValue = (val) => {
    if (typeof val !== 'number') return val
    if (val >= 1000) return val.toLocaleString('en-US', { maximumFractionDigits: 0 })
    if (Number.isInteger(val)) return val.toString()
    return val.toFixed(1)
  }

  return (
    <div
      ref={cardRef}
      className={`kpi-card glass-card animate-fade-in-up stagger-${delay}`}
      style={{ opacity: isVisible ? 1 : 0 }}
    >
      <div className="kpi-header">
        <span className="kpi-title">{title}</span>
        <span className={`kpi-icon kpi-icon-${color}`}>{icon}</span>
      </div>
      <div className="kpi-body">
        <span className={`kpi-value kpi-value-${color}`}>
          {formatValue(displayValue)}
          {suffix && <span className="kpi-suffix">{suffix}</span>}
        </span>
      </div>
      {trend !== undefined && (
        <div className="kpi-footer">
          <span className={`kpi-trend ${trend >= 0 ? 'trend-up' : 'trend-down'}`}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
          {trendLabel && <span className="kpi-trend-label">{trendLabel}</span>}
        </div>
      )}
    </div>
  )
}
