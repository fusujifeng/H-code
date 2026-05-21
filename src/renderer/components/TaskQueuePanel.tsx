import { useState } from 'react'
import { useAppStore } from '../stores/app-store'
import { PauseOutlined, CaretRightOutlined, CloseOutlined, ContainerOutlined, DeleteOutlined } from '@ant-design/icons'

const statusMap: Record<string, { label: string; color: string }> = {
  queued: { label: '排队中', color: 'var(--text-secondary)' },
  running: { label: '执行中', color: 'var(--blue)' },
  paused: { label: '已暂停', color: 'var(--orange)' },
  completed: { label: '已完成', color: 'var(--green)' },
  failed: { label: '失败', color: 'var(--red)' },
  cancelled: { label: '已取消', color: 'var(--text-tertiary)' }
}

export default function TaskQueuePanel({ sidebar }: { sidebar?: boolean }) {
  const tasks = useAppStore((s) => s.tasks)
  const queueStatus = useAppStore((s) => s.queueStatus)
  const [collapsed, setCollapsed] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  if (tasks.length === 0) {
    if (sidebar) {
      return (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            color: 'var(--text-tertiary)',
            fontSize: 13,
            gap: 12
          }}
        >
          <ContainerOutlined style={{ fontSize: 28, opacity: 0.3 }} />
          <div style={{ textAlign: 'center', lineHeight: 1.6 }}>
            暂无队列任务
            <br />
            <span style={{ fontSize: 11 }}>
              主任务执行期间输入的新任务将自动排队
            </span>
          </div>
        </div>
      )
    }
    return null
  }

  const handlePause = (taskId: number) => {
    window.electronAPI?.pauseTask?.(taskId)
  }

  const handleResume = (taskId: number) => {
    window.electronAPI?.resumeTask?.(taskId)
  }

  const handleCancel = (taskId: number) => {
    window.electronAPI?.cancelTask?.(taskId)
  }

  const handleDelete = (taskId: number) => {
    window.electronAPI?.deleteTask?.(taskId)
  }

  const headerRow = !sidebar ? (
    <div
      onClick={() => setCollapsed(!collapsed)}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 16px',
        cursor: 'pointer',
        fontSize: 12,
        fontWeight: 600,
        color: 'var(--text-secondary)',
        userSelect: 'none'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <ContainerOutlined />
        <span>任务队列</span>
        <span
          style={{
            background: 'var(--border)',
            padding: '1px 6px',
            borderRadius: 10,
            fontSize: 11
          }}
        >
          {queueStatus.active}/{queueStatus.total}
        </span>
      </div>
      <span style={{ fontSize: 10 }}>{collapsed ? '▼' : '▲'}</span>
    </div>
  ) : null

  const showList = sidebar || !collapsed

  return (
    <div
      style={sidebar ? {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      } : {
        borderTop: '1px solid var(--border)',
        background: 'var(--surface)',
        flexShrink: 0
      }}
    >
      {!sidebar && headerRow}

      {showList && (
        <div style={sidebar ? { flex: 1, overflowY: 'auto', padding: '0 12px' } : { maxHeight: 220, overflowY: 'auto', padding: '0 16px 8px' }}>
          {tasks.map((task) => {
            const cfg = statusMap[task.status] || statusMap.queued
            const isExpanded = expandedId === task.id
            const isTerminal =
              task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled'

            return (
              <div
                key={task.id}
                style={{
                  padding: '6px 0',
                  borderBottom: '1px solid var(--border)',
                  fontSize: 12
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
                    <div
                      style={{
                        color: 'var(--text)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      #{task.id} {task.prompt.slice(0, 40)}
                      {task.prompt.length > 40 ? '...' : ''}
                    </div>
                    <div style={{ color: cfg.color, fontSize: 11, marginTop: 2 }}>
                      {cfg.label}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    {task.status === 'queued' && (
                      <button
                        onClick={() => handlePause(task.id)}
                        style={iconBtnStyle}
                        title="暂停"
                      >
                        <PauseOutlined style={{ fontSize: 12 }} />
                      </button>
                    )}
                    {task.status === 'paused' && (
                      <button
                        onClick={() => handleResume(task.id)}
                        style={iconBtnStyle}
                        title="恢复"
                      >
                        <CaretRightOutlined style={{ fontSize: 12 }} />
                      </button>
                    )}
                    {(task.status === 'queued' || task.status === 'paused' || task.status === 'running') && (
                      <button
                        onClick={() => handleCancel(task.id)}
                        style={iconBtnStyle}
                        title="取消"
                      >
                        <CloseOutlined style={{ fontSize: 12 }} />
                      </button>
                    )}
                    {isTerminal && (
                      <>
                        {task.result && (
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : task.id)}
                            style={iconBtnStyle}
                            title={isExpanded ? '收起结果' : '查看结果'}
                          >
                            <span style={{ fontSize: 10 }}>{isExpanded ? '▲' : '▼'}</span>
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(task.id)}
                          style={iconBtnStyle}
                          title="删除"
                        >
                          <DeleteOutlined style={{ fontSize: 12 }} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {isExpanded && task.result && (
                  <div
                    style={{
                      marginTop: 6,
                      padding: '6px 8px',
                      background: 'var(--bg)',
                      borderRadius: 6,
                      color: 'var(--text-secondary)',
                      fontSize: 11,
                      maxHeight: 120,
                      overflowY: 'auto',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      lineHeight: 1.5
                    }}
                  >
                    {task.result}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const iconBtnStyle: React.CSSProperties = {
  width: 24,
  height: 24,
  borderRadius: 4,
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--text)',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
}
