import { useState } from 'react'
import { useAppStore } from '../stores/app-store'
import PermissionToggle from './PermissionToggle'
import { SendOutlined, PictureOutlined, AudioOutlined, ContainerOutlined, PartitionOutlined } from '@ant-design/icons'

const PLANNING_PREFIX = '请为以下任务创建一个详细的、分步骤的执行计划。将每个步骤用编号列表输出。暂时不要执行任何步骤，只创建计划。\n\n任务：'

export default function InputArea({ useTerminal, sessionId }: { useTerminal: boolean; sessionId: string }) {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [planMode, setPlanMode] = useState(false)
  const addMessage = useAppStore((s) => s.addMessage)
  const updateMessage = useAppStore((s) => s.updateMessage)
  const enabledModel = useAppStore((s) => s.models.find((m) => m.enabled))
  const isMainTaskRunning = useAppStore((s) => s.isMainTaskRunning)
  const setPlanContext = useAppStore((s) => s.setPlanContext)
  const setPlanningPhase = useAppStore((s) => s.setPlanningPhase)
  const clearPlanSteps = useAppStore((s) => s.clearPlanSteps)

  const handleSend = async () => {
    const trimmed = input.trim()
    if (!trimmed) return

    // 规划模式：保存上下文并发送规划提示
    if (planMode) {
      clearPlanSteps()
      setPlanContext(trimmed)
      setPlanningPhase('planning')
      const planningPrompt = PLANNING_PREFIX + trimmed
      setInput('')
      setPlanMode(false)

      if (useTerminal) {
        try {
          await window.electronAPI?.writePty(sessionId, planningPrompt + '\r')
        } catch (err) {
          console.error('[InputArea] writePty error:', err)
        }
        addMessage({
          id: Date.now().toString(),
          role: 'user',
          content: `[规划模式] ${trimmed}`,
          timestamp: new Date().toISOString(),
          sessionId
        })
        return
      }
    }

    // 终端模式：主任务运行中自动排队，否则直接写给 PTY
    if (useTerminal) {
      if (isMainTaskRunning) {
        setInput('')
        await handleEnqueueInternal(trimmed)
        return
      }
      try {
        const result = await window.electronAPI?.writePty(sessionId, trimmed + '\r')
        if (!result?.success) {
          console.error('[InputArea] writePty failed:', result)
          return
        }
        setInput('')
      } catch (err) {
        console.error('[InputArea] writePty error:', err)
        return
      }

      // 终端命令也保存到历史记录（只存用户输入）
      addMessage({
        id: Date.now().toString(),
        role: 'user',
        content: trimmed,
        timestamp: new Date().toISOString(),
        sessionId
      })
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

  const handleEnqueueInternal = async (prompt: string) => {
    try {
      const result = await window.electronAPI?.enqueueTask?.(sessionId, prompt)
      if (result) {
        addMessage({
          id: `enqueue-${Date.now()}`,
          role: 'system',
          content: `📝 已加入任务队列 (#${(result as unknown as { id: number }).id})`,
          timestamp: new Date().toISOString(),
          sessionId
        })
      } else {
        console.error('[InputArea] enqueueTask returned falsy')
      }
    } catch (err) {
      console.error('[InputArea] enqueueTask failed:', err)
    }
  }

  const handleEnqueue = async () => {
    const trimmed = input.trim()
    if (!trimmed) return

    setInput('')

    // 规划模式：入队时也使用规划前缀
    if (planMode) {
      clearPlanSteps()
      setPlanContext(trimmed)
      setPlanningPhase('planning')
      setPlanMode(false)
      const planningPrompt = PLANNING_PREFIX + trimmed
      await handleEnqueueInternal(planningPrompt)
      return
    }

    await handleEnqueueInternal(trimmed)
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
                  onClick={() => window.electronAPI?.killClaude?.()}
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
              <button
                onClick={handleEnqueue}
                disabled={loading || !input.trim()}
                title="加入任务队列"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  border: 'none',
                  background:
                    loading || !input.trim() ? 'var(--text-tertiary)' : 'var(--orange)',
                  color: '#fff',
                  cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s',
                  opacity: loading || !input.trim() ? 0.5 : 1
                }}
              >
                <ContainerOutlined style={{ fontSize: 14 }} />
              </button>
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
            onClick={() => setPlanMode(!planMode)}
            title={planMode ? '规划模式已开启：先规划再执行' : '开启规划模式：让 AI 先生成任务计划'}
            style={{
              border: `1px solid ${planMode ? 'var(--blue)' : 'var(--border)'}`,
              background: planMode ? 'var(--blue-light)' : 'transparent',
              color: planMode ? 'var(--blue)' : 'var(--text-secondary)',
              fontSize: 11,
              cursor: 'pointer',
              padding: '2px 8px',
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontWeight: planMode ? 600 : 400,
              transition: 'all 0.15s'
            }}
          >
            <PartitionOutlined style={{ fontSize: 12 }} />
            规划
          </button>
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
            {enabledModel?.name || 'Claude Code CLI'}
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
