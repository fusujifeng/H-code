import { useEffect } from 'react'
import { useAppStore } from './stores/app-store'
import MainLayout from './components/MainLayout'
import FloatBall from './components/FloatBall'

export default function App() {
  const theme = useAppStore((s) => s.theme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  return (
    <div
      style={{
        height: '100vh',
        width: '100vw',
        display: 'flex',
        background: 'var(--bg)',
        color: 'var(--text)',
        overflow: 'hidden'
      }}
    >
      <MainLayout />
      <FloatBall />
    </div>
  )
}
