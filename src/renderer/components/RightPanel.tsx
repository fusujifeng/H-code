import { useAppStore } from '../stores/app-store'
import ChatView from './ChatView'
import WelcomeArea from './WelcomeArea'
import InputArea from './InputArea'

export default function RightPanel() {
  const messages = useAppStore((s) => s.messages)

  return (
    <div
      className="flex flex-col"
      style={{
        flex: 1,
        background: 'var(--bg)',
        overflow: 'hidden'
      }}
    >
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
