import LeftRail from './LeftRail'
import MidPanel from './MidPanel'
import RightPanel from './RightPanel'
import { useAppStore } from '../stores/app-store'

export default function MainLayout() {
  const showMidPanel = useAppStore((s) => s.showMidPanel)

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      <LeftRail />
      {showMidPanel && <MidPanel />}
      <RightPanel />
    </div>
  )
}
