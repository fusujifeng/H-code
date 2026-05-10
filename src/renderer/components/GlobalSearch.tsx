import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useAppStore } from '../stores/app-store'
import {
  MessageOutlined,
  SettingOutlined,
  AppstoreOutlined,
  DollarOutlined,
  EditOutlined,
  PlusOutlined,
  SearchOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  EnterOutlined,
  CloseOutlined
} from '@ant-design/icons'

interface SearchItem {
  id: string
  icon: React.ReactNode
  title: string
  subtitle?: string
  shortcut?: string
  action: () => void
}

export default function GlobalSearch() {
  const showSearch = useAppStore((s) => s.showSearch)
  const setSearch = useAppStore((s) => s.setSearch)
  const sessions = useAppStore((s) => s.sessions)
  const setActiveSessionId = useAppStore((s) => s.setActiveSessionId)
  const setMidPanelView = useAppStore((s) => s.setMidPanelView)
  const toggleMidPanel = useAppStore((s) => s.toggleMidPanel)
  const showMidPanel = useAppStore((s) => s.showMidPanel)

  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  /* build search items */
  const items = useMemo<SearchItem[]>(() => {
    const base: SearchItem[] = [
      {
        id: 'new-session',
        icon: <PlusOutlined />,
        title: '新建会话',
        subtitle: '开始一个新的聊天会话',
        action: () => {
          setActiveSessionId(null)
          setSearch(false)
        }
      },
      {
        id: 'goto-sessions',
        icon: <MessageOutlined />,
        title: '打开会话列表',
        subtitle: '查看所有历史会话',
        action: () => {
          setMidPanelView('sessions')
          if (!showMidPanel) toggleMidPanel()
          setSearch(false)
        }
      },
      {
        id: 'goto-settings',
        icon: <SettingOutlined />,
        title: '打开设置',
        subtitle: '偏好设置与主题',
        action: () => {
          setMidPanelView('settings')
          if (!showMidPanel) toggleMidPanel()
          setSearch(false)
        }
      },
      {
        id: 'goto-models',
        icon: <AppstoreOutlined />,
        title: '模型配置',
        subtitle: '管理 AI 模型与 API 密钥',
        action: () => {
          setMidPanelView('models')
          if (!showMidPanel) toggleMidPanel()
          setSearch(false)
        }
      },
      {
        id: 'goto-balance',
        icon: <DollarOutlined />,
        title: '余额查询',
        subtitle: '查看各模型账户余额',
        action: () => {
          setMidPanelView('balance')
          if (!showMidPanel) toggleMidPanel()
          setSearch(false)
        }
      },
      {
        id: 'toggle-theme',
        icon: <EditOutlined />,
        title: '切换主题',
        subtitle: '更换应用外观主题',
        action: () => {
          setMidPanelView('settings')
          if (!showMidPanel) toggleMidPanel()
          setSearch(false)
        }
      }
    ]

    sessions.forEach((s) => {
      base.push({
        id: `session-${s.id}`,
        icon: <MessageOutlined />,
        title: s.title || `会话 ${s.id.slice(0, 8)}`,
        subtitle: `打开会话 · ${s.updatedAt}`,
        action: () => {
          setActiveSessionId(s.id)
          setSearch(false)
        }
      })
    })

    return base
  }, [sessions, setActiveSessionId, setMidPanelView, toggleMidPanel, showMidPanel, setSearch])

  /* filter by query */
  const filtered = useMemo(() => {
    if (!query.trim()) return items
    const q = query.toLowerCase()
    return items.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        (i.subtitle?.toLowerCase().includes(q) ?? false)
    )
  }, [items, query])

  /* reset index when filter changes */
  useEffect(() => {
    setSelectedIndex(0)
  }, [filtered.length, query])

  /* focus input when opened */
  useEffect(() => {
    if (showSearch) {
      setTimeout(() => inputRef.current?.focus(), 50)
    } else {
      setQuery('')
      setSelectedIndex(0)
    }
  }, [showSearch])

  /* global Ctrl+K shortcut */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearch(!showSearch)
      }
      if (e.key === 'Escape' && showSearch) {
        setSearch(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [showSearch, setSearch])

  /* keyboard navigation inside modal */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((i) => (i + 1) % filtered.length)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((i) => (i - 1 + filtered.length) % filtered.length)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        filtered[selectedIndex]?.action()
      } else if (e.key === 'Escape') {
        setSearch(false)
      }
    },
    [filtered, selectedIndex, setSearch]
  )

  /* scroll selected into view */
  useEffect(() => {
    const el = listRef.current?.children[selectedIndex] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  if (!showSearch) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '10vh',
        background: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(4px)'
      }}
      onClick={() => setSearch(false)}
    >
      <div
        style={{
          width: 560,
          maxWidth: '90vw',
          background: 'var(--bg-elevated)',
          borderRadius: 12,
          border: '1px solid var(--border)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        tabIndex={-1}
      >
        {/* Input */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '14px 16px',
            borderBottom: '1px solid var(--border)'
          }}
        >
          <SearchOutlined style={{ fontSize: 18, color: 'var(--text-tertiary)', flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索会话、设置、操作..."
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              color: 'var(--text)',
              fontSize: 16,
              fontFamily: 'inherit'
            }}
          />
          <kbd
            style={{
              fontSize: 11,
              padding: '2px 6px',
              borderRadius: 4,
              background: 'var(--bg)',
              color: 'var(--text-tertiary)',
              border: '1px solid var(--border)',
              fontFamily: 'inherit',
              flexShrink: 0
            }}
          >
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div
          ref={listRef}
          style={{
            maxHeight: 360,
            overflowY: 'auto',
            padding: '4px 6px'
          }}
        >
          {filtered.length === 0 ? (
            <div
              style={{
                padding: '32px 16px',
                textAlign: 'center',
                color: 'var(--text-tertiary)',
                fontSize: 13
              }}
            >
              未找到匹配结果
            </div>
          ) : (
            filtered.map((item, idx) => {
              const active = idx === selectedIndex
              return (
                <button
                  key={item.id}
                  onClick={() => item.action()}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 12px',
                    borderRadius: 8,
                    border: 'none',
                    background: active ? 'var(--accent)' : 'transparent',
                    color: active ? '#fff' : 'var(--text)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                    fontSize: 14,
                    transition: 'background 0.1s'
                  }}
                >
                  <span
                    style={{
                      fontSize: 16,
                      color: active ? '#fff' : 'var(--text-secondary)',
                      flexShrink: 0,
                      width: 20,
                      display: 'flex',
                      justifyContent: 'center'
                    }}
                  >
                    {item.icon}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, fontSize: 14 }}>{item.title}</div>
                    {item.subtitle && (
                      <div
                        style={{
                          fontSize: 12,
                          color: active ? 'rgba(255,255,255,0.75)' : 'var(--text-tertiary)',
                          marginTop: 2,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {item.subtitle}
                      </div>
                    )}
                  </div>
                  {active && (
                    <EnterOutlined
                      style={{
                        fontSize: 12,
                        color: 'rgba(255,255,255,0.7)',
                        flexShrink: 0
                      }}
                    />
                  )}
                </button>
              )
            })
          )}
        </div>

        {/* Footer hints */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '8px 14px',
            borderTop: '1px solid var(--border)',
            fontSize: 11,
            color: 'var(--text-tertiary)'
          }}
        >
          <Hint icon={<ArrowUpOutlined />} label="上" />
          <Hint icon={<ArrowDownOutlined />} label="下" />
          <Hint icon={<EnterOutlined />} label="选择" />
          <div style={{ flex: 1 }} />
          <span>{filtered.length} 个结果</span>
        </div>
      </div>
    </div>
  )
}

function Hint({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <kbd
        style={{
          fontSize: 10,
          padding: '1px 4px',
          borderRadius: 3,
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          fontFamily: 'inherit',
          display: 'flex',
          alignItems: 'center',
          gap: 2
        }}
      >
        {icon}
      </kbd>
      <span>{label}</span>
    </span>
  )
}
