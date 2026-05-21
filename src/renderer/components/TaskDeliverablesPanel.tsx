import { useEffect, useState } from 'react'
import { useAppStore, type DeliverableFile } from '../stores/app-store'
import {
  FileTextOutlined,
  FileAddOutlined,
  DeleteOutlined,
  ReloadOutlined,
  FolderOpenOutlined
} from '@ant-design/icons'

const changeTypeConfig: Record<DeliverableFile['changeType'], { label: string; color: string; bg: string; icon: typeof FileTextOutlined }> = {
  modified: { label: 'M', color: 'var(--orange)', bg: 'var(--orange-light)', icon: FileTextOutlined },
  added: { label: 'A', color: 'var(--green)', bg: 'var(--green-light)', icon: FileAddOutlined },
  deleted: { label: 'D', color: 'var(--red)', bg: 'var(--red-light)', icon: DeleteOutlined }
}

export default function TaskDeliverablesPanel() {
  const deliverables = useAppStore((s) => s.deliverables)
  const setDeliverables = useAppStore((s) => s.setDeliverables)
  const openDiffDrawer = useAppStore((s) => s.openDiffDrawer)
  const [loading, setLoading] = useState(false)

  const fetchFiles = async () => {
    setLoading(true)
    try {
      const result = await window.electronAPI?.getGitChangedFiles?.()
      if (result?.success && result.files) {
        const files: DeliverableFile[] = result.files.map((f) => ({
          filePath: f.filePath,
          changeType: f.changeType,
          relativePath: f.filePath
        }))
        setDeliverables(files)
      }
    } catch { /* ignore */ }
    setLoading(false)
  }

  useEffect(() => {
    fetchFiles()
  }, [])

  // 监听任务完成自动刷新
  useEffect(() => {
    const unsub = window.electronAPI?.onTaskFinished(() => {
      // 延迟一点等文件系统更新
      setTimeout(fetchFiles, 1000)
    })
    return () => unsub?.()
  }, [])

  const handleFileClick = async (file: DeliverableFile) => {
    if (file.changeType === 'deleted') return
    openDiffDrawer(file.filePath)
  }

  if (deliverables.length === 0) {
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
        <FolderOpenOutlined style={{ fontSize: 28, opacity: 0.3 }} />
        <div style={{ textAlign: 'center', lineHeight: 1.6 }}>
          暂无任务产物
          <br />
          <span style={{ fontSize: 11 }}>
            任务执行完成后将自动列出变更文件
          </span>
        </div>
        <button
          onClick={fetchFiles}
          style={{
            marginTop: 4,
            padding: '4px 12px',
            borderRadius: 6,
            border: '1px solid var(--border)',
            background: 'var(--bg)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: 11,
            display: 'flex',
            alignItems: 'center',
            gap: 4
          }}
        >
          <ReloadOutlined spin={loading} style={{ fontSize: 11 }} />
          刷新
        </button>
      </div>
    )
  }

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      {/* 头部 */}
      <div
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 11,
          color: 'var(--text-secondary)'
        }}
      >
        <span>{deliverables.length} 个文件变更</span>
        <button
          onClick={fetchFiles}
          style={{
            padding: '2px 6px',
            borderRadius: 4,
            border: 'none',
            background: 'transparent',
            color: 'var(--text-tertiary)',
            cursor: 'pointer',
            fontSize: 11,
            display: 'flex',
            alignItems: 'center',
            gap: 4
          }}
        >
          <ReloadOutlined spin={loading} style={{ fontSize: 10 }} />
        </button>
      </div>

      {/* 文件列表 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 12px' }}>
        {deliverables.map((file, idx) => {
          const cfg = changeTypeConfig[file.changeType]
          const Icon = cfg.icon
          const fileName = file.relativePath.split('/').pop() || file.relativePath

          return (
            <button
              key={`${file.filePath}-${idx}`}
              onClick={() => handleFileClick(file)}
              disabled={file.changeType === 'deleted'}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 4px',
                border: 'none',
                borderBottom: '1px solid var(--border)',
                background: 'transparent',
                cursor: file.changeType === 'deleted' ? 'default' : 'pointer',
                textAlign: 'left',
                opacity: file.changeType === 'deleted' ? 0.5 : 1
              }}
            >
              {/* 变更类型标签 */}
              <span
                style={{
                  flexShrink: 0,
                  width: 18,
                  height: 18,
                  borderRadius: 3,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  fontWeight: 700,
                  color: cfg.color,
                  background: cfg.bg
                }}
              >
                {cfg.label}
              </span>

              {/* 文件图标 */}
              <Icon style={{ fontSize: 12, color: 'var(--text-tertiary)', flexShrink: 0 }} />

              {/* 文件路径 */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--text)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {fileName}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: 'var(--text-tertiary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    marginTop: 1
                  }}
                >
                  {file.relativePath}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
