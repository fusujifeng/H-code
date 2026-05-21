import { useAppStore } from '../stores/app-store'
import TaskPlanPanel from './TaskPlanPanel'
import TaskQueuePanel from './TaskQueuePanel'
import TaskDeliverablesPanel from './TaskDeliverablesPanel'
import DiffDrawer from './DiffDrawer'
import {
  OrderedListOutlined,
  HourglassOutlined,
  FileTextOutlined,
  DoubleRightOutlined,
  DoubleLeftOutlined
} from '@ant-design/icons'

export default function RightSidebar() {
  const collapsed = useAppStore((s) => s.rightSidebarCollapsed)
  const toggleRightSidebar = useAppStore((s) => s.toggleRightSidebar)

  /* ── 完全折叠态 ──────────────────────────────────────────── */
  if (collapsed) {
    return (
      <div
        style={{
          width: 36,
          minWidth: 36,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          borderLeft: '1px solid var(--border)',
          background: 'var(--surface)',
          paddingTop: 8,
          gap: 8
        }}
      >
        <button
          onClick={toggleRightSidebar}
          style={{
            border: 'none',
            background: 'transparent',
            color: 'var(--text-tertiary)',
            cursor: 'pointer',
            padding: 4,
            borderRadius: 4
          }}
          title="展开面板"
        >
          <DoubleLeftOutlined style={{ fontSize: 14 }} />
        </button>
      </div>
    )
  }

  /* ── 展开态：三个面板同时显示，各占三分之一高度 ──────────── */
  return (
    <div
      style={{
        width: 280,
        minWidth: 280,
        display: 'flex',
        flexDirection: 'column',
        borderLeft: '1px solid var(--border)',
        background: 'var(--surface)',
        overflow: 'hidden'
      }}
    >
      {/* 头部 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 12px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0
        }}
      >
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>辅助面板</span>
        <button
          onClick={toggleRightSidebar}
          style={{
            border: 'none',
            background: 'transparent',
            color: 'var(--text-tertiary)',
            cursor: 'pointer',
            padding: 2,
            borderRadius: 4,
            display: 'flex'
          }}
          title="收起面板"
        >
          <DoubleRightOutlined style={{ fontSize: 13 }} />
        </button>
      </div>

      {/* 三个面板 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <PanelSection title="任务规划" icon={<OrderedListOutlined />}>
          <TaskPlanPanel />
        </PanelSection>
        <PanelSection title="任务队列" icon={<HourglassOutlined />}>
          <TaskQueuePanel sidebar />
        </PanelSection>
        <PanelSection title="任务产物" icon={<FileTextOutlined />}>
          <TaskDeliverablesPanel />
        </PanelSection>
      </div>

      <DiffDrawer />
    </div>
  )
}

/* ── 面板分区 ──────────────────────────────────────────────── */

function PanelSection({
  title,
  icon,
  children
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        borderBottom: '1px solid var(--border)'
      }}
    >
      {/* 固定标题 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 12px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0
        }}
      >
        <span style={{ color: 'var(--text-tertiary)', fontSize: 12, display: 'flex' }}>
          {icon}
        </span>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
          {title}
        </span>
      </div>
      {/* 内容 */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  )
}
