import { useAppStore, type TerminalSession } from '../stores/app-store'
import ChatView from './ChatView'
import WelcomeArea from './WelcomeArea'
import InputArea from './InputArea'
import XtermTerminal from './XtermTerminal'
import FunnyStatusBar from './FunnyStatusBar'
import TaskQueuePanel from './TaskQueuePanel'
import { useState, useEffect, useCallback, useRef } from 'react'
import { CloseOutlined } from '@ant-design/icons'

function generateId() {
  return `pty-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function TerminalPane({
  session,
  isActive,
  onClick,
  onClose,
  canClose
}: {
  session: TerminalSession
  isActive: boolean
  onClick: () => void
  onClose: () => void
  canClose: boolean
}) {
  const [mode, setMode] = useState<'terminal' | 'chat'>('terminal')
  const messages = useAppStore((s) => s.messages)

  return (
    <div
      onClick={onClick}
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        borderLeft: isActive ? '2px solid var(--blue)' : '2px solid transparent',
        minWidth: 0,
        background: 'var(--bg)',
        transition: 'border-color 0.15s'
      }}
    >
      {/* Pane header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 12px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
          gap: 8
        }}
      >
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={(e) => { e.stopPropagation(); setMode('terminal') }}
            style={{
              padding: '2px 8px',
              borderRadius: 5,
              border: 'none',
              background: mode === 'terminal' ? 'var(--blue)' : 'var(--surface)',
              color: mode === 'terminal' ? '#fff' : 'var(--text)',
              cursor: 'pointer',
              fontSize: 11
            }}
          >
            CLI
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setMode('chat') }}
            style={{
              padding: '2px 8px',
              borderRadius: 5,
              border: 'none',
              background: mode === 'chat' ? 'var(--blue)' : 'var(--surface)',
              color: mode === 'chat' ? '#fff' : 'var(--text)',
              cursor: 'pointer',
              fontSize: 11
            }}
          >
            聊天
          </button>
        </div>
        <span
          style={{
            fontSize: 12,
            color: 'var(--text-secondary)',
            flex: 1,
            textAlign: 'center',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {session.title}
        </span>
        {canClose && (
          <button
            onClick={(e) => { e.stopPropagation(); onClose() }}
            style={{
              border: 'none',
              background: 'transparent',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
              padding: 2,
              display: 'flex',
              alignItems: 'center'
            }}
            title="关闭此面板"
          >
            <CloseOutlined style={{ fontSize: 12 }} />
          </button>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {mode === 'terminal' ? (
          <XtermTerminal sessionId={session.id} />
        ) : (
          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '0 8px' }}>
            {messages.length === 0 ? <WelcomeArea sessionId={session.id} /> : <ChatView />}
          </div>
        )}
      </div>

      {/* Input */}
      <InputArea useTerminal={mode === 'terminal'} sessionId={session.id} />
    </div>
  )
}

export default function RightPanel() {
  const splitSessions = useAppStore((s) => s.splitSessions)
  const activeSplitId = useAppStore((s) => s.activeSplitId)
  const addSplitSession = useAppStore((s) => s.addSplitSession)
  const closeSplitSession = useAppStore((s) => s.closeSplitSession)
  const setActiveSplitId = useAppStore((s) => s.setActiveSplitId)
  const initialized = useRef(false)

  // 启动时默认只创建一个终端会话（避免 strict mode 重复创建）
  useEffect(() => {
    if (!initialized.current && splitSessions.length === 0) {
      initialized.current = true
      const id = generateId()
      addSplitSession({
        id,
        title: '会话 1',
        updatedAt: new Date().toLocaleString('zh-CN')
      })
    }
  }, [splitSessions.length, addSplitSession])

  const handleNewSession = useCallback(() => {
    const id = generateId()
    addSplitSession({
      id,
      title: `会话 ${splitSessions.length + 1}`,
      updatedAt: new Date().toLocaleString('zh-CN')
    })
  }, [splitSessions.length, addSplitSession])

  const handleCloseSession = useCallback(
    (id: string) => {
      window.electronAPI?.killPty(id)
      closeSplitSession(id)
    },
    [closeSplitSession]
  )

  return (
    <div
      className="flex flex-col"
      style={{
        flex: 1,
        background: 'var(--bg)',
        overflow: 'hidden'
      }}
    >
      {/* 趣味状态条 */}
      <FunnyStatusBar />

      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          padding: '6px 12px',
          borderBottom: '1px solid var(--border)',
          alignItems: 'center',
          flexShrink: 0,
          justifyContent: 'space-between'
        }}
      >
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleNewSession}
            style={{
              padding: '3px 10px',
              borderRadius: 6,
              border: 'none',
              background: 'var(--blue)',
              color: '#fff',
              cursor: 'pointer',
              fontSize: 12
            }}
          >
            + 新建会话
          </button>
        </div>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
          {splitSessions.filter((s) => !s.closed).length > 1 ? '分屏模式' : '单窗口模式'}
        </span>
      </div>

      {/* Pane area */}
      <div
        style={{
          flex: 1,
          overflow: 'hidden',
          minHeight: 0,
          display: 'flex'
        }}
      >
        {splitSessions.filter((s) => !s.closed).length === 0 ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-tertiary)',
              fontSize: 14
            }}
          >
            点击左侧项目重新打开，或「+ 新建会话」创建新项目
          </div>
        ) : (
          splitSessions
            .filter((s) => !s.closed)
            .map((session) => (
              <TerminalPane
                key={session.id}
                session={session}
                isActive={session.id === activeSplitId}
                onClick={() => setActiveSplitId(session.id)}
                onClose={() => handleCloseSession(session.id)}
                canClose={splitSessions.filter((s) => !s.closed).length > 1}
              />
            ))
        )}
      </div>

      {/* 任务队列面板 */}
      <TaskQueuePanel />
    </div>
  )
}
