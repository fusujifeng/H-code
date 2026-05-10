import LeftRail from './LeftRail'
import MidPanel from './MidPanel'
import RightPanel from './RightPanel'
import TitleBar from './TitleBar'
import GlobalSearch from './GlobalSearch'
import { useAppStore } from '../stores/app-store'

export default function MainLayout() {
  const showMidPanel = useAppStore((s) => s.showMidPanel)

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden'
      }}
    >
      {/* Custom title bar (Claude Code Desktop style) */}
      <TitleBar />

      {/* Main 3-column area below title bar */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <LeftRail />
        {showMidPanel && <MidPanel />}
        <RightPanel />
      </div>

      {/* Global Command Palette */}
      <GlobalSearch />
    </div>
  )
}
