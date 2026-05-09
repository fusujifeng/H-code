import { useAppStore } from '../stores/app-store'
import MessageBubble from './MessageBubble'

export default function ChatView() {
  const messages = useAppStore((s) => s.messages)

  return (
    <div style={{ padding: '16px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}
    </div>
  )
}
