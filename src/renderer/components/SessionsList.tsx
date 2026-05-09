import { useAppStore } from '../stores/app-store'
import { SearchOutlined } from '@ant-design/icons'

export default function SessionsList() {
  const sessions = useAppStore((s) => s.sessions)
  const activeSessionId = useAppStore((s) => s.activeSessionId)
  const setActiveSessionId = useAppStore((s) => s.setActiveSessionId)

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Search */}
      <div style={{ padding: '12px 16px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 12px',
            borderRadius: 8,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            fontSize: 13,
            color: 'var(--text-tertiary)'
          }}
        >
          <SearchOutlined />
          <span>搜索会话...</span>
        </div>
      </div>

      {/* Session list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
        {sessions.length === 0 ? (
          <div
            style={{
              padding: '32px 16px',
              textAlign: 'center',
              color: 'var(--text-tertiary)',
              fontSize: 13
            }}
          >
            暂无会话，点击下方按钮创建
          </div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              onClick={() => setActiveSessionId(session.id)}
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                marginBottom: 2,
                cursor: 'pointer',
                background:
                  session.id === activeSessionId ? 'var(--blue-light)' : 'transparent',
                transition: 'background 0.15s'
              }}
              onMouseEnter={(e) => {
                if (session.id !== activeSessionId)
                  e.currentTarget.style.background = 'var(--surface-hover)'
              }}
              onMouseLeave={(e) => {
                if (session.id !== activeSessionId)
                  e.currentTarget.style.background = 'transparent'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: session.id === activeSessionId ? 600 : 400,
                    color: 'var(--text)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1
                  }}
                >
                  {session.title}
                </span>
                {session.unreadCount > 0 && (
                  <span
                    style={{
                      background: 'var(--blue)',
                      color: '#fff',
                      fontSize: 11,
                      padding: '0 6px',
                      borderRadius: 10,
                      minWidth: 18,
                      textAlign: 'center',
                      fontWeight: 600
                    }}
                  >
                    {session.unreadCount}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                {session.updatedAt}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
