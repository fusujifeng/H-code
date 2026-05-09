import React from 'react'
import ReactDOM from 'react-dom/client'
import { ConfigProvider } from 'antd'
import App from './App'
import './styles/themes.css'
import './styles/index.css'

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('Root element not found')

const themeId = (() => {
  try {
    return localStorage.getItem('cb-theme') || 'antdx'
  } catch {
    return 'antdx'
  }
})()

document.documentElement.setAttribute('data-theme', themeId)

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#1677ff',
          borderRadius: 8,
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif"
        }
      }}
    >
      <App />
    </ConfigProvider>
  </React.StrictMode>
)
