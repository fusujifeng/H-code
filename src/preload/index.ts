import { contextBridge, ipcRenderer } from 'electron'

const electronAPI = {
  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowMaximize: () => ipcRenderer.invoke('window-maximize'),
  windowClose: () => ipcRenderer.invoke('window-close'),
  windowIsMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  onWindowMaximized: (callback: (maximized: boolean) => void) => {
    const listener = (_event: unknown, value: boolean) => callback(value)
    ipcRenderer.on('window-maximized', listener)
    return () => ipcRenderer.removeListener('window-maximized', listener)
  },

  /* 托盘 / 悬浮球 */
  showMainWindow: () => ipcRenderer.invoke('show-main-window'),
  quitApp: () => ipcRenderer.invoke('quit-app'),
  hideFloatBall: () => ipcRenderer.invoke('hide-float-ball'),
  showFloatBall: () => ipcRenderer.invoke('show-float-ball'),
  floatBallMoveStart: () => ipcRenderer.invoke('float-ball-move-start'),
  floatBallMove: (x: number, y: number) => ipcRenderer.invoke('float-ball-move', x, y),
  showFloatBallContextMenu: () => ipcRenderer.invoke('show-float-ball-context-menu'),
  setAutoExpandFloatBall: (enabled: boolean) => ipcRenderer.invoke('set-auto-expand-float-ball', enabled),

  /* Claude Code CLI */
  sendToClaude: (prompt: string, permission?: string, cwd?: string) =>
    ipcRenderer.invoke('send-to-claude', prompt, permission, cwd),

  onClaudeOutput: (callback: (data: string) => void) => {
    const listener = (_event: unknown, data: string) => callback(data)
    ipcRenderer.on('claude-output', listener)
    return () => ipcRenderer.removeListener('claude-output', listener)
  },

  onClaudeError: (callback: (err: string) => void) => {
    const listener = (_event: unknown, err: string) => callback(err)
    ipcRenderer.on('claude-error', listener)
    return () => ipcRenderer.removeListener('claude-error', listener)
  },

  onClaudeClose: (callback: (code: number | null) => void) => {
    const listener = (_event: unknown, code: number | null) => callback(code)
    ipcRenderer.on('claude-close', listener)
    return () => ipcRenderer.removeListener('claude-close', listener)
  },

  onClaudeTaskStart: (callback: () => void) => {
    const listener = () => callback()
    ipcRenderer.on('claude-task-start', listener)
    return () => ipcRenderer.removeListener('claude-task-start', listener)
  },

  onClaudeConfirmNeeded: (callback: () => void) => {
    const listener = () => callback()
    ipcRenderer.on('claude-confirm-needed', listener)
    return () => ipcRenderer.removeListener('claude-confirm-needed', listener)
  },

  /* PTY 终端会话（多会话支持） */
  createPty: (sessionId: string, permission?: string, cwd?: string) =>
    ipcRenderer.invoke('create-pty', sessionId, permission, cwd),
  writePty: (sessionId: string, data: string) =>
    ipcRenderer.invoke('write-pty', sessionId, data),
  resizePty: (sessionId: string, cols: number, rows: number) =>
    ipcRenderer.invoke('resize-pty', sessionId, cols, rows),
  killPty: (sessionId: string) => ipcRenderer.invoke('kill-pty', sessionId),
  changePtyPermission: (sessionId: string, permission: string) =>
    ipcRenderer.invoke('change-pty-permission', sessionId, permission),

  onPtyData: (callback: (sessionId: string, data: string) => void) => {
    const listener = (_event: unknown, sessionId: string, data: string) =>
      callback(sessionId, data)
    ipcRenderer.on('pty-data', listener)
    return () => ipcRenderer.removeListener('pty-data', listener)
  },

  onPtyExit: (callback: (sessionId: string, code: number | null) => void) => {
    const listener = (_event: unknown, sessionId: string, code: number | null) =>
      callback(sessionId, code)
    ipcRenderer.on('pty-exit', listener)
    return () => ipcRenderer.removeListener('pty-exit', listener)
  },

  onPtyHistory: (callback: (sessionId: string, history: string) => void) => {
    const listener = (_event: unknown, sessionId: string, history: string) =>
      callback(sessionId, history)
    ipcRenderer.on('pty-history', listener)
    return () => ipcRenderer.removeListener('pty-history', listener)
  },

  /* 自动更新 */
  checkUpdate: () => ipcRenderer.invoke('check-update'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  getUpdateDownloaded: () => ipcRenderer.invoke('get-update-downloaded'),

  onUpdateStatus: (callback: (status: string) => void) => {
    const listener = (_event: unknown, status: string) => callback(status)
    ipcRenderer.on('update-status', listener)
    return () => ipcRenderer.removeListener('update-status', listener)
  },

  onUpdateProgress: (callback: (percent: number) => void) => {
    const listener = (_event: unknown, percent: number) => callback(percent)
    ipcRenderer.on('update-progress', listener)
    return () => ipcRenderer.removeListener('update-progress', listener)
  },

  onUpdateError: (callback: (err: string) => void) => {
    const listener = (_event: unknown, err: string) => callback(err)
    ipcRenderer.on('update-error', listener)
    return () => ipcRenderer.removeListener('update-error', listener)
  },

  /* ── 任务队列 ──────────────────────────────────────────── */
  enqueueTask: (conversationId: string | null, prompt: string) =>
    ipcRenderer.invoke('enqueue-task', conversationId, prompt),
  pauseTask: (taskId: number) => ipcRenderer.invoke('pause-task', taskId),
  resumeTask: (taskId: number) => ipcRenderer.invoke('resume-task', taskId),
  cancelTask: (taskId: number) => ipcRenderer.invoke('cancel-task', taskId),
  completeTask: (taskId: number, result?: string) =>
    ipcRenderer.invoke('complete-task', taskId, result),
  failTask: (taskId: number, error?: string) =>
    ipcRenderer.invoke('fail-task', taskId, error),
  deleteTask: (taskId: number) => ipcRenderer.invoke('delete-task', taskId),
  getTasks: () => ipcRenderer.invoke('get-tasks'),

  onTaskUpdated: (callback: (task: unknown) => void) => {
    const listener = (_event: unknown, task: unknown) => callback(task)
    ipcRenderer.on('task-updated', listener)
    return () => ipcRenderer.removeListener('task-updated', listener)
  },

  onTaskExecute: (callback: (payload: { taskId: number; conversationId: string | null; prompt: string }) => void) => {
    const listener = (_event: unknown, payload: { taskId: number; conversationId: string | null; prompt: string }) =>
      callback(payload)
    ipcRenderer.on('task-execute', listener)
    return () => ipcRenderer.removeListener('task-execute', listener)
  },

  onQueueStatus: (callback: (status: { total: number; active: number }) => void) => {
    const listener = (_event: unknown, status: { total: number; active: number }) => callback(status)
    ipcRenderer.on('queue-status', listener)
    return () => ipcRenderer.removeListener('queue-status', listener)
  },

  onTaskDeleted: (callback: (payload: { taskId: number }) => void) => {
    const listener = (_event: unknown, payload: { taskId: number }) => callback(payload)
    ipcRenderer.on('task-deleted', listener)
    return () => ipcRenderer.removeListener('task-deleted', listener)
  },

  killClaude: () => ipcRenderer.invoke('kill-claude'),

  /* ── SQLite 会话存储 ───────────────────────────────────── */
  createConversation: (id: string, title: string) =>
    ipcRenderer.invoke('create-conversation', id, title),
  getConversations: () => ipcRenderer.invoke('get-conversations'),
  deleteConversation: (id: string) => ipcRenderer.invoke('delete-conversation', id),
  addMessage: (conversationId: string, message: { role: string; content: string; model?: string; tokenUsage?: number }) =>
    ipcRenderer.invoke('add-message', conversationId, message),
  getMessages: (conversationId: string, limit?: number, offset?: number) =>
    ipcRenderer.invoke('get-messages', conversationId, limit, offset),

  /* ── 文件变动感知 ──────────────────────────────────────── */
  getFileChangeSummary: () => ipcRenderer.invoke('get-file-change-summary'),
  toggleFileWatcher: (enabled: boolean) => ipcRenderer.invoke('toggle-file-watcher', enabled),

  /* ── Claude Code CLI 配置读取 ──────────────────────────── */
  readClaudeConfig: () => ipcRenderer.invoke('read-claude-config')
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
