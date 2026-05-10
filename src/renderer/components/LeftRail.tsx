import { useAppStore, type MidPanelView, type TerminalSession } from '../stores/app-store'
import {
  CodeOutlined,
  PlusOutlined,
  EditOutlined,
  MoreOutlined,
  MessageOutlined,
  AppstoreOutlined,
  DollarOutlined,
  SettingOutlined,
  HistoryOutlined
} from '@ant-design/icons'

function generateId() {
  return `pty-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

interface NavItem {
  key: MidPanelView | 'history' | 'code' | 'new-session' | 'customize' | 'more'
  icon: React.ReactNode
  label: string
  badge?: number
  isSection?: boolean
}

export default function LeftRail() {
  const midPanelView = useAppStore((s) => s.midPanelView)
  const setMidPanelView = useAppStore((s) => s.setMidPanelView)
  const showMidPanel = useAppStore((s) => s.showMidPanel)
  const toggleMidPanel = useAppStore((s) => s.toggleMidPanel)
  const splitSessions = useAppStore((s) => s.splitSessions)
  const addSplitSession = useAppStore((s) => s.addSplitSession)
  const updateStatus = useAppStore((s) => s.updateStatus)
  const hasUpdate = updateStatus === 'available' || updateStatus === 'downloaded'

  const topItems: NavItem[] = [
    {
      key: 'code',
      icon: <CodeOutlined style={{ fontSize: 20 }} />,
      label: 'Code',
      isSection: true
    },
    { key: 'new-session', icon: <PlusOutlined style={{ fontSize: 20 }} />, label: '新建会话' },
    { key: 'customize', icon: <EditOutlined style={{ fontSize: 18 }} />, label: '自定义' },
    { key: 'more', icon: <MoreOutlined style={{ fontSize: 18 }} />, label: '更多' }
  ]

  const bottomItems: NavItem[] = [
    {
      key: 'sessions',
      icon: <MessageOutlined style={{ fontSize: 18 }} />,
      label: '会话',
      badge: 3
    },
    {
      key: 'models',
      icon: <AppstoreOutlined style={{ fontSize: 18 }} />,
      label: '模型'
    },
    { key: 'balance', icon: <DollarOutlined style={{ fontSize: 18 }} />, label: '余额' },
    {
      key: 'settings',
      icon: <SettingOutlined style={{ fontSize: 18 }} />,
      label: '设置',
      badge: hasUpdate ? 1 : undefined
    },
    { key: 'history', icon: <HistoryOutlined style={{ fontSize: 18 }} />, label: '历史记录' }
  ]

  const handleClick = (item: NavItem) => {
    if (item.key === 'code') return
    if (item.key === 'new-session') {
      const id = generateId()
      addSplitSession({
        id,
        title: `会话 ${splitSessions.length + 1}`,
        updatedAt: new Date().toLocaleString('zh-CN')
      })
      return
    }
    if (item.key === 'customize') return
    if (item.key === 'more') return

    if (item.key === midPanelView && showMidPanel) {
      toggleMidPanel()
    } else {
      if (!showMidPanel) toggleMidPanel()
      setMidPanelView(item.key)
    }
  }

  const isActive = (item: NavItem) => {
    if (item.key === 'code') return true
    if (item.key === midPanelView && showMidPanel) return true
    return false
  }

  return (
    <div
      className="flex flex-col items-center"
      style={{
        width: 52,
        minWidth: 52,
        height: '100vh',
        background: 'var(--bg-elevated)',
        borderRight: '1px solid var(--border)',
        padding: '8px 0',
        gap: 2
      }}
    >
      {/* Top section */}
      {/* Logo */}
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: 'linear-gradient(135deg, var(--blue), var(--blue-hover))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 8,
          cursor: 'pointer',
          color: '#fff',
          fontWeight: 700,
          fontSize: 14
        }}
        title="ClaudeBridge"
      >
        CB
      </div>

      {topItems.map((item) => (
        <NavIcon
          key={item.key}
          icon={item.icon}
          label={item.label}
          active={isActive(item)}
          badge={item.badge}
          onClick={() => handleClick(item)}
        />
      ))}

      {/* Divider */}
      <div
        style={{
          width: 28,
          height: 1,
          background: 'var(--border)',
          margin: '4px 0'
        }}
      />

      {bottomItems.map((item) => (
        <NavIcon
          key={item.key}
          icon={item.icon}
          label={item.label}
          active={isActive(item)}
          badge={item.badge}
          onClick={() => handleClick(item)}
        />
      ))}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* User avatar */}
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: 'var(--blue-light)',
          color: 'var(--blue)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          marginTop: 4
        }}
        title="我"
      >
        我
      </div>
    </div>
  )
}

function NavIcon({
  icon,
  label,
  active,
  badge,
  onClick
}: {
  icon: React.ReactNode
  label: string
  active: boolean
  badge?: number
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      style={{
        width: 36,
        height: 36,
        borderRadius: 8,
        border: 'none',
        background: active ? 'var(--blue-light)' : 'transparent',
        color: active ? 'var(--blue)' : 'var(--text-secondary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        position: 'relative',
        transition: 'all 0.15s'
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.background = 'var(--surface-hover)'
          e.currentTarget.style.color = 'var(--text)'
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.color = 'var(--text-secondary)'
        }
      }}
    >
      {icon}
      {badge && badge > 0 && (
        <span
          style={{
            position: 'absolute',
            top: 2,
            right: 2,
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: 'var(--red)',
            border: '1.5px solid var(--bg-elevated)'
          }}
        />
      )}
    </button>
  )
}
