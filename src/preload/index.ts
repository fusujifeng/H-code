import { contextBridge, ipcRenderer } from 'electron'

const electronAPI = {
  getTheme: () => ipcRenderer.invoke('get-theme'),
  setTheme: (theme: string) => ipcRenderer.invoke('set-theme', theme),
  sendMessage: (message: string) => ipcRenderer.invoke('send-message', message),
  getConversations: () => ipcRenderer.invoke('get-conversations'),
  getMessages: (conversationId: string, limit?: number, offset?: number) =>
    ipcRenderer.invoke('get-messages', conversationId, limit, offset),
  createConversation: (title: string) => ipcRenderer.invoke('create-conversation', title),
  deleteConversation: (id: string) => ipcRenderer.invoke('delete-conversation', id),
  pauseTask: (taskId: number) => ipcRenderer.invoke('pause-task', taskId),
  resumeTask: (taskId: number) => ipcRenderer.invoke('resume-task', taskId),
  cancelTask: (taskId: number) => ipcRenderer.invoke('cancel-task', taskId),
  getFileChangeSummary: () => ipcRenderer.invoke('get-file-change-summary'),
  checkBalance: () => ipcRenderer.invoke('check-balance'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  updateSettings: (settings: Record<string, unknown>) =>
    ipcRenderer.invoke('update-settings', settings)
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)

export type ElectronAPI = typeof electronAPI
