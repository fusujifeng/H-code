import { useState, useEffect } from 'react'
import { useAppStore } from '../stores/app-store'
import {
  MenuOutlined,
  LayoutOutlined,
  SearchOutlined,
  LeftOutlined,
  RightOutlined,
  MinusOutlined,
  BorderOutlined,
  CloseOutlined
} from '@ant-design/icons'

const isMac = typeof navigator !== 'undefined' && navigator.platform?.toLowerCase().startsWith('mac')
const isWin = typeof navigator !== 'undefined' && navigator.platform?.toLowerCase().startsWith('win')

/* ── platform-aware title bar ───────────────────────────── */

export default function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false)
  const [connStatus, setConnStatus] = useState<string>('disconnected')
  const [pairCode, setPairCode] = useState<string | null>(null)
  const activeSessionId = useAppStore((s) => s.activeSessionId)
  const showMidPanel = useAppStore((s) => s.showMidPanel)
  const toggleMidPanel = useAppStore((s) => s.toggleMidPanel)
  const toggleSearch = useAppStore((s) => s.toggleSearch)
  const api = window.electronAPI

  useEffect(() => {
    if (!api) return
    api.windowIsMaximized().then(setIsMaximized)
    const unsubWin = api.onWindowMaximized(setIsMaximized)
    const unsub1 = api.onConnectionStatusChanged?.((status: string) => setConnStatus(status))
    const unsub2 = api.onPairCodeUpdated?.((code: string) => setPairCode(code))
    api.getConnectionStatus?.().then(setConnStatus)
    api.getPairCode?.().then(setPairCode)
    return () => {
      unsubWin()
      unsub1?.()
      unsub2?.()
    }
  }, [])

  const handleMinimize = () => api?.windowMinimize()
  const handleMaximize = () => api?.windowMaximize()
  const handleClose = () => api?.windowClose()

  const drag = { WebkitAppRegion: 'drag' } as React.CSSProperties
  const noDrag = { WebkitAppRegion: 'no-drag' } as React.CSSProperties

  return (
    <div
      className="titlebar"
      style={{
        height: 38,
        display: 'flex',
        alignItems: 'center',
        background: 'var(--bg-elevated)',
        borderBottom: '1px solid var(--border)',
        userSelect: 'none',
        flexShrink: 0,
        ...drag
      }}
    >
      {/* ── LEFT ───────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          paddingLeft: isMac ? 12 : 8,
          paddingRight: 8,
          flexShrink: 0,
          ...noDrag
        }}
      >
        {isMac ? (
          <>
            <TrafficBtn color="#ff5f56" onClick={handleClose} icon={<CloseInset />} />
            <TrafficBtn color="#ffbd2e" onClick={handleMinimize} icon={<MinusInset />} />
            <TrafficBtn
              color="#27c93f"
              onClick={handleMaximize}
              icon={isMaximized ? <RestoreInset /> : <MaxInset />}
            />
          </>
        ) : (
          <>
            <TitleBarIconBtn icon={<MenuOutlined />} title="菜单" />
            <TitleBarIconBtn
              icon={<LayoutOutlined />}
              title={showMidPanel ? '收起侧边栏' : '展开侧边栏'}
              onClick={toggleMidPanel}
              active={showMidPanel}
            />
            <Divider />
            <TitleBarIconBtn icon={<SearchOutlined />} title="全局搜索 (Ctrl+K)" onClick={toggleSearch} />
            <Divider />
            <TitleBarIconBtn icon={<LeftOutlined />} title="后退" />
            <TitleBarIconBtn icon={<RightOutlined />} title="前进" />
          </>
        )}
      </div>

      {/* ── CENTER (breadcrumb) ────────────── */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          fontSize: 12,
          color: 'var(--text-secondary)',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          padding: '0 8px'
        }}
      >
        <span style={{ color: 'var(--text-tertiary)' }}>项目名</span>
        <span style={{ color: 'var(--text-tertiary)' }}>&gt;</span>
        <span
          style={{
            color: 'var(--text)',
            fontWeight: 500,
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
        >
          {activeSessionId ? `会话 ${activeSessionId.slice(0, 8)}` : '新会话'}
        </span>
      </div>

      {/* ── RIGHT ──────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, paddingRight: 8, gap: 6, ...noDrag }}>
        <span style={{
          width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
          background: connStatus === 'connected' ? '#34C759' : connStatus === 'connecting' ? '#FF9F0A' : '#FF3B30',
          boxShadow: connStatus === 'connected' ? '0 0 6px rgba(52,199,89,0.5)' : undefined
        }} />
        <span style={{
          fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap',
          fontFamily: 'SF Mono, monospace', letterSpacing: pairCode ? 2 : 0
        }}>
          {connStatus === 'connected' ? (pairCode ? pairCode.replace(/(\d{3})(\d{3})/, '$1 $2') : '已连接') :
           connStatus === 'connecting' ? '连接中...' : '未连接'}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, ...noDrag }}>
        {isMac ? (
          <div style={{ width: 68 }} />
        ) : isWin ? (
          <>
            <WinCtrlBtn icon={<MinusOutlined />} onClick={handleMinimize} title="最小化" />
            <WinCtrlBtn
              icon={isMaximized ? <RestoreIcon /> : <BorderOutlined />}
              onClick={handleMaximize}
              title={isMaximized ? '还原' : '最大化'}
            />
            <WinCtrlBtn
              icon={<CloseOutlined />}
              onClick={handleClose}
              title="关闭"
              isClose
            />
          </>
        ) : (
          <div style={{ width: 68 }} />
        )}
      </div>
    </div>
  )
}

/* ── sub-components ──────────────────────────────────────── */

function Divider() {
  return (
    <div
      style={{
        width: 1,
        height: 16,
        background: 'var(--border)',
        margin: '0 4px',
        flexShrink: 0
      }}
    />
  )
}

function TitleBarIconBtn({
  icon,
  title,
  onClick,
  active
}: {
  icon: React.ReactNode
  title?: string
  onClick?: () => void
  active?: boolean
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 28,
        height: 28,
        borderRadius: 6,
        border: 'none',
        background: active
          ? 'var(--accent)'
          : hovered
            ? 'var(--bg-hover)'
            : 'transparent',
        color: active ? '#fff' : 'var(--text-secondary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        padding: 0,
        fontSize: 14,
        transition: 'all 0.15s',
        ...({ WebkitAppRegion: 'no-drag' } as React.CSSProperties)
      }}
    >
      {icon}
    </button>
  )
}

function WinCtrlBtn({
  icon,
  onClick,
  title,
  isClose
}: {
  icon: React.ReactNode
  onClick: () => void
  title?: string
  isClose?: boolean
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 46,
        height: 38,
        border: 'none',
        background: hovered
          ? isClose
            ? '#e81123'
            : 'var(--bg-hover)'
          : 'transparent',
        color: hovered && isClose ? '#fff' : 'var(--text)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        padding: 0,
        fontSize: 12,
        transition: 'all 0.1s',
        ...({ WebkitAppRegion: 'no-drag' } as React.CSSProperties)
      }}
    >
      {icon}
    </button>
  )
}

function TrafficBtn({
  color,
  onClick,
  icon
}: {
  color: string
  onClick: () => void
  icon: React.ReactNode
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 12,
        height: 12,
        borderRadius: '50%',
        border: 'none',
        background: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        padding: 0,
        transition: 'filter 0.15s',
        ...({ WebkitAppRegion: 'no-drag' } as React.CSSProperties)
      }}
    >
      {hovered && icon}
    </button>
  )
}

/* ── inline SVGs ─────────────────────────────────────────── */

function CloseInset() {
  return (
    <svg width="6" height="6" viewBox="0 0 6 6">
      <line x1="1" y1="1" x2="5" y2="5" stroke="#4a0000" strokeWidth="1" />
      <line x1="5" y1="1" x2="1" y2="5" stroke="#4a0000" strokeWidth="1" />
    </svg>
  )
}

function MinusInset() {
  return (
    <svg width="6" height="6" viewBox="0 0 6 6">
      <line x1="1.5" y1="3" x2="4.5" y2="3" stroke="#4a3a00" strokeWidth="1" />
    </svg>
  )
}

function MaxInset() {
  return (
    <svg width="6" height="6" viewBox="0 0 6 6">
      <rect x="1" y="1" width="4" height="4" fill="none" stroke="#003a00" strokeWidth="1" />
    </svg>
  )
}

function RestoreInset() {
  return (
    <svg width="6" height="6" viewBox="0 0 6 6">
      <rect x="1.5" y="0.5" width="3" height="3" fill="none" stroke="#003a00" strokeWidth="1" />
      <rect x="0.5" y="1.5" width="3" height="3" fill="none" stroke="#003a00" strokeWidth="1" />
    </svg>
  )
}

function RestoreIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" style={{ display: 'block' }}>
      <rect x="2.5" y="4.5" width="5" height="5" fill="none" stroke="currentColor" strokeWidth="1" />
      <rect x="4.5" y="2.5" width="5" height="5" fill="none" stroke="currentColor" strokeWidth="1" />
    </svg>
  )
}
