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
  floatBallMove: (x: number, y: number) => ipcRenderer.invoke('float-ball-move', x, y)
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
