import { useState } from 'react'
import { CopyOutlined } from '@ant-design/icons'

interface CodeBlockProps {
  code: string
  language?: string
  filename?: string
}

export default function CodeBlock({ code, language = '', filename }: CodeBlockProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(code).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      style={{
        borderRadius: 12,
        overflow: 'hidden',
        margin: '12px 0',
        background: '#1e1e2e',
        border: '1px solid rgba(255,255,255,0.06)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.15)'
      }}
    >
      {/* Mac terminal header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          background: 'rgba(255,255,255,0.03)',
          borderBottom: '1px solid rgba(255,255,255,0.04)'
        }}
      >
        <div style={{ display: 'flex', gap: 6 }}>
          <div
            style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f56' }}
          />
          <div
            style={{ width: 10, height: 10, borderRadius: '50%', background: '#ffbd2e' }}
          />
          <div
            style={{ width: 10, height: 10, borderRadius: '50%', background: '#27c93f' }}
          />
        </div>
        {filename && (
          <span style={{ fontSize: 11, color: '#8b949e', fontWeight: 500 }}>{filename}</span>
        )}
        <button
          onClick={handleCopy}
          style={{
            border: 'none',
            background: 'rgba(255,255,255,0.06)',
            color: '#8b949e',
            padding: '3px 8px',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 11,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            transition: 'all 0.15s'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.12)'
            e.currentTarget.style.color = '#c8c4d4'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
            e.currentTarget.style.color = '#8b949e'
          }}
        >
          <CopyOutlined style={{ fontSize: 11 }} />
          {copied ? '已复制' : '复制'}
        </button>
      </div>

      {/* Code content */}
      <div style={{ position: 'relative' }}>
        <pre
          style={{
            margin: 0,
            padding: '14px 16px',
            fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",
            fontSize: 13,
            lineHeight: 1.55,
            color: '#c8c4d4',
            overflowX: 'auto',
            whiteSpace: 'pre',
            background: '#1e1e2e'
          }}
        >
          <code>{code}</code>
        </pre>
        {language && (
          <span
            style={{
              position: 'absolute',
              top: 8,
              right: 56,
              fontSize: 10,
              color: '#6e7681',
              textTransform: 'uppercase',
              fontWeight: 500
            }}
          >
            {language}
          </span>
        )}
      </div>
    </div>
  )
}
