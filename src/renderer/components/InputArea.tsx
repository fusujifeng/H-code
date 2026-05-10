import { useState } from 'react'
import { useAppStore } from '../stores/app-store'
import PermissionToggle from './PermissionToggle'
import { SendOutlined, PictureOutlined, AudioOutlined } from '@ant-design/icons'

export default function InputArea({ useTerminal, sessionId }: { useTerminal: boolean; sessionId: string }) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const addMessage = useAppStore((s) => s.addMessage)
  const updateMessage = useAppStore((s) => s.updateMessage)

  const handleSend = async () => {
    const trimmed = input.trim()
    if (!trimmed) return

    // 终端模式：直接写给 PTY，不存消息列表
    if (useTerminal) {
      setInput('')
      try {
        const result = await window.electronAPI?.writePty(sessionId, trimmed + '\r')
        if (!result?.success) {
          console.error('[InputArea] writePty failed:', result)
        }
      } catch (err) {
        console.error('[InputArea] writePty error:', err)
      }
      return
    }

    // 聊天模式：原来的逻辑
    addMessage({
      id: Date.now().toString(),
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
      sessionId
    })

    setInput('')
    setLoading(true)

    const assistantId = (Date.now() + 1).toString()
    addMessage({
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      model: 'Claude Code CLI',
      sessionId
    })

    let fullContent = ''

    let cleanupOutput: (() => void) | undefined
    let cleanupError: (() => void) | undefined
    let cleanupClose: (() => void) | undefined

    const removeListeners = () => {
      cleanupOutput?.()
      cleanupError?.()
      cleanupClose?.()
    }

    cleanupOutput = window.electronAPI?.onClaudeOutput((data: string) => {
      fullContent += data
      updateMessage(assistantId, { content: fullContent })
    })

    cleanupError = window.electronAPI?.onClaudeError((err: string) => {
      fullContent += err
      updateMessage(assistantId, { content: fullContent })
    })

    cleanupClose = window.electronAPI?.onClaudeClose((code) => {
      setLoading(false)
      if (code !== 0 && code !== null) {
        fullContent += `\n[进程退出码: ${code}]`
        updateMessage(assistantId, { content: fullContent })
      }
      removeListeners()
    })

    try {
      const result = await window.electronAPI?.sendToClaude(trimmed)
      if (!result?.success) {
        updateMessage(assistantId, { content: '❌ 启动 Claude Code CLI 失败' })
        setLoading(false)
        removeListeners()
      }
    } catch (err) {
      updateMessage(assistantId, { content: `❌ 错误: ${String(err)}` })
      setLoading(false)
      removeListeners()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div
      style={{
        background: 'var(--bg-elevated)',
        borderTop: '1px solid var(--border)',
        flexShrink: 0
      }}
    >
      {/* Input area */}
      <div style={{ padding: '12px 16px 8px' }}>
        <div
          style={{
            background: 'var(--surface)',
            borderRadius: 12,
            border: '1px solid var(--border)',
            padding: '10px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            transition: 'border-color 0.2s, box-shadow 0.2s',
            boxShadow: 'var(--shadow)'
          }}
          onFocusCapture={() => {}}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type / for commands"
            rows={2}
            style={{
              width: '100%',
              border: 'none',
              outline: 'none',
              resize: 'none',
              background: 'transparent',
              color: 'var(--text)',
              fontSize: 14,
              fontFamily: 'inherit',
              lineHeight: 1.5
            }}
            onFocus={(e) => {
              const parent = e.currentTarget.parentElement
              if (parent) {
                parent.style.borderColor = 'var(--blue)'
                parent.style.boxShadow = `0 0 0 3px var(--blue-glow)`
              }
            }}
            onBlur={(e) => {
              const parent = e.currentTarget.parentElement
              if (parent) {
                parent.style.borderColor = 'var(--border)'
                parent.style.boxShadow = 'var(--shadow)'
              }
            }}
          />

          {/* Toolbar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <div style={{ display: 'flex', gap: 4 }}>
              <ToolBtn icon={<PictureOutlined />} label="上传图片" />
              <ToolBtn icon={<AudioOutlined />} label="语音输入" />
              {loading && (
                <button
                  style={{
                    border: 'none',
                    background: 'var(--red-light)',
                    color: 'var(--red)',
                    padding: '4px 10px',
                    borderRadius: 6,
                    fontSize: 12,
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  ■ 停止生成
                </button>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  fontSize: 11,
                  color: 'var(--text-tertiary)',
                  background: 'var(--surface-hover)',
                  padding: '2px 7px',
                  borderRadius: 4,
                  fontWeight: 500
                }}
              >
                ⌘K
              </span>
              <button
                onClick={handleSend}
                disabled={loading || !input.trim()}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  border: 'none',
                  background:
                    loading || !input.trim() ? 'var(--text-tertiary)' : 'var(--blue)',
                  color: '#fff',
                  cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s',
                  opacity: loading || !input.trim() ? 0.5 : 1
                }}
              >
                <SendOutlined style={{ fontSize: 14 }} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom status bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '4px 16px 8px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PermissionToggle />
          <div style={{ width: 1, height: 14, background: 'var(--border)' }} />
          <button
            style={{
              border: 'none',
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: 12,
              cursor: 'pointer',
              padding: 0
            }}
          >
            + 新建会话
          </button>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}
        >
          <div
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: 'var(--blue)'
            }}
          />
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Claude Code CLI
          </span>
        </div>
      </div>
    </div>
  )
}

function ToolBtn({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <button
      title={label}
      style={{
        border: 'none',
        background: 'transparent',
        color: 'var(--text-tertiary)',
        padding: '4px 6px',
        borderRadius: 6,
        cursor: 'pointer',
        fontSize: 16,
        display: 'flex',
        alignItems: 'center',
        transition: 'all 0.15s'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--surface-hover)'
        e.currentTarget.style.color = 'var(--text-secondary)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.color = 'var(--text-tertiary)'
      }}
    >
      {icon}
    </button>
  )
}
