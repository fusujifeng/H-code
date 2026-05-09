import { useState, useRef, useEffect } from 'react'
import { useAppStore, type PermissionMode } from '../stores/app-store'

const modes: { key: PermissionMode; label: string; color: string; bg: string }[] = [
  { key: 'yolo', label: 'YOLO', color: '#f5222d', bg: '#fff2f0' },
  { key: 'trust-edit', label: '信任编辑', color: '#52c41a', bg: '#f6ffed' },
  { key: 'plan', label: '计划模式', color: '#faad14', bg: '#fffbe6' },
  { key: 'manual', label: '手动确认', color: '#8c8c8c', bg: '#f5f5f5' }
]

export default function PermissionToggle() {
  const permission = useAppStore((s) => s.permission)
  const setPermission = useAppStore((s) => s.setPermission)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const current = modes.find((m) => m.key === permission) || modes[3]

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '2px 10px',
          borderRadius: 6,
          border: 'none',
          background: current.bg,
          color: current.color,
          fontWeight: 700,
          fontSize: 12,
          cursor: 'pointer',
          transition: 'all 0.15s'
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: current.color,
            display: 'inline-block'
          }}
        />
        {current.label}
        <span style={{ fontSize: 10, marginLeft: 1 }}>▾</span>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 6px)',
            left: 0,
            background: 'var(--surface)',
            borderRadius: 10,
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-lg)',
            minWidth: 160,
            overflow: 'hidden',
            zIndex: 50
          }}
        >
          {modes.map((mode) => (
            <div
              key={mode.key}
              onClick={() => {
                setPermission(mode.key)
                setOpen(false)
              }}
              style={{
                padding: '8px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: permission === mode.key ? 600 : 400,
                color: 'var(--text)',
                background: permission === mode.key ? 'var(--surface-hover)' : 'transparent',
                transition: 'background 0.1s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--surface-hover)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background =
                  permission === mode.key ? 'var(--surface-hover)' : 'transparent'
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: mode.color
                }}
              />
              {mode.label}
              {permission === mode.key && (
                <span style={{ marginLeft: 'auto', fontSize: 11, color: mode.color }}>✓</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
