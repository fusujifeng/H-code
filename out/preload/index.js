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
  hideFloatBall: () => electron.ipcRenderer.invoke("hide-float-ball"),
  showFloatBall: () => electron.ipcRenderer.invoke("show-float-ball"),
  floatBallMoveStart: () => electron.ipcRenderer.invoke("float-ball-move-start"),
  floatBallMove: (x, y) => electron.ipcRenderer.invoke("float-ball-move", x, y),
  /* Claude Code CLI */
  sendToClaude: (prompt, permission, cwd) => electron.ipcRenderer.invoke("send-to-claude", prompt, permission, cwd),
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
  /* PTY 终端会话（多会话支持） */
  createPty: (sessionId, permission, cwd) => electron.ipcRenderer.invoke("create-pty", sessionId, permission, cwd),
  writePty: (sessionId, data) => electron.ipcRenderer.invoke("write-pty", sessionId, data),
  resizePty: (sessionId, cols, rows) => electron.ipcRenderer.invoke("resize-pty", sessionId, cols, rows),
  killPty: (sessionId) => electron.ipcRenderer.invoke("kill-pty", sessionId),
  changePtyPermission: (sessionId, permission) => electron.ipcRenderer.invoke("change-pty-permission", sessionId, permission),
  onPtyData: (callback) => {
    const listener = (_event, sessionId, data) => callback(sessionId, data);
    electron.ipcRenderer.on("pty-data", listener);
    return () => electron.ipcRenderer.removeListener("pty-data", listener);
  },
  onPtyExit: (callback) => {
    const listener = (_event, sessionId, code) => callback(sessionId, code);
    electron.ipcRenderer.on("pty-exit", listener);
    return () => electron.ipcRenderer.removeListener("pty-exit", listener);
  },
  onPtyHistory: (callback) => {
    const listener = (_event, sessionId, history) => callback(sessionId, history);
    electron.ipcRenderer.on("pty-history", listener);
    return () => electron.ipcRenderer.removeListener("pty-history", listener);
  },
  /* 自动更新 */
  checkUpdate: () => electron.ipcRenderer.invoke("check-update"),
  downloadUpdate: () => electron.ipcRenderer.invoke("download-update"),
  installUpdate: () => electron.ipcRenderer.invoke("install-update"),
  getUpdateDownloaded: () => electron.ipcRenderer.invoke("get-update-downloaded"),
  onUpdateStatus: (callback) => {
    const listener = (_event, status) => callback(status);
    electron.ipcRenderer.on("update-status", listener);
    return () => electron.ipcRenderer.removeListener("update-status", listener);
  },
  onUpdateProgress: (callback) => {
    const listener = (_event, percent) => callback(percent);
    electron.ipcRenderer.on("update-progress", listener);
    return () => electron.ipcRenderer.removeListener("update-progress", listener);
  },
  onUpdateError: (callback) => {
    const listener = (_event, err) => callback(err);
    electron.ipcRenderer.on("update-error", listener);
    return () => electron.ipcRenderer.removeListener("update-error", listener);
  },
  /* ── 任务队列 ──────────────────────────────────────────── */
  enqueueTask: (conversationId, prompt) => electron.ipcRenderer.invoke("enqueue-task", conversationId, prompt),
  pauseTask: (taskId) => electron.ipcRenderer.invoke("pause-task", taskId),
  resumeTask: (taskId) => electron.ipcRenderer.invoke("resume-task", taskId),
  cancelTask: (taskId) => electron.ipcRenderer.invoke("cancel-task", taskId),
  completeTask: (taskId, result) => electron.ipcRenderer.invoke("complete-task", taskId, result),
  failTask: (taskId, error) => electron.ipcRenderer.invoke("fail-task", taskId, error),
  deleteTask: (taskId) => electron.ipcRenderer.invoke("delete-task", taskId),
  getTasks: () => electron.ipcRenderer.invoke("get-tasks"),
  onTaskUpdated: (callback) => {
    const listener = (_event, task) => callback(task);
    electron.ipcRenderer.on("task-updated", listener);
    return () => electron.ipcRenderer.removeListener("task-updated", listener);
  },
  onTaskExecute: (callback) => {
    const listener = (_event, payload) => callback(payload);
    electron.ipcRenderer.on("task-execute", listener);
    return () => electron.ipcRenderer.removeListener("task-execute", listener);
  },
  onQueueStatus: (callback) => {
    const listener = (_event, status) => callback(status);
    electron.ipcRenderer.on("queue-status", listener);
    return () => electron.ipcRenderer.removeListener("queue-status", listener);
  },
  onTaskDeleted: (callback) => {
    const listener = (_event, payload) => callback(payload);
    electron.ipcRenderer.on("task-deleted", listener);
    return () => electron.ipcRenderer.removeListener("task-deleted", listener);
  },
  killClaude: () => electron.ipcRenderer.invoke("kill-claude"),
  /* ── SQLite 会话存储 ───────────────────────────────────── */
  createConversation: (id, title) => electron.ipcRenderer.invoke("create-conversation", id, title),
  getConversations: () => electron.ipcRenderer.invoke("get-conversations"),
  deleteConversation: (id) => electron.ipcRenderer.invoke("delete-conversation", id),
  addMessage: (conversationId, message) => electron.ipcRenderer.invoke("add-message", conversationId, message),
  getMessages: (conversationId, limit, offset) => electron.ipcRenderer.invoke("get-messages", conversationId, limit, offset),
  /* ── 文件变动感知 ──────────────────────────────────────── */
  getFileChangeSummary: () => electron.ipcRenderer.invoke("get-file-change-summary"),
  toggleFileWatcher: (enabled) => electron.ipcRenderer.invoke("toggle-file-watcher", enabled),
  /* ── Claude Code CLI 配置读取 ──────────────────────────── */
  readClaudeConfig: () => electron.ipcRenderer.invoke("read-claude-config")
};
electron.contextBridge.exposeInMainWorld("electronAPI", electronAPI);
