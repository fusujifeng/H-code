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

export default function XtermTerminal() {
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const unsubRef = useRef<(() => void) | null>(null)
  const theme = useAppStore((s) => s.theme)

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

    requestAnimationFrame(() => {
      fit.fit()
      term.focus()
      const dims = fit.proposeDimensions()
      if (dims) {
        window.electronAPI?.resizePty(dims.cols, dims.rows)
      }
    })

    // xterm.js onData: 用户按键输入
    const disposable = term.onData((data) => {
      window.electronAPI?.writePty(data)
    })

    // 兜底：直接捕获方向键和功能键，避免 Electron 拦截
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
        window.electronAPI?.writePty(arrows[e.key])
        return
      }
      // Tab 键有时也会被拦截
      if (e.key === 'Tab') {
        e.preventDefault()
        window.electronAPI?.writePty('\t')
        return
      }
    }
    document.addEventListener('keydown', keyHandler)

    // main process 数据 → 终端
    const unsub = window.electronAPI?.onPtyData((data) => {
      term.write(data)
    })

    termRef.current = term
    fitRef.current = fit
    unsubRef.current = unsub || null

    // 创建 PTY 会话
    window.electronAPI?.createPty()

    // 窗口大小变化时自适应
    const ro = new ResizeObserver(() => {
      fit.fit()
      const dims = fit.proposeDimensions()
      if (dims) {
        window.electronAPI?.resizePty(dims.cols, dims.rows)
      }
    })
    ro.observe(containerRef.current)

    return () => {
      document.removeEventListener('keydown', keyHandler)
      ro.disconnect()
      disposable.dispose()
      unsubRef.current?.()
      window.electronAPI?.killPty()
      term.dispose()
      termRef.current = null
      fitRef.current = null
      unsubRef.current = null
    }
  }, [])

  useEffect(() => {
    if (termRef.current) {
      termRef.current.options.theme = terminalThemes[theme]
    }
  }, [theme])

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        minHeight: 0,
        background: 'var(--surface)',
        borderRadius: 8,
        overflow: 'hidden',
        margin: '0 8px 8px'
      }}
    />
  )
}
