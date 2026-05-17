import { useState } from 'react'
import type { Message } from '../stores/app-store'
import { CopyOutlined, RedoOutlined, LikeOutlined, DislikeOutlined } from '@ant-design/icons'

export default function MessageBubble({ message }: { message: Message }) {
  const [copied, setCopied] = useState(false)
  const [liked, setLiked] = useState<'like' | 'dislike' | null>(null)
  const [hovered, setHovered] = useState(false)
  const isAI = message.role === 'assistant'

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      style={{ width: 'calc(100% - 16px)', margin: '0 auto' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Avatar + Name + Time row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 6,
          paddingLeft: 2
        }}
      >
        {isAI ? (
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--blue), var(--blue-hover))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <SparkleSvg />
          </div>
        ) : (
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: 'var(--blue-light)',
              color: 'var(--blue)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              fontWeight: 700
            }}
          >
            我
          </div>
        )}
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: isAI ? 'var(--blue)' : 'var(--text)'
          }}
        >
          {isAI ? 'H-code' : '你'}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
          {new Date(message.timestamp).toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit'
          })}
        </span>
      </div>

      {/* Bubble body */}
      <div
        style={{
          background: isAI ? 'var(--surface)' : 'var(--blue-light)',
          border: isAI
            ? '1px solid var(--border)'
            : '1px solid rgba(22,119,255,0.12)',
          borderRadius: 16,
          padding: '14px 18px',
          boxShadow: isAI ? '0 1px 4px rgba(0,0,0,0.04)' : 'none',
          fontSize: 14,
          lineHeight: 1.6,
          color: 'var(--text)',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word'
        }}
      >
        {message.content}
      </div>

      {/* Action bar (AI messages only, hover) */}
      {isAI && hovered && (
        <div
          style={{
            display: 'flex',
            gap: 4,
            padding: '4px 18px 0',
            opacity: hovered ? 1 : 0,
            transition: 'opacity 0.15s'
          }}
        >
          <ActionBtn
            icon={<CopyOutlined />}
            label={copied ? '已复制' : '复制'}
            onClick={handleCopy}
            active={copied}
          />
          <ActionBtn icon={<RedoOutlined />} label="重新生成" />
          <ActionBtn
            icon={<LikeOutlined />}
            label=""
            onClick={() => setLiked(liked === 'like' ? null : 'like')}
            active={liked === 'like'}
          />
          <ActionBtn
            icon={<DislikeOutlined />}
            label=""
            onClick={() => setLiked(liked === 'dislike' ? null : 'dislike')}
            active={liked === 'dislike'}
          />
        </div>
      )}

      {/* User hover actions */}
      {!isAI && hovered && (
        <div
          style={{
            display: 'flex',
            gap: 4,
            padding: '4px 18px 0',
            opacity: hovered ? 1 : 0,
            transition: 'opacity 0.15s'
          }}
        >
          <ActionBtn icon={<span>✏️</span>} label="编辑" />
          <ActionBtn icon={<span>🗑️</span>} label="删除" />
        </div>
      )}
    </div>
  )
}

function ActionBtn({
  icon,
  label,
  onClick,
  active
}: {
  icon: React.ReactNode
  label: string
  onClick?: () => void
  active?: boolean
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        padding: '2px 8px',
        borderRadius: 6,
        border: 'none',
        background: active ? 'var(--blue-light)' : 'transparent',
        color: active ? 'var(--blue)' : 'var(--text-tertiary)',
        fontSize: 12,
        cursor: 'pointer',
        transition: 'all 0.15s'
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.background = 'var(--surface-hover)'
          e.currentTarget.style.color = 'var(--text-secondary)'
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.color = 'var(--text-tertiary)'
        }
      }}
    >
      {icon}
      {label && <span>{label}</span>}
    </button>
  )
}

function SparkleSvg() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
      <path d="M12 2L13.5 8.5L12 10L10.5 8.5L12 2Z" />
      <path d="M12 14L13.5 20.5L12 22L10.5 20.5L12 14Z" />
      <path d="M2 12L8.5 10.5L10 12L8.5 13.5L2 12Z" />
      <path d="M14 12L20.5 10.5L22 12L20.5 13.5L14 12Z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  )
}
