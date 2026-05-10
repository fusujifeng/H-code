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
  floatBallMove: (x, y) => electron.ipcRenderer.invoke("float-ball-move", x, y),
  /* Claude Code CLI */
  sendToClaude: (prompt, cwd) => electron.ipcRenderer.invoke("send-to-claude", prompt, cwd),
  onClaudeOutput: (callback) => {
    const listener = (_event, data) => callback(data);
    electron.ipcRenderer.on("claude-output", listener);
    return () => electron.ipcRenderer.removeListener("claude-output", listener);
  },
  onClaudeError: (callback) => {
    const listener = (_event, err) => callback(err);
    electron.ipcRenderer.on("claude-error", listener);
    return () => electron.ipcRenderer.removeListener("claude-error", listener);
  },
  onClaudeClose: (callback) => {
    const listener = (_event, code) => callback(code);
    electron.ipcRenderer.on("claude-close", listener);
    return () => electron.ipcRenderer.removeListener("claude-close", listener);
  },
  onClaudeTaskStart: (callback) => {
    const listener = () => callback();
    electron.ipcRenderer.on("claude-task-start", listener);
    return () => electron.ipcRenderer.removeListener("claude-task-start", listener);
  },
  /* PTY 终端会话 */
  createPty: (cwd) => electron.ipcRenderer.invoke("create-pty", cwd),
  writePty: (data) => electron.ipcRenderer.invoke("write-pty", data),
  resizePty: (cols, rows) => electron.ipcRenderer.invoke("resize-pty", cols, rows),
  killPty: () => electron.ipcRenderer.invoke("kill-pty"),
  onPtyData: (callback) => {
    const listener = (_event, data) => callback(data);
    electron.ipcRenderer.on("pty-data", listener);
    return () => electron.ipcRenderer.removeListener("pty-data", listener);
  },
  onPtyExit: (callback) => {
    const listener = (_event, code) => callback(code);
    electron.ipcRenderer.on("pty-exit", listener);
    return () => electron.ipcRenderer.removeListener("pty-exit", listener);
  }
};
electron.contextBridge.exposeInMainWorld("electronAPI", electronAPI);
