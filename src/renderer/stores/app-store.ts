import { create } from 'zustand'

export type ThemeId = 'antdx' | 'blackgold' | 'vscode' | 'claude' | 'trae' | 'qoder' | 'idea'
export type MidPanelView = 'sessions' | 'settings' | 'models' | 'balance' | 'history'
export type PermissionMode = 'yolo' | 'trust-edit' | 'plan' | 'manual'
export type FloatStatus = 'idle' | 'running' | 'success' | 'confirm' | 'error'
export type TaskStatus = 'queued' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'

export interface ModelConfig {
  id: string
  name: string
  provider: string
  apiKey?: string
  baseUrl?: string
  enabled: boolean
  icon?: string
}

export interface BalanceInfo {
  id: string
  modelName: string
  provider: string
  keyMask: string
  lastUpdated: string
  amount: string
  currency: string
  status: 'ok' | 'failed' | 'loading'
}

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
  model?: string
  sessionId?: string
  tokenUsage?: number
}

export interface Session {
  id: string
  title: string
  updatedAt: string
  unreadCount: number
}

export interface TerminalSession {
  id: string
  title: string
  updatedAt: string
  closed?: boolean
}

export interface HistoryEntry {
  sessionId: string
  title: string
  updatedAt: string
  messages: Message[]
}

export interface TaskItem {
  id: number
  conversationId: string | null
  status: TaskStatus
  pipelineConfig: string | null
  result: string | null
  prompt: string
  createdAt: string
  finishedAt: string | null
}

/* ── 历史记录持久化 ──────────────────────────────────────── */

const HISTORY_KEY = 'cb-chat-history'
const HISTORY_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000 // 14 天
const HISTORY_MAX_COUNT = 10

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    const data = JSON.parse(raw) as HistoryEntry[]
    const cutoff = Date.now() - HISTORY_MAX_AGE_MS
    return data
      .filter((e) => new Date(e.updatedAt).getTime() > cutoff)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, HISTORY_MAX_COUNT)
  } catch {
    return []
  }
}

function saveHistory(entries: HistoryEntry[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries))
  } catch { /* storage full or unavailable */ }
}

function loadSetting<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (raw !== null) return JSON.parse(raw) as T
  } catch { /* ignore */ }
  return defaultValue
}

function saveSetting<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch { /* ignore */ }
}

interface AppState {
  theme: ThemeId
  midPanelView: MidPanelView
  permission: PermissionMode
  floatStatus: FloatStatus
  activeSessionId: string | null
  sessions: Session[]
  messages: Message[]
  models: ModelConfig[]
  balances: BalanceInfo[]
  showMidPanel: boolean
  showSearch: boolean

  /* 分屏终端 */
  splitSessions: TerminalSession[]
  activeSplitId: string | null

  /* 历史记录 */
  historyEntries: HistoryEntry[]

  /* 自动更新 */
  updateStatus: 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error'
  updateProgress: number
  updateError: string | null

  /* 任务队列 */
  tasks: TaskItem[]
  queueStatus: { total: number; active: number }
  currentTaskId: number | null

  /* 趣味模式 */
  funnyMode: boolean

  /* 文件感知 */
  fileWatcherEnabled: boolean

  /* 悬浮球自动展开 */
  autoExpandFloatBall: boolean

  setTheme: (theme: ThemeId) => void
  setMidPanelView: (view: MidPanelView) => void
  setPermission: (mode: PermissionMode) => void
  setFloatStatus: (status: FloatStatus) => void
  setActiveSessionId: (id: string | null) => void
  addMessage: (message: Message) => void
  setMessages: (messages: Message[]) => void
  setSessions: (sessions: Session[]) => void
  setModels: (models: ModelConfig[]) => void
  toggleModel: (id: string) => void
  setBalances: (balances: BalanceInfo[]) => void
  updateBalance: (id: string, updates: Partial<BalanceInfo>) => void
  toggleMidPanel: () => void
  toggleSearch: () => void
  setSearch: (show: boolean) => void
  updateMessage: (id: string, updates: Partial<Message>) => void

  /* 分屏终端 actions */
  addSplitSession: (session: TerminalSession) => void
  removeSplitSession: (id: string) => void
  closeSplitSession: (id: string) => void
  openSplitSession: (id: string) => void
  setActiveSplitId: (id: string | null) => void

  /* 历史记录 actions */
  saveSessionToHistory: (sessionId: string, title: string) => void
  loadHistorySession: (entry: HistoryEntry) => void
  refreshHistory: () => void
  setHistoryEntries: (entries: HistoryEntry[]) => void

  /* 自动更新 actions */
  setUpdateStatus: (status: AppState['updateStatus']) => void
  setUpdateProgress: (progress: number) => void
  setUpdateError: (error: string | null) => void

  /* 任务队列 actions */
  setTasks: (tasks: TaskItem[]) => void
  updateTask: (task: TaskItem) => void
  removeTask: (taskId: number) => void
  setQueueStatus: (status: { total: number; active: number }) => void
  setCurrentTaskId: (id: number | null) => void

  /* 趣味模式 */
  setFunnyMode: (enabled: boolean) => void

  /* 文件感知 */
  setFileWatcherEnabled: (enabled: boolean) => void

  /* 悬浮球自动展开 */
  setAutoExpandFloatBall: (enabled: boolean) => void
}

const defaultModels: ModelConfig[] = [
  {
    id: '1',
    name: 'DeepSeek-V4-Pro',
    provider: 'DeepSeek',
    enabled: true,
    baseUrl: 'https://api.deepseek.com/anthropic'
  },
  {
    id: '2',
    name: 'GPT-4o',
    provider: 'OpenAI',
    enabled: false
  },
  {
    id: '3',
    name: '小米MIMO',
    provider: '小米',
    enabled: false
  }
]

function loadModels(): ModelConfig[] {
  try {
    const raw = localStorage.getItem('cb-models')
    if (raw) return JSON.parse(raw) as ModelConfig[]
  } catch { /* ignore */ }
  return [...defaultModels]
}

function saveModels(models: ModelConfig[]): void {
  try {
    localStorage.setItem('cb-models', JSON.stringify(models))
  } catch { /* ignore */ }
}

const defaultBalances: BalanceInfo[] = [
  {
    id: '1',
    modelName: 'DeepSeek-V4-Pro',
    provider: 'DeepSeek',
    keyMask: 'sk-...****',
    lastUpdated: '2026-05-10 10:30',
    amount: '¥5.80',
    currency: 'CNY',
    status: 'ok'
  },
  {
    id: '2',
    modelName: 'GPT-4o',
    provider: 'OpenAI',
    keyMask: 'sk-...****',
    lastUpdated: '2026-05-10 10:30',
    amount: '$12.45',
    currency: 'USD',
    status: 'ok'
  },
  {
    id: '3',
    modelName: '小米MIMO',
    provider: '小米',
    keyMask: 'xm-...****',
    lastUpdated: '2026-05-10 09:15',
    amount: '--',
    currency: 'CNY',
    status: 'loading'
  }
]

const loadTheme = (): ThemeId => {
  try {
    const stored = localStorage.getItem('cb-theme')
    if (stored) return stored as ThemeId
  } catch {
    // localStorage unavailable
  }
  return 'antdx'
}

export const useAppStore = create<AppState>((set) => ({
  theme: loadTheme(),
  midPanelView: 'sessions',
  permission: 'manual',
  floatStatus: 'idle',
  activeSessionId: null,
  sessions: [],
  messages: [],
  models: loadModels(),
  balances: [...defaultBalances],
  showMidPanel: true,
  showSearch: false,
  splitSessions: [],
  activeSplitId: null,
  historyEntries: loadHistory(),
  updateStatus: 'idle',
  updateProgress: 0,
  updateError: null,
  tasks: [],
  queueStatus: { total: 0, active: 0 },
  currentTaskId: null,
  funnyMode: loadSetting('cb-funny-mode', false),
  fileWatcherEnabled: loadSetting('cb-file-watcher', false),
  autoExpandFloatBall: loadSetting('cb-auto-expand-float-ball', false),

  setTheme: (theme) => {
    try {
      localStorage.setItem('cb-theme', theme)
    } catch {
      // ignore
    }
    set({ theme })
  },

  setMidPanelView: (view) => set({ midPanelView: view }),

  setPermission: (permission) => set({ permission }),

  setFloatStatus: (floatStatus) => {
    console.log('[AppStore] setFloatStatus:', floatStatus)
    set({ floatStatus })
  },

  setActiveSessionId: (id) => set({ activeSessionId: id }),

  addMessage: (message) =>
    set((state) => {
      const newMessages = [...state.messages, message]

      // Auto-persist to history if sessionId is present
      if (message.sessionId) {
        const existing = state.historyEntries.find((e) => e.sessionId === message.sessionId)
        const now = new Date().toISOString()
        const updated: HistoryEntry = existing
          ? { ...existing, updatedAt: now, messages: [...existing.messages, message] }
          : {
              sessionId: message.sessionId!,
              title: `会话 ${state.historyEntries.length + 1}`,
              updatedAt: now,
              messages: [message]
            }

        const entries = [
          updated,
          ...state.historyEntries.filter((e) => e.sessionId !== message.sessionId)
        ]
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
          .slice(0, HISTORY_MAX_COUNT)

        saveHistory(entries)

        // 同步到 SQLite 数据库（fire-and-forget）
        try {
          const isFirst = !state.historyEntries.some((e) => e.sessionId === message.sessionId)
          if (isFirst) {
            window.electronAPI?.createConversation?.(message.sessionId, updated.title).catch(() => {})
          }
          window.electronAPI?.addMessage?.(message.sessionId, {
            role: message.role,
            content: message.content,
            model: message.model,
            tokenUsage: message.tokenUsage
          }).catch(() => {})
        } catch { /* ignore */ }

        return { messages: newMessages, historyEntries: entries }
      }

      return { messages: newMessages }
    }),

  setMessages: (messages) => set({ messages }),

  updateMessage: (id: string, updates: Partial<Message>) =>
    set((state) => {
      const newMessages = state.messages.map((m) => (m.id === id ? { ...m, ...updates } : m))

      // 同步更新 historyEntries 中同一条消息的内容
      const updatedMsg = newMessages.find((m) => m.id === id)
      let newHistoryEntries = state.historyEntries
      if (updatedMsg?.sessionId) {
        newHistoryEntries = state.historyEntries.map((entry) => {
          if (entry.sessionId !== updatedMsg.sessionId) return entry
          const msgIndex = entry.messages.findIndex((m) => m.id === id)
          if (msgIndex === -1) return entry
          const newEntryMessages = [...entry.messages]
          newEntryMessages[msgIndex] = { ...newEntryMessages[msgIndex], ...updates }
          return { ...entry, messages: newEntryMessages }
        })
      }

      return { messages: newMessages, historyEntries: newHistoryEntries }
    }),

  setSessions: (sessions) => set({ sessions }),

  setModels: (models) => {
    saveModels(models)
    set({ models })
  },

  toggleModel: (id) =>
    set((state) => {
      const updated = state.models.map((m) => (m.id === id ? { ...m, enabled: !m.enabled } : m))
      saveModels(updated)
      return { models: updated }
    }),

  setBalances: (balances) => set({ balances }),

  updateBalance: (id, updates) =>
    set((state) => ({
      balances: state.balances.map((b) => (b.id === id ? { ...b, ...updates } : b))
    })),

  toggleMidPanel: () => set((state) => ({ showMidPanel: !state.showMidPanel })),

  toggleSearch: () => set((state) => ({ showSearch: !state.showSearch })),

  setSearch: (show) => set({ showSearch: show }),

  /* 分屏终端 */
  addSplitSession: (session) =>
    set((state) => ({
      splitSessions: [...state.splitSessions, session],
      activeSplitId: session.id
    })),

  removeSplitSession: (id) =>
    set((state) => ({
      splitSessions: state.splitSessions.filter((s) => s.id !== id),
      activeSplitId:
        state.activeSplitId === id
          ? state.splitSessions.find((s) => s.id !== id)?.id ?? null
          : state.activeSplitId
    })),

  closeSplitSession: (id) =>
    set((state) => ({
      splitSessions: state.splitSessions.map((s) =>
        s.id === id ? { ...s, closed: true } : s
      ),
      activeSplitId:
        state.activeSplitId === id
          ? state.splitSessions.find((s) => s.id !== id && !s.closed)?.id ?? null
          : state.activeSplitId
    })),

  openSplitSession: (id) =>
    set((state) => ({
      splitSessions: state.splitSessions.map((s) =>
        s.id === id ? { ...s, closed: false } : s
      ),
      activeSplitId: id
    })),

  setActiveSplitId: (id) => set({ activeSplitId: id }),

  /* 历史记录 */
  saveSessionToHistory: (sessionId, title) =>
    set((state) => {
      const existing = state.historyEntries.find((e) => e.sessionId === sessionId)
      const now = new Date().toISOString()
      const updated: HistoryEntry = existing
        ? { ...existing, title, updatedAt: now }
        : { sessionId, title, updatedAt: now, messages: [] }

      const entries = [
        updated,
        ...state.historyEntries.filter((e) => e.sessionId !== sessionId)
      ]
        .filter((e) => e.messages.length > 0 || e.sessionId === sessionId)
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, HISTORY_MAX_COUNT)

      saveHistory(entries)
      return { historyEntries: entries }
    }),

  loadHistorySession: (entry) =>
    set({
      messages: entry.messages,
      activeSessionId: entry.sessionId
    }),

  refreshHistory: () => set({ historyEntries: loadHistory() }),
  setHistoryEntries: (entries) => {
    saveHistory(entries)
    set({ historyEntries: entries })
  },

  /* 自动更新 */
  setUpdateStatus: (status) => set({ updateStatus: status }),
  setUpdateProgress: (progress) => set({ updateProgress: progress }),
  setUpdateError: (error) => set({ updateError: error }),

  /* 任务队列 */
  setTasks: (tasks) => set({ tasks }),
  updateTask: (task) =>
    set((state) => {
      const exists = state.tasks.find((t) => t.id === task.id)
      if (exists) {
        return {
          tasks: state.tasks.map((t) => (t.id === task.id ? task : t))
        }
      }
      return { tasks: [task, ...state.tasks] }
    }),
  removeTask: (taskId) =>
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== taskId)
    })),
  setQueueStatus: (queueStatus) => set({ queueStatus }),
  setCurrentTaskId: (id) => set({ currentTaskId: id }),

  /* 趣味模式 */
  setFunnyMode: (enabled) => {
    saveSetting('cb-funny-mode', enabled)
    set({ funnyMode: enabled })
  },

  /* 文件感知 */
  setFileWatcherEnabled: (enabled) => {
    saveSetting('cb-file-watcher', enabled)
    set({ fileWatcherEnabled: enabled })
  },

  /* 悬浮球自动展开 */
  setAutoExpandFloatBall: (enabled) => {
    saveSetting('cb-auto-expand-float-ball', enabled)
    set({ autoExpandFloatBall: enabled })
  }
}))
