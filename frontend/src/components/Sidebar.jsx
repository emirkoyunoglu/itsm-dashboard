import { NavLink, useLocation } from 'react-router-dom'
import { useTheme } from '../ThemeContext'
import { useI18n } from '../I18nContext'
import './Sidebar.css'

export default function Sidebar() {
  const location = useLocation()
  const { theme, toggleTheme } = useTheme()
  const { locale, t, toggleLocale } = useI18n()

  const navItems = [
    { path: '/', label: t('dashboard'), icon: '📊' },
    { path: '/incidents', label: t('incidents'), icon: '🎫' },
    { path: '/analytics', label: t('analytics'), icon: '📈' },
    { path: '/reports', label: t('reports'), icon: '📋' },
  ]
  
  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="logo-icon">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <rect width="28" height="28" rx="8" fill="url(#logo-grad)" />
            <path d="M8 14L12 10L16 14L20 10" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M8 18L12 14L16 18L20 14" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" />
            <defs>
              <linearGradient id="logo-grad" x1="0" y1="0" x2="28" y2="28">
                <stop stopColor="#6366f1" />
                <stop offset="1" stopColor="#8b5cf6" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        <div className="logo-text">
          <span className="logo-title">ITSM</span>
          <span className="logo-subtitle">Dashboard</span>
        </div>
        <div className="sidebar-toggles">
          <button className="theme-toggle" onClick={toggleLocale} title={locale === 'tr' ? 'Switch to English' : 'Türkçe\'ye geç'}>
            {locale === 'tr' ? 'EN' : 'TR'}
          </button>
          <button className="theme-toggle" onClick={toggleTheme} title={`${theme === 'dark' ? 'Light' : 'Dark'} mode`}>
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        <div className="nav-section-label">{t('mainMenu')}</div>
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
            {location.pathname === item.path && <span className="nav-active-dot" />}
          </NavLink>
        ))}
      </nav>

      {/* Footer info */}
      <div className="sidebar-footer">
        <div className="sidebar-info-card">
          <div className="info-card-icon">🏢</div>
          <div className="info-card-text">
            <span className="info-card-title">ITSM</span>
            <span className="info-card-desc">{t('itGovernance')}</span>
          </div>
        </div>
        <div className="sidebar-version">
          {t('version')}
        </div>
      </div>
    </aside>
  )
}
