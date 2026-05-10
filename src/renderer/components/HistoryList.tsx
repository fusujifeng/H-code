import { useAppStore } from '../stores/app-store'
import { DeleteOutlined, ReloadOutlined } from '@ant-design/icons'

export default function HistoryList() {
  const historyEntries = useAppStore((s) => s.historyEntries)
  const loadHistorySession = useAppStore((s) => s.loadHistorySession)
  const refreshHistory = useAppStore((s) => s.refreshHistory)

  const handleDelete = (sessionId: string) => {
    try {
      const raw = localStorage.getItem('cb-chat-history')
      if (raw) {
        const entries = JSON.parse(raw)
        const updated = entries.filter((e: { sessionId: string }) => e.sessionId !== sessionId)
        localStorage.setItem('cb-chat-history', JSON.stringify(updated))
      }
    } catch { /* ignore */ }
    refreshHistory()
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px'
        }}
      >
        <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
          最近 14 天 · {historyEntries.length} 条记录
        </span>
        <button
          onClick={refreshHistory}
          style={{
            border: 'none',
            background: 'transparent',
            color: 'var(--text-tertiary)',
            cursor: 'pointer',
            fontSize: 14,
            padding: 4,
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center'
          }}
          title="刷新"
        >
          <ReloadOutlined />
        </button>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
        {historyEntries.length === 0 ? (
          <div
            style={{
              padding: '32px 16px',
              textAlign: 'center',
              color: 'var(--text-tertiary)',
              fontSize: 13
            }}
          >
            暂无历史记录，开始对话后会自动保存
          </div>
        ) : (
          historyEntries.map((entry) => (
            <div
              key={entry.sessionId}
              onClick={() => loadHistorySession(entry)}
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                marginBottom: 2,
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                transition: 'background 0.15s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--surface-hover)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    color: 'var(--text)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {entry.title}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                  {entry.updatedAt} · {entry.messages.length} 条消息
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleDelete(entry.sessionId)
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-tertiary)',
                  cursor: 'pointer',
                  padding: 4,
                  borderRadius: 4,
                  flexShrink: 0,
                  opacity: 0.5
                }}
                title="删除"
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '1'
                  e.currentTarget.style.color = 'var(--red)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '0.5'
                  e.currentTarget.style.color = 'var(--text-tertiary)'
                }}
              >
                <DeleteOutlined style={{ fontSize: 12 }} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
