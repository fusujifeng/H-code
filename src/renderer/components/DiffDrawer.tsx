import { useEffect, useState } from 'react'
import { useAppStore } from '../stores/app-store'
import { CloseOutlined, LoadingOutlined } from '@ant-design/icons'

export default function DiffDrawer() {
  const showDiffDrawer = useAppStore((s) => s.showDiffDrawer)
  const diffFilePath = useAppStore((s) => s.diffFilePath)
  const diffContent = useAppStore((s) => s.diffContent)
  const setDiffContent = useAppStore((s) => s.setDiffContent)
  const closeDiffDrawer = useAppStore((s) => s.closeDiffDrawer)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!showDiffDrawer || !diffFilePath) return

    let cancelled = false
    setLoading(true)
    setError(null)

    const fetchDiff = async () => {
      try {
        const result = await window.electronAPI?.getGitDiff?.(diffFilePath)
        if (cancelled) return

        if (result?.success && result.diff) {
          setDiffContent(result.diff)
        } else if (result?.success && !result.diff) {
          // 新文件可能在 git 中没有 diff，尝试读取文件内容
          setDiffContent(`# 新文件: ${diffFilePath}\n# 该文件尚未被 git 跟踪，暂无 diff 内容`)
        } else {
          setError(result?.error || '无法获取 diff')
        }
      } catch {
        if (!cancelled) setError('获取 diff 失败')
      }
      if (!cancelled) setLoading(false)
    }

    fetchDiff()
    return () => { cancelled = true }
  }, [showDiffDrawer, diffFilePath])

  // ESC 关闭
  useEffect(() => {
    if (!showDiffDrawer) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDiffDrawer()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [showDiffDrawer, closeDiffDrawer])

  if (!showDiffDrawer) return null

  const fileName = diffFilePath?.split('/').pop() || diffFilePath || ''

  return (
    <>
      {/* 背景遮罩 */}
      <div
        onClick={closeDiffDrawer}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.2)',
          zIndex: 100
        }}
      />

      {/* 抽屉面板 */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 480,
          maxWidth: '60vw',
          background: 'var(--surface)',
          borderLeft: '1px solid var(--border)',
          zIndex: 101,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 0 40px rgba(0,0,0,0.15)',
          animation: 'slideInRight 0.2s ease'
        }}
      >
        {/* 头部 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {fileName}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {diffFilePath}
            </div>
          </div>
          <button
            onClick={closeDiffDrawer}
            style={{
              border: 'none',
              background: 'transparent',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
              padding: 4,
              borderRadius: 4,
              display: 'flex'
            }}
          >
            <CloseOutlined style={{ fontSize: 14 }} />
          </button>
        </div>

        {/* 内容 */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: 0,
            fontFamily: '"Cascadia Code", "Fira Code", "JetBrains Mono", Consolas, monospace',
            fontSize: 12,
            lineHeight: 1.6
          }}
        >
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-tertiary)', gap: 8 }}>
              <LoadingOutlined style={{ fontSize: 18 }} />
              <span>加载 diff...</span>
            </div>
          ) : error ? (
            <div style={{ padding: 16, color: 'var(--red)' }}>{error}</div>
          ) : diffContent ? (
            <pre
              style={{
                margin: 0,
                padding: '12px 14px',
                whiteSpace: 'pre',
                overflowX: 'auto',
                color: 'var(--text)',
                background: 'var(--bg)',
                minHeight: '100%'
              }}
            >
              {renderDiffLines(diffContent)}
            </pre>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-tertiary)' }}>
              暂无 diff 内容
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(20px); opacity: 0.7; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </>
  )
}

function renderDiffLines(diff: string) {
  return diff.split('\n').map((line, i) => {
    let color = 'var(--text)'
    let bg = 'transparent'
    if (line.startsWith('+') && !line.startsWith('+++')) {
      color = 'var(--green)'
      bg = 'rgba(0,200,0,0.06)'
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      color = 'var(--red)'
      bg = 'rgba(255,0,0,0.06)'
    } else if (line.startsWith('@@')) {
      color = 'var(--blue)'
      bg = 'rgba(0,100,255,0.06)'
    } else if (line.startsWith('diff') || line.startsWith('index') || line.startsWith('---') || line.startsWith('+++')) {
      color = 'var(--text-tertiary)'
    }
    return (
      <div key={i} style={{ color, background: bg, minHeight: '1.4em', whiteSpace: 'pre' }}>
        {line}
      </div>
    )
  })
}
