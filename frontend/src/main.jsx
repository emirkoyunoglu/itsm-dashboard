import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from './ThemeContext.jsx'
import { I18nProvider } from './I18nContext.jsx'
import { DateRangeProvider } from './DateRangeContext.jsx'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <I18nProvider>
        <DateRangeProvider>
          <App />
        </DateRangeProvider>
      </I18nProvider>
    </ThemeProvider>
  </StrictMode>,
)
