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
  floatBallMoveStart: () => ipcRenderer.invoke('float-ball-move-start'),
  floatBallMove: (x: number, y: number) => ipcRenderer.invoke('float-ball-move', x, y),

  /* Claude Code CLI */
  sendToClaude: (prompt: string, cwd?: string) =>
    ipcRenderer.invoke('send-to-claude', prompt, cwd),

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
  }
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
