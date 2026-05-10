import { useAppStore } from '../stores/app-store'
import ChatView from './ChatView'
import WelcomeArea from './WelcomeArea'
import InputArea from './InputArea'
import XtermTerminal from './XtermTerminal'
import { useState } from 'react'

export default function RightPanel() {
  const messages = useAppStore((s) => s.messages)
  const [useTerminal, setUseTerminal] = useState(true)

  return (
    <div
      className="flex flex-col"
      style={{
        flex: 1,
        background: 'var(--bg)',
        overflow: 'hidden'
      }}
    >
      {/* 模式切换 */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          padding: '6px 12px',
          borderBottom: '1px solid var(--border)',
          alignItems: 'center',
          flexShrink: 0
        }}
      >
        <button
          onClick={() => setUseTerminal(false)}
          style={{
            padding: '3px 10px',
            borderRadius: 6,
            border: 'none',
            background: !useTerminal ? 'var(--blue)' : 'var(--surface)',
            color: !useTerminal ? '#fff' : 'var(--text)',
            cursor: 'pointer',
            fontSize: 12
          }}
        >
          聊天
        </button>
        <button
          onClick={() => setUseTerminal(true)}
          style={{
            padding: '3px 10px',
            borderRadius: 6,
            border: 'none',
            background: useTerminal ? 'var(--blue)' : 'var(--surface)',
            color: useTerminal ? '#fff' : 'var(--text)',
            cursor: 'pointer',
            fontSize: 12
          }}
        >
          Claude Code CLI
        </button>
      </div>

      {/* 内容区 */}
      <div
        style={{
          flex: 1,
          overflow: 'hidden',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {useTerminal ? (
          <XtermTerminal />
        ) : (
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
        )}
      </div>

      {/* 输入框 */}
      <InputArea useTerminal={useTerminal} />
    </div>
  )
}
