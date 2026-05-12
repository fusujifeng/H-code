import { useAppStore, type MidPanelView } from '../stores/app-store'
import SessionsList from './SessionsList'
import SettingsPanel from './SettingsPanel'
import ModelConfig from './ModelConfig'
import BalanceQuery from './BalanceQuery'
import HistoryList from './HistoryList'

const titles: Record<MidPanelView, string> = {
  sessions: '项目列表',
  settings: '设置',
  models: '模型配置',
  balance: '余额查询',
  history: '历史记录'
}

export default function MidPanel() {
  const midPanelView = useAppStore((s) => s.midPanelView)

  const renderContent = () => {
    switch (midPanelView) {
      case 'sessions':
        return <SessionsList />
      case 'settings':
        return <SettingsPanel />
      case 'models':
        return <ModelConfig />
      case 'balance':
        return <BalanceQuery />
      case 'history':
        return <HistoryList />
      default:
        return <SessionsList />
    }
  }

  return (
    <div
      className="flex flex-col"
      style={{
        width: 260,
        minWidth: 260,
        height: '100vh',
        background: 'var(--bg-elevated)',
        borderRight: '1px solid var(--border)',
        overflow: 'hidden'
      }}
    >
      {/* Header */}
      <div
        style={{
          height: 48,
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
          {titles[midPanelView]}
        </span>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>{renderContent()}</div>
    </div>
  )
}
