import { useAppStore } from '../stores/app-store'
import ChatView from './ChatView'
import WelcomeArea from './WelcomeArea'
import InputArea from './InputArea'

export default function RightPanel() {
  const messages = useAppStore((s) => s.messages)
  const activeSessionId = useAppStore((s) => s.activeSessionId)

  return (
    <div
      className="flex flex-col"
      style={{
        flex: 1,
        height: '100vh',
        background: 'var(--bg)',
        overflow: 'hidden'
      }}
    >
      {/* Header */}
      <div
        style={{
          height: 48,
          minHeight: 48,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg-elevated)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <span style={{ color: 'var(--text-secondary)' }}>项目名</span>
          <span style={{ color: 'var(--text-tertiary)' }}>&gt;</span>
          <span style={{ color: 'var(--text)', fontWeight: 500 }}>
            {activeSessionId ? `会话 ${activeSessionId.slice(0, 8)}` : '新会话'}
          </span>
        </div>
        <button
          style={{
            border: 'none',
            background: 'transparent',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: 16,
            padding: '4px 6px',
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center'
          }}
          title="查看上下文"
        >
          🖥
        </button>
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '0 8px'
        }}
      >
        {messages.length === 0 ? <WelcomeArea /> : <ChatView />}
      </div>

      {/* Input */}
      <InputArea />
    </div>
  )
}
