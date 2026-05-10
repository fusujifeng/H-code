"use strict";
const electron = require("electron");
const electronAPI = {
  windowMinimize: () => electron.ipcRenderer.invoke("window-minimize"),
  windowMaximize: () => electron.ipcRenderer.invoke("window-maximize"),
  windowClose: () => electron.ipcRenderer.invoke("window-close"),
  windowIsMaximized: () => electron.ipcRenderer.invoke("window-is-maximized"),
  onWindowMaximized: (callback) => {
    const listener = (_event, value) => callback(value);
    electron.ipcRenderer.on("window-maximized", listener);
    return () => electron.ipcRenderer.removeListener("window-maximized", listener);
  },
  /* 托盘 / 悬浮球 */
  showMainWindow: () => electron.ipcRenderer.invoke("show-main-window"),
  quitApp: () => electron.ipcRenderer.invoke("quit-app"),
  floatBallMoveStart: () => electron.ipcRenderer.invoke("float-ball-move-start"),
  floatBallMove: (x, y) => electron.ipcRenderer.invoke("float-ball-move", x, y)
};
electron.contextBridge.exposeInMainWorld("electronAPI", electronAPI);
