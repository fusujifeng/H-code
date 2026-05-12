import { useState, useRef, useCallback, useEffect } from 'react'
import { useAppStore, type FloatStatus } from '../stores/app-store'

const stateColors: Record<FloatStatus, string> = {
  idle: '#9ca3af',
  running: '#1677ff',
  success: '#52c41a',
  confirm: '#faad14',
  error: '#f5222d'
}

const stateAnimations: Record<FloatStatus, string> = {
  idle: 'breath 2.5s ease-in-out infinite',
  running: 'bounce-active 0.8s ease-in-out infinite',
  success: 'spin-glow 1.5s ease-in-out infinite',
  confirm: 'pulse-beat 0.8s ease-in-out infinite',
  error: 'shake 0.4s ease-in-out infinite'
}

export default function FloatBall() {
  const floatStatus = useAppStore((s) => s.floatStatus)
  const setFloatStatus = useAppStore((s) => s.setFloatStatus)
  const [showMenu, setShowMenu] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const dragStart = useRef({ x: 0, y: 0 })
  const posStart = useRef({ x: 0, y: 0 })
  const ballRef = useRef<HTMLDivElement>(null)

  const currentColor = stateColors[floatStatus]
  const currentAnim = stateAnimations[floatStatus]
  console.log('[FloatBall] render, floatStatus:', floatStatus, 'color:', currentColor, 'anim:', currentAnim)

  const handleClick = () => {
    console.log('[FloatBall] clicked, current status:', floatStatus)
    setShowMenu(false)
    // 点击恢复 idle，避免状态卡住
    setFloatStatus('idle')
    console.log('[FloatBall] set to idle')
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setShowMenu(!showMenu)
  }

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 2) return // Right click handled separately
      setDragging(true)
      dragStart.current = { x: e.clientX, y: e.clientY }
      posStart.current = { x: position.x, y: position.y }
    },
    [position]
  )

  useEffect(() => {
    if (!dragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStart.current.x
      const dy = e.clientY - dragStart.current.y
      setPosition({
        x: posStart.current.x + dx,
        y: posStart.current.y + dy
      })
    }

    const handleMouseUp = () => {
      setDragging(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [dragging])

  return (
    <>
      <div
        ref={ballRef}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onMouseDown={handleMouseDown}
        style={{
          position: 'fixed',
          bottom: position.y ? 'auto' : 90,
          right: position.x ? 'auto' : 36,
          top: position.y ? position.y : 'auto',
          left: position.x ? position.x : 'auto',
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: 'var(--surface)',
          border: `1px solid var(--border)`,
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: dragging ? 'grabbing' : 'pointer',
          zIndex: 999,
          animation: currentAnim,
          transition: dragging ? 'none' : 'all 0.3s',
          userSelect: 'none'
        }}
      >
        <div
          style={{
            width: 26,
            height: 26,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <SparkleSvg color={currentColor} />
        </div>
      </div>

      {/* Context Menu */}
      {showMenu && (
        <>
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 998
            }}
            onClick={() => setShowMenu(false)}
          />
          <div
            style={{
              position: 'fixed',
              bottom: position.y ? 'auto' : 150,
              right: position.x ? 'auto' : 36,
              top: position.y ? position.y - 60 : 'auto',
              left: position.x ? position.x : 'auto',
              background: 'var(--surface)',
              borderRadius: 10,
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-lg)',
              minWidth: 160,
              overflow: 'hidden',
              zIndex: 999
            }}
          >
            {[
              { label: '打开主界面', action: () => {} },
              { label: '暂停所有任务', action: () => setFloatStatus('idle') },
              { label: '💰 显示余额', action: () => {} },
              { label: '退出', action: () => {} }
            ].map((item, i) => (
              <div
                key={i}
                onClick={() => {
                  item.action()
                  setShowMenu(false)
                }}
                style={{
                  padding: '9px 16px',
                  fontSize: 13,
                  color: 'var(--text)',
                  cursor: 'pointer',
                  borderBottom:
                    i < 3 ? '1px solid var(--border)' : 'none',
                  transition: 'background 0.1s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--surface-hover)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                {item.label}
              </div>
            ))}
          </div>
        </>
      )}
    </>
  )
}

function SparkleSvg({ color }: { color: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2L13.5 8.5L12 10L10.5 8.5L12 2Z"
        fill={color}
      />
      <path d="M12 14L13.5 20.5L12 22L10.5 20.5L12 14Z" fill={color} />
      <path d="M2 12L8.5 10.5L10 12L8.5 13.5L2 12Z" fill={color} />
      <path
        d="M14 12L20.5 10.5L22 12L20.5 13.5L14 12Z"
        fill={color}
      />
      <circle cx="12" cy="12" r="2.5" fill={color} />
    </svg>
  )
}
