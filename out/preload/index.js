"use strict";
const electron = require("electron");
const electronAPI = {
  getTheme: () => electron.ipcRenderer.invoke("get-theme"),
  setTheme: (theme) => electron.ipcRenderer.invoke("set-theme", theme),
  sendMessage: (message) => electron.ipcRenderer.invoke("send-message", message),
  getConversations: () => electron.ipcRenderer.invoke("get-conversations"),
  getMessages: (conversationId, limit, offset) => electron.ipcRenderer.invoke("get-messages", conversationId, limit, offset),
  createConversation: (title) => electron.ipcRenderer.invoke("create-conversation", title),
  deleteConversation: (id) => electron.ipcRenderer.invoke("delete-conversation", id),
  pauseTask: (taskId) => electron.ipcRenderer.invoke("pause-task", taskId),
  resumeTask: (taskId) => electron.ipcRenderer.invoke("resume-task", taskId),
  cancelTask: (taskId) => electron.ipcRenderer.invoke("cancel-task", taskId),
  getFileChangeSummary: () => electron.ipcRenderer.invoke("get-file-change-summary"),
  checkBalance: () => electron.ipcRenderer.invoke("check-balance"),
  getSettings: () => electron.ipcRenderer.invoke("get-settings"),
  updateSettings: (settings) => electron.ipcRenderer.invoke("update-settings", settings)
};
electron.contextBridge.exposeInMainWorld("electronAPI", electronAPI);
