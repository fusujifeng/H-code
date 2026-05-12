import { useState } from 'react'
import { useAppStore } from '../stores/app-store'
import { SearchOutlined, DownOutlined, UpOutlined } from '@ant-design/icons'

export default function SessionsList() {
  const splitSessions = useAppStore((s) => s.splitSessions)
  const activeSplitId = useAppStore((s) => s.activeSplitId)
  const setActiveSplitId = useAppStore((s) => s.setActiveSplitId)
  const openSplitSession = useAppStore((s) => s.openSplitSession)
  const historyEntries = useAppStore((s) => s.historyEntries)
  const loadHistorySession = useAppStore((s) => s.loadHistorySession)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // 只显示有对话记录的项目
  const visibleSessions = splitSessions.filter((s) =>
    historyEntries.some((e) => e.sessionId === s.id)
  )

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
          <span>搜索项目...</span>
        </div>
      </div>

      {/* Project + Session combined list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
        {visibleSessions.length === 0 ? (
          <div
            style={{
              padding: '32px 16px',
              textAlign: 'center',
              color: 'var(--text-tertiary)',
              fontSize: 13
            }}
          >
            暂无项目，开始对话后会自动保存
          </div>
        ) : (
          visibleSessions.map((session) => {
            const history = historyEntries.find((e) => e.sessionId === session.id)
            const msgCount = history?.messages.length ?? 0
            const isClosed = session.closed
            const isActive = session.id === activeSplitId && !isClosed
            const isExpanded = expandedId === session.id

            return (
              <div key={session.id} style={{ marginBottom: 2 }}>
                {/* Project header */}
                <div
                  onClick={() => {
                    if (isClosed) {
                      openSplitSession(session.id)
                    } else {
                      setActiveSplitId(session.id)
                    }
                  }}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    background: isActive ? 'var(--blue-light)' : 'transparent',
                    opacity: isClosed ? 0.6 : 1,
                    transition: 'background 0.15s, opacity 0.15s'
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.background = 'var(--surface-hover)'
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: isActive ? 600 : 400,
                        color: 'var(--text)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        flex: 1
                      }}
                    >
                      {session.title}
                      {isClosed && '（已关闭）'}
                    </span>
                    {history && history.messages.length > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setExpandedId(isExpanded ? null : session.id)
                        }}
                        style={{
                          border: 'none',
                          background: 'transparent',
                          color: 'var(--text-tertiary)',
                          cursor: 'pointer',
                          padding: '2px 4px',
                          fontSize: 10
                        }}
                      >
                        {isExpanded ? <UpOutlined /> : <DownOutlined />}
                      </button>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                    {history ? `${history.updatedAt} · ${msgCount} 条消息` : session.updatedAt}
                  </div>
                </div>

                {/* Expanded session messages */}
                {isExpanded && history && (
                  <div style={{ padding: '4px 4px 4px 20px' }}>
                    {history.messages.slice(-5).map((msg) => (
                      <div
                        key={msg.id}
                        onClick={() => loadHistorySession(history)}
                        style={{
                          padding: '6px 8px',
                          borderRadius: 6,
                          marginBottom: 2,
                          cursor: 'pointer',
                          fontSize: 12,
                          color: msg.role === 'user' ? 'var(--text)' : 'var(--text-secondary)',
                          background: 'var(--bg)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'var(--surface-hover)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'var(--bg)'
                        }}
                        title={msg.content}
                      >
                        <span style={{ fontWeight: 500, marginRight: 4 }}>
                          {msg.role === 'user' ? '我:' : 'AI:'}
                        </span>
                        {msg.content.slice(0, 40)}
                        {msg.content.length > 40 ? '...' : ''}
                      </div>
                    ))}
                    {history.messages.length > 5 && (
                      <div
                        style={{
                          fontSize: 11,
                          color: 'var(--text-tertiary)',
                          padding: '4px 8px',
                          textAlign: 'center'
                        }}
                      >
                        ...还有 {history.messages.length - 5} 条消息
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
