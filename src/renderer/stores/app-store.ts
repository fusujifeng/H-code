import { create } from 'zustand'

export type ThemeId = 'antdx' | 'blackgold' | 'vscode' | 'claude' | 'trae' | 'qoder' | 'idea'
export type MidPanelView = 'sessions' | 'settings' | 'models' | 'balance'
export type PermissionMode = 'yolo' | 'trust-edit' | 'plan' | 'manual'
export type FloatStatus = 'idle' | 'running' | 'success' | 'confirm' | 'error'

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
}

export interface Session {
  id: string
  title: string
  updatedAt: string
  unreadCount: number
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
}

const defaultModels: ModelConfig[] = [
  {
    id: '1',
    name: 'DeepSeek-V4-Pro',
    provider: 'DeepSeek',
    enabled: true,
    baseUrl: 'https://api.deepseek.com/anthropic',
    apiKey: 'sk-443cf9d14c654a2baac2e7e2f2058334'
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
  models: [...defaultModels],
  balances: [...defaultBalances],
  showMidPanel: true,
  showSearch: false,

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

  setFloatStatus: (floatStatus) => set({ floatStatus }),

  setActiveSessionId: (id) => set({ activeSessionId: id }),

  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),

  setMessages: (messages) => set({ messages }),

  updateMessage: (id: string, updates: Partial<Message>) =>
    set((state) => ({
      messages: state.messages.map((m) => (m.id === id ? { ...m, ...updates } : m))
    })),

  setSessions: (sessions) => set({ sessions }),

  setModels: (models) => set({ models }),

  toggleModel: (id) =>
    set((state) => ({
      models: state.models.map((m) => (m.id === id ? { ...m, enabled: !m.enabled } : m))
    })),

  setBalances: (balances) => set({ balances }),

  updateBalance: (id, updates) =>
    set((state) => ({
      balances: state.balances.map((b) => (b.id === id ? { ...b, ...updates } : b))
    })),

  toggleMidPanel: () => set((state) => ({ showMidPanel: !state.showMidPanel })),

  toggleSearch: () => set((state) => ({ showSearch: !state.showSearch })),

  setSearch: (show) => set({ showSearch: show })
}))
