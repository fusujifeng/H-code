import { useEffect } from 'react'
import { useAppStore } from './stores/app-store'
import MainLayout from './components/MainLayout'
import FloatBall from './components/FloatBall'

export default function App() {
  const theme = useAppStore((s) => s.theme)
  const setUpdateStatus = useAppStore((s) => s.setUpdateStatus)
  const setUpdateProgress = useAppStore((s) => s.setUpdateProgress)
  const setUpdateError = useAppStore((s) => s.setUpdateError)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  // 监听主进程的更新事件
  useEffect(() => {
    const unsubStatus = window.electronAPI?.onUpdateStatus((status) => {
      if (status === 'available') setUpdateStatus('available')
      else if (status === 'not-available') setUpdateStatus('not-available')
      else if (status === 'checking') setUpdateStatus('checking')
      else if (status === 'downloaded') setUpdateStatus('downloaded')
    })

    const unsubProgress = window.electronAPI?.onUpdateProgress((percent) => {
      setUpdateStatus('downloading')
      setUpdateProgress(percent)
    })

    const unsubError = window.electronAPI?.onUpdateError((err) => {
      setUpdateStatus('error')
      setUpdateError(err)
    })

    return () => {
      unsubStatus?.()
      unsubProgress?.()
      unsubError?.()
    }
  }, [])

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
