import { useState } from 'react'
import { useAppStore } from '../stores/app-store'
import { PauseOutlined, CaretRightOutlined, CloseOutlined, ContainerOutlined } from '@ant-design/icons'

const statusMap: Record<string, { label: string; color: string }> = {
  queued: { label: '排队中', color: 'var(--text-secondary)' },
  running: { label: '执行中', color: 'var(--blue)' },
  paused: { label: '已暂停', color: 'var(--orange)' },
  completed: { label: '已完成', color: 'var(--green)' },
  failed: { label: '失败', color: 'var(--red)' },
  cancelled: { label: '已取消', color: 'var(--text-tertiary)' }
}

export default function TaskQueuePanel() {
  const tasks = useAppStore((s) => s.tasks)
  const queueStatus = useAppStore((s) => s.queueStatus)
  const [collapsed, setCollapsed] = useState(false)

  if (tasks.length === 0) return null

  const handlePause = (taskId: number) => {
    window.electronAPI?.pauseTask?.(taskId)
  }

  const handleResume = (taskId: number) => {
    window.electronAPI?.resumeTask?.(taskId)
  }

  const handleCancel = (taskId: number) => {
    window.electronAPI?.cancelTask?.(taskId)
  }

  return (
    <div
      style={{
        borderTop: '1px solid var(--border)',
        background: 'var(--surface)',
        flexShrink: 0
      }}
    >
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

      {!collapsed && (
        <div style={{ maxHeight: 180, overflowY: 'auto', padding: '0 16px 8px' }}>
          {tasks.map((task) => {
            const cfg = statusMap[task.status] || statusMap.queued
            return (
              <div
                key={task.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 0',
                  borderBottom: '1px solid var(--border)',
                  fontSize: 12
                }}
              >
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
                  {(task.status === 'queued' || task.status === 'paused') && (
                    <button
                      onClick={() => handleCancel(task.id)}
                      style={iconBtnStyle}
                      title="取消"
                    >
                      <CloseOutlined style={{ fontSize: 12 }} />
                    </button>
                  )}
                </div>
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
