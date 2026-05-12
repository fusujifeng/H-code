import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { useAppStore, type ThemeId } from '../stores/app-store'

const terminalThemes: Record<ThemeId, { background: string; foreground: string; cursor: string }> = {
  antdx:     { background: '#ffffff', foreground: 'rgba(0,0,0,0.88)', cursor: '#1677ff' },
  claude:    { background: '#ffffff', foreground: '#1a1a1a',        cursor: '#d97757' },
  qoder:     { background: '#ffffff', foreground: '#1a2b3c',        cursor: '#00c853' },
  blackgold: { background: '#14141c', foreground: '#e6e4df',        cursor: '#c8a45c' },
  vscode:    { background: '#2b2b2b', foreground: '#bbbbbb',        cursor: '#4e9fdf' },
  trae:      { background: '#0d1117', foreground: '#c9d1d9',        cursor: '#3ecf8e' },
  idea:      { background: '#1e1e2e', foreground: '#d4d4d4',        cursor: '#4fc1ff' },
}

// 全局 PTY 输出缓存：确保切换 terminal/chat 模式或 StrictMode 双重挂载后仍能恢复历史
const ptyHistoryMap = new Map<string, string>()

export default function XtermTerminal({ sessionId }: { sessionId: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const unsubRef = useRef<(() => void) | null>(null)
  const theme = useAppStore((s) => s.theme)
  const permission = useAppStore((s) => s.permission)

  useEffect(() => {
    if (!containerRef.current || termRef.current) return

    const term = new Terminal({
      fontFamily: '"Cascadia Code", "Fira Code", Consolas, monospace',
      fontSize: 14,
      cursorBlink: true,
      theme: terminalThemes[theme],
      scrollback: 5000,
      allowTransparency: false
    })

    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(containerRef.current)

    // 恢复历史输出（切换模式或 StrictMode 双重挂载时）
    const history = ptyHistoryMap.get(sessionId)
    if (history) {
      term.write(history)
    }

    requestAnimationFrame(() => {
      fit.fit()
      term.focus()
      const dims = fit.proposeDimensions()
      if (dims) {
        window.electronAPI?.resizePty(sessionId, dims.cols, dims.rows)
      }
    })

    const disposable = term.onData((data) => {
      window.electronAPI?.writePty(sessionId, data)
    })

    const keyHandler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (!containerRef.current?.contains(target)) return

      const arrows: Record<string, string> = {
        ArrowUp: '\x1b[A',
        ArrowDown: '\x1b[B',
        ArrowRight: '\x1b[C',
        ArrowLeft: '\x1b[D'
      }
      if (arrows[e.key]) {
        e.preventDefault()
        window.electronAPI?.writePty(sessionId, arrows[e.key])
        return
      }
      if (e.key === 'Tab') {
        e.preventDefault()
        window.electronAPI?.writePty(sessionId, '\t')
        return
      }
    }
    document.addEventListener('keydown', keyHandler)

    const unsub = window.electronAPI?.onPtyData((id, data) => {
      if (id === sessionId) {
        term.write(data)
        // 累积保存到全局 Map
        const current = ptyHistoryMap.get(id) || ''
        ptyHistoryMap.set(id, current + data)
      }
    })

    const unsubHistory = window.electronAPI?.onPtyHistory((id, historyData) => {
      if (id === sessionId) {
        term.write(historyData)
        const current = ptyHistoryMap.get(id) || ''
        ptyHistoryMap.set(id, current + historyData)
      }
    })

    termRef.current = term
    fitRef.current = fit
    unsubRef.current = unsub || null

    window.electronAPI?.createPty(sessionId, permission)

    const ro = new ResizeObserver(() => {
      fit.fit()
      const dims = fit.proposeDimensions()
      if (dims) {
        window.electronAPI?.resizePty(sessionId, dims.cols, dims.rows)
      }
    })
    ro.observe(containerRef.current)

    return () => {
      document.removeEventListener('keydown', keyHandler)
      ro.disconnect()
      disposable.dispose()
      unsubRef.current?.()
      unsubHistory?.()
      // 切换 terminal/chat 模式时不 kill PTY，保持会话存活
      // PTY 只在用户关闭会话面板时由 RightPanel 负责 kill
      term.dispose()
      termRef.current = null
      fitRef.current = null
      unsubRef.current = null
    }
  }, [sessionId])

  useEffect(() => {
    if (termRef.current) {
      termRef.current.options.theme = terminalThemes[theme]
    }
  }, [theme])

  const permissionInitRef = useRef(false)
  useEffect(() => {
    // createPty 已经通过命令行参数设置了初始权限，跳过第一次渲染
    if (!permissionInitRef.current) {
      permissionInitRef.current = true
      return
    }
    window.electronAPI?.changePtyPermission(sessionId, permission)
  }, [permission, sessionId])

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        minHeight: 0,
        background: 'var(--surface)',
        borderRadius: 8,
        overflow: 'hidden',
        margin: '0 4px 4px'
      }}
    />
  )
}
