"use strict";
const electron = require("electron");
const nodePty = require("node-pty");
const path = require("path");
const fs = require("fs");
const os = require("os");
const child_process = require("child_process");
const electronUpdater = require("electron-updater");
const https = require("https");
const Database = require("better-sqlite3");
const chokidar = require("chokidar");
class SessionStore {
  db;
  constructor() {
    const dbPath = electron.app.isPackaged ? path.join(electron.app.getPath("userData"), "h-code.db") : path.join(process.cwd(), "h-code.db");
    this.db = new Database(dbPath);
    this.initTables();
  }
  initTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id TEXT NOT NULL REFERENCES conversations(id),
        role TEXT NOT NULL CHECK(role IN ('user','assistant','system')),
        content TEXT NOT NULL,
        model TEXT,
        token_usage INTEGER,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id TEXT,
        status TEXT NOT NULL CHECK(status IN ('queued','running','paused','completed','failed','cancelled')),
        pipeline_config TEXT,
        result TEXT,
        prompt TEXT NOT NULL DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        finished_at DATETIME
      );

      CREATE TABLE IF NOT EXISTS snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER REFERENCES tasks(id),
        file_path TEXT NOT NULL,
        snapshot_path TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }
  createConversation(id, title) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const stmt = this.db.prepare(
      "INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)"
    );
    stmt.run(id, title, now, now);
    return { id, title, createdAt: now, updatedAt: now };
  }
  getAllConversations() {
    const stmt = this.db.prepare(
      "SELECT id, title, created_at as createdAt, updated_at as updatedAt FROM conversations ORDER BY updated_at DESC"
    );
    return stmt.all();
  }
  updateConversationTime(id) {
    const stmt = this.db.prepare("UPDATE conversations SET updated_at = ? WHERE id = ?");
    stmt.run((/* @__PURE__ */ new Date()).toISOString(), id);
  }
  deleteConversation(id) {
    this.db.prepare("DELETE FROM messages WHERE conversation_id = ?").run(id);
    this.db.prepare("DELETE FROM tasks WHERE conversation_id = ?").run(id);
    this.db.prepare("DELETE FROM conversations WHERE id = ?").run(id);
  }
  addMessage(conversationId, message) {
    const stmt = this.db.prepare(
      "INSERT INTO messages (conversation_id, role, content, model, token_usage) VALUES (?, ?, ?, ?, ?)"
    );
    const result = stmt.run(
      conversationId,
      message.role,
      message.content,
      message.model ?? null,
      message.tokenUsage ?? null
    );
    this.updateConversationTime(conversationId);
    return {
      id: result.lastInsertRowid,
      conversationId,
      role: message.role,
      content: message.content,
      model: message.model,
      tokenUsage: message.tokenUsage,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  getMessages(conversationId, limit, offset) {
    let sql = "SELECT id, conversation_id as conversationId, role, content, model, token_usage as tokenUsage, timestamp FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC";
    const params = [conversationId];
    if (limit !== void 0) {
      sql += " LIMIT ?";
      params.push(limit);
      if (offset !== void 0) {
        sql += " OFFSET ?";
        params.push(offset);
      }
    }
    const stmt = this.db.prepare(sql);
    return stmt.all(...params);
  }
  createTask(conversationId, prompt, pipelineConfig) {
    const stmt = this.db.prepare(
      "INSERT INTO tasks (conversation_id, status, pipeline_config, prompt) VALUES (?, ?, ?, ?)"
    );
    const result = stmt.run(
      conversationId,
      "queued",
      pipelineConfig ? JSON.stringify(pipelineConfig) : null,
      prompt
    );
    return {
      id: result.lastInsertRowid,
      conversationId,
      status: "queued",
      pipelineConfig: pipelineConfig ? JSON.stringify(pipelineConfig) : null,
      result: null,
      prompt,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      finishedAt: null
    };
  }
  getTasks() {
    const stmt = this.db.prepare(
      "SELECT id, conversation_id as conversationId, status, pipeline_config as pipelineConfig, result, prompt, created_at as createdAt, finished_at as finishedAt FROM tasks ORDER BY created_at DESC"
    );
    return stmt.all();
  }
  getTasksByConversation(conversationId) {
    const stmt = this.db.prepare(
      "SELECT id, conversation_id as conversationId, status, pipeline_config as pipelineConfig, result, prompt, created_at as createdAt, finished_at as finishedAt FROM tasks WHERE conversation_id = ? ORDER BY created_at DESC"
    );
    return stmt.all(conversationId);
  }
  updateTaskStatus(id, status, result) {
    const stmt = this.db.prepare(
      "UPDATE tasks SET status = ?, result = ?, finished_at = ? WHERE id = ?"
    );
    stmt.run(
      status,
      result ?? null,
      status === "completed" || status === "failed" || status === "cancelled" ? (/* @__PURE__ */ new Date()).toISOString() : null,
      id
    );
  }
  resetRunningTasks() {
    this.db.prepare(
      "UPDATE tasks SET status = 'queued', finished_at = NULL WHERE status = 'running'"
    ).run();
  }
  deleteTask(id) {
    this.db.prepare("DELETE FROM snapshots WHERE task_id = ?").run(id);
    this.db.prepare("DELETE FROM tasks WHERE id = ?").run(id);
  }
  createSnapshot(taskId, filePath, snapshotPath) {
    const stmt = this.db.prepare(
      "INSERT INTO snapshots (task_id, file_path, snapshot_path) VALUES (?, ?, ?)"
    );
    const result = stmt.run(taskId, filePath, snapshotPath);
    return {
      id: result.lastInsertRowid,
      taskId,
      filePath,
      snapshotPath,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  getSnapshots(taskId) {
    const stmt = this.db.prepare(
      "SELECT id, task_id as taskId, file_path as filePath, snapshot_path as snapshotPath, created_at as createdAt FROM snapshots WHERE task_id = ?"
    );
    return stmt.all(taskId);
  }
  cleanOldSnapshots(maxCount) {
    const stmt = this.db.prepare(
      "DELETE FROM snapshots WHERE id NOT IN (SELECT id FROM snapshots ORDER BY created_at DESC LIMIT ?)"
    );
    stmt.run(maxCount);
  }
  close() {
    this.db.close();
  }
}
const sessionStore = new SessionStore();
class TaskQueue {
  queue = [];
  isProcessing = false;
  currentTaskId = null;
  onTaskFinished;
  constructor() {
    this.restoreFromDb();
  }
  restoreFromDb() {
    sessionStore.resetRunningTasks();
    const dbTasks = sessionStore.getTasks();
    this.queue = dbTasks.filter(
      (t) => t.status === "queued" || t.status === "paused"
    );
    if (this.queue.length > 0) {
      this.broadcastQueueStatus();
      this.process();
    }
  }
  enqueue(conversationId, prompt, pipelineConfig) {
    const task = sessionStore.createTask(conversationId, prompt, pipelineConfig);
    this.queue.push(task);
    this.broadcast("task-updated", task);
    this.broadcastQueueStatus();
    this.process();
    return task;
  }
  pause(taskId) {
    const task = this.queue.find((t) => t.id === taskId);
    if (!task) return false;
    if (task.status === "running") {
      task.status = "paused";
      sessionStore.updateTaskStatus(taskId, "paused");
      this.currentTaskId = null;
      this.isProcessing = false;
      this.broadcast("task-updated", task);
      this.broadcastQueueStatus();
      this.process();
      return true;
    }
    if (task.status === "queued") {
      task.status = "paused";
      sessionStore.updateTaskStatus(taskId, "paused");
      this.broadcast("task-updated", task);
      this.broadcastQueueStatus();
      return true;
    }
    return false;
  }
  resume(taskId) {
    const task = this.queue.find((t) => t.id === taskId);
    if (!task || task.status !== "paused") return false;
    task.status = "queued";
    sessionStore.updateTaskStatus(taskId, "queued");
    this.broadcast("task-updated", task);
    this.broadcastQueueStatus();
    this.process();
    return true;
  }
  cancel(taskId) {
    const task = this.queue.find((t) => t.id === taskId);
    if (!task) return false;
    const wasRunning = task.status === "running";
    task.status = "cancelled";
    sessionStore.updateTaskStatus(taskId, "cancelled");
    if (wasRunning) {
      this.currentTaskId = null;
      this.isProcessing = false;
    }
    this.broadcast("task-updated", task);
    this.removeFromQueue(taskId);
    this.broadcastQueueStatus();
    if (wasRunning) {
      this.process();
    }
    return true;
  }
  complete(taskId, result) {
    const task = this.queue.find((t) => t.id === taskId);
    if (!task || task.status !== "running") return false;
    task.status = "completed";
    task.result = result || null;
    sessionStore.updateTaskStatus(taskId, "completed", result);
    this.currentTaskId = null;
    this.isProcessing = false;
    this.broadcast("task-updated", task);
    this.removeFromQueue(taskId);
    this.broadcastQueueStatus();
    this.onTaskFinished?.();
    this.process();
    return true;
  }
  fail(taskId, error) {
    const task = this.queue.find((t) => t.id === taskId);
    if (!task || task.status !== "running") return false;
    task.status = "failed";
    task.result = error || null;
    sessionStore.updateTaskStatus(taskId, "failed", error);
    this.currentTaskId = null;
    this.isProcessing = false;
    this.broadcast("task-updated", task);
    this.removeFromQueue(taskId);
    this.broadcastQueueStatus();
    this.onTaskFinished?.();
    this.process();
    return true;
  }
  deleteTask(taskId) {
    sessionStore.deleteTask(taskId);
    const existed = this.queue.some((t) => t.id === taskId);
    this.removeFromQueue(taskId);
    if (existed) {
      this.broadcastQueueStatus();
    }
    this.broadcast("task-deleted", { taskId });
    return true;
  }
  getTasks() {
    const dbTasks = sessionStore.getTasks();
    const merged = dbTasks.map((dbTask) => {
      const memTask = this.queue.find((q) => q.id === dbTask.id);
      return memTask || dbTask;
    });
    const memOnly = this.queue.filter((q) => !dbTasks.find((d) => d.id === q.id));
    return [...merged, ...memOnly];
  }
  getCurrentTaskId() {
    return this.currentTaskId;
  }
  removeFromQueue(taskId) {
    this.queue = this.queue.filter((t) => t.id !== taskId);
  }
  process() {
    if (this.isProcessing) return;
    const next = this.queue.find((t) => t.status === "queued");
    if (!next) return;
    this.isProcessing = true;
    this.currentTaskId = next.id;
    next.status = "running";
    sessionStore.updateTaskStatus(next.id, "running");
    this.broadcast("task-updated", next);
    this.broadcastQueueStatus();
    this.broadcast("task-execute", {
      taskId: next.id,
      conversationId: next.conversationId,
      prompt: next.prompt
    });
  }
  broadcast(channel, ...args) {
    electron.BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send(channel, ...args);
      }
    });
  }
  broadcastQueueStatus() {
    const total = this.queue.length;
    const active = this.queue.filter((t) => t.status === "running").length;
    this.broadcast("queue-status", { total, active });
  }
}
const taskQueue = new TaskQueue();
class FileWatcher {
  watcher;
  changes = [];
  options = {
    maxAgeMs: 3 * 60 * 60 * 1e3,
    // 3小时
    maxChangeCount: 10
  };
  projectPath = "";
  start(projectPath, options) {
    if (this.watcher) {
      this.watcher.close();
    }
    this.projectPath = projectPath;
    if (options) {
      this.options = { ...this.options, ...options };
    }
    this.changes = [];
    const watchPath = path.join(projectPath, "src");
    this.watcher = chokidar.watch(watchPath, {
      ignored: /(^|[\/\\])\../,
      // 忽略隐藏文件
      ignoreInitial: true,
      persistent: true,
      depth: 5
    });
    this.watcher.on("change", (filePath) => this.recordChange(filePath));
    this.watcher.on("add", (filePath) => this.recordChange(filePath));
    this.watcher.on("unlink", (filePath) => this.recordChange(filePath));
    console.log("[FileWatcher] watching", watchPath);
  }
  stop() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = void 0;
      console.log("[FileWatcher] stopped");
    }
  }
  recordChange(filePath) {
    const now = Date.now();
    this.changes = this.changes.filter((c) => now - c.timestamp < this.options.maxAgeMs);
    const existing = this.changes.find((c) => c.filePath === filePath);
    if (existing) {
      existing.timestamp = now;
    } else {
      this.changes.push({ filePath, timestamp: now });
    }
    if (this.changes.length > this.options.maxChangeCount) {
      this.changes = this.changes.slice(-this.options.maxChangeCount);
    }
  }
  getSummary() {
    if (this.changes.length === 0) return null;
    const now = Date.now();
    const recent = this.changes.filter((c) => now - c.timestamp < this.options.maxAgeMs);
    if (recent.length === 0) return null;
    const lines = recent.map((c) => {
      const relPath = path.relative(this.projectPath, c.filePath);
      const minsAgo = Math.round((now - c.timestamp) / 6e4);
      return `- ${relPath} (${minsAgo}分钟前)`;
    });
    return `【文件变动摘要】
${lines.join("\n")}`;
  }
  isWatching() {
    return !!this.watcher;
  }
}
const fileWatcher = new FileWatcher();
let currentClaudePty = null;
function getIconPath() {
  if (electron.app.isPackaged) {
    const isWin = process.platform === "win32";
    return isWin ? path.join(process.resourcesPath, "icon.ico") : path.join(process.resourcesPath, "appIcon.png");
  }
  return path.join(__dirname, "../../src/renderer/assets/appIcon.png");
}
let updateDownloaded = false;
function setupAutoUpdater() {
  electronUpdater.autoUpdater.setFeedURL({
    provider: "github",
    owner: "fusujifeng",
    repo: "H-code"
  });
  electronUpdater.autoUpdater.autoDownload = false;
  electronUpdater.autoUpdater.autoInstallOnAppQuit = false;
  electronUpdater.autoUpdater.on("update-available", () => {
    console.log("[Updater] update available, attempting silent download");
    mainWindow?.webContents.send("update-status", "available");
  });
  electronUpdater.autoUpdater.on("update-not-available", () => {
    console.log("[Updater] no update available");
    mainWindow?.webContents.send("update-status", "not-available");
  });
  electronUpdater.autoUpdater.on("download-progress", (progress) => {
    mainWindow?.webContents.send("update-progress", progress.percent);
  });
  electronUpdater.autoUpdater.on("update-downloaded", () => {
    console.log("[Updater] update downloaded");
    updateDownloaded = true;
    mainWindow?.webContents.send("update-status", "downloaded");
  });
  electronUpdater.autoUpdater.on("error", (err) => {
    console.error("[Updater] error:", err.message);
    mainWindow?.webContents.send("update-error", err.message);
  });
}
function checkGitHubReachable() {
  return new Promise((resolve) => {
    const req = https.get("https://github.com", { timeout: 1e4 }, (res) => {
      resolve(res.statusCode === 200 || res.statusCode === 301 || res.statusCode === 302);
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}
async function checkForUpdatesSilent() {
  const reachable = await checkGitHubReachable();
  if (!reachable) {
    console.log("[Updater] GitHub not reachable, skipping check");
    mainWindow?.webContents.send("update-status", "not-available");
    return;
  }
  try {
    await electronUpdater.autoUpdater.checkForUpdates();
  } catch (err) {
    console.error("[Updater] check failed:", err);
    mainWindow?.webContents.send("update-error", err?.message ?? String(err));
  }
}
async function checkForUpdatesAndNotify() {
  mainWindow?.webContents.send("update-status", "checking");
  await checkForUpdatesSilent();
}
async function downloadUpdate() {
  try {
    await electronUpdater.autoUpdater.downloadUpdate();
  } catch (err) {
    console.error("[Updater] download failed:", err);
    mainWindow?.webContents.send("update-error", String(err));
  }
}
function scheduleNextFridayCheck() {
  const now = /* @__PURE__ */ new Date();
  const target = new Date(now);
  target.setHours(10, 0, 0, 0);
  const daysUntilFriday = (5 - target.getDay() + 7) % 7;
  target.setDate(target.getDate() + daysUntilFriday);
  if (daysUntilFriday === 0 && now > target) {
    target.setDate(target.getDate() + 7);
  }
  const delay = target.getTime() - now.getTime();
  console.log("[Updater] next check scheduled at", target.toLocaleString(), "in", Math.round(delay / 36e5), "hours");
  setTimeout(() => {
    checkForUpdatesSilent();
    setInterval(checkForUpdatesSilent, 7 * 24 * 60 * 60 * 1e3);
  }, delay);
}
let mainWindow = null;
let floatWindow = null;
let tray = null;
const ptySessions = /* @__PURE__ */ new Map();
const pendingKillTimers = /* @__PURE__ */ new Map();
const ptyCreateTime = /* @__PURE__ */ new Map();
const ptyOutputHistory = /* @__PURE__ */ new Map();
let floatBallVisible = true;
let autoExpandFloatBall = false;
let pendingAutoExpandTimer = null;
const ptyConfirmBuffers = /* @__PURE__ */ new Map();
const ptyConfirmDetected = /* @__PURE__ */ new Map();
const ptyTaskDoneBuffers = /* @__PURE__ */ new Map();
let floatBallPosition = null;
function showMainWindowFn() {
  if (pendingAutoExpandTimer) {
    clearTimeout(pendingAutoExpandTimer);
    pendingAutoExpandTimer = null;
  }
  if (mainWindow?.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow?.show();
  mainWindow?.focus();
  floatWindow?.hide();
}
function scheduleAutoExpand() {
  console.log("[Main] scheduleAutoExpand called, autoExpandFloatBall:", autoExpandFloatBall);
  if (!autoExpandFloatBall) return;
  if (pendingAutoExpandTimer) {
    clearTimeout(pendingAutoExpandTimer);
  }
  pendingAutoExpandTimer = setTimeout(() => {
    pendingAutoExpandTimer = null;
    console.log("[Main] scheduleAutoExpand: timer fired, showing main window");
    showMainWindowFn();
  }, 2400);
}
function notifyTaskFinished() {
  electron.BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) {
      win.webContents.send("task-finished");
    }
  });
  scheduleAutoExpand();
}
function getPermissionFlags(mode) {
  switch (mode) {
    case "yolo":
      return ["--dangerously-skip-permissions"];
    case "trust-edit":
      return ["--permission-mode", "accept-edits"];
    case "plan":
      return ["--permission-mode", "plan"];
    default:
      return [];
  }
}
function getPermissionSlashCommand(mode) {
  switch (mode) {
    case "yolo":
      return "/permissions bypass\r";
    case "trust-edit":
      return "/permissions accept-edits\r";
    case "plan":
      return "/permissions plan\r";
    default:
      return "/permissions default\r";
  }
}
function createMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    return;
  }
  mainWindow = new electron.BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    titleBarStyle: "hidden",
    icon: getIconPath(),
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false
    },
    show: false,
    backgroundColor: "#ffffff"
  });
  if (!electron.app.isPackaged) {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
    floatWindow?.hide();
  });
  mainWindow.on("minimize", () => {
    floatWindow?.showInactive();
  });
  mainWindow.on("restore", () => {
    floatWindow?.hide();
  });
  mainWindow.on("close", (e) => {
    e.preventDefault();
    mainWindow?.hide();
    floatWindow?.showInactive();
  });
}
function createFloatWindow() {
  if (floatWindow && !floatWindow.isDestroyed()) return;
  const { width: screenW, height: screenH } = electron.screen.getPrimaryDisplay().workAreaSize;
  const defaultX = screenW - 74;
  const defaultY = Math.round((screenH - 54) / 2);
  const x = floatBallPosition?.x ?? defaultX;
  const y = floatBallPosition?.y ?? defaultY;
  floatWindow = new electron.BrowserWindow({
    width: 54,
    height: 54,
    x,
    y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: true,
    icon: getIconPath(),
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  floatWindow.setIgnoreMouseEvents(false);
  if (!electron.app.isPackaged) {
    floatWindow.loadURL("http://localhost:5173/float-ball.html");
  } else {
    floatWindow.loadFile(path.join(__dirname, "../renderer/float-ball.html"));
  }
  floatWindow.webContents.on("dom-ready", () => {
    console.log("[FloatWindow] dom-ready");
  });
  floatWindow.webContents.on("did-finish-load", () => {
    console.log("[FloatWindow] did-finish-load");
  });
  if (!electron.app.isPackaged) {
    floatWindow.webContents.openDevTools({ mode: "detach" });
  }
  floatWindow.webContents.on("console-message", (_event, level, message) => {
    console.log(`[FloatWindow console] ${level} ${message}`);
  });
  floatWindow.on("ready-to-show", () => {
    console.log("[FloatWindow] ready-to-show");
  });
  floatWindow.on("show", () => {
    console.log("[FloatWindow] show");
  });
  floatWindow.on("hide", () => {
    console.log("[FloatWindow] hide");
  });
}
function rebuildTrayMenu() {
  if (!tray) return;
  const contextMenu = electron.Menu.buildFromTemplate([
    {
      label: "打开主界面",
      click: () => {
        mainWindow?.show();
        floatWindow?.hide();
      }
    },
    {
      label: floatBallVisible ? "隐藏悬浮球" : "显示悬浮球",
      click: () => {
        if (floatBallVisible) {
          floatWindow?.hide();
          floatBallVisible = false;
        } else {
          if (floatWindow && !floatWindow.isDestroyed()) {
            floatWindow.showInactive();
          } else {
            createFloatWindow();
          }
          floatBallVisible = true;
        }
        rebuildTrayMenu();
      }
    },
    { type: "separator" },
    {
      label: "退出",
      click: () => {
        electron.app.exit(0);
      }
    }
  ]);
  tray.setContextMenu(contextMenu);
}
function createTray() {
  if (tray) return;
  const iconPath = getIconPath();
  const icon = electron.nativeImage.createFromPath(iconPath).resize({ width: 32, height: 32 });
  tray = new electron.Tray(icon);
  tray.setToolTip("H-code");
  rebuildTrayMenu();
  tray.on("click", () => {
    showMainWindowFn();
  });
}
function registerIPC() {
  taskQueue.onTaskFinished = notifyTaskFinished;
  function checkNeedConfirm(sessionId, data) {
    if (ptyConfirmDetected.get(sessionId)) return false;
    let buffer = ptyConfirmBuffers.get(sessionId) || "";
    buffer += data;
    if (buffer.length > 2e3) buffer = buffer.slice(-2e3);
    ptyConfirmBuffers.set(sessionId, buffer);
    const text = buffer.replace(/\x1b\[[0-9;]*m/g, "").replace(/\x00/g, "");
    const patterns = [
      /Allow (edit|create|delete|command)\b/i,
      /Would you like me to/i,
      /Press Enter to continue/i,
      /\(\s*Y\s*\/\s*n\s*\)/i,
      /\(\s*y\s*\/\s*N\s*\)/i
    ];
    if (patterns.some((p) => p.test(text))) {
      ptyConfirmDetected.set(sessionId, true);
      ptyConfirmBuffers.delete(sessionId);
      return true;
    }
    return false;
  }
  function checkTaskDone(sessionId, data) {
    let buffer = ptyTaskDoneBuffers.get(sessionId) || "";
    buffer += data;
    if (buffer.length > 8e3) buffer = buffer.slice(-8e3);
    ptyTaskDoneBuffers.set(sessionId, buffer);
    const text = buffer.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "").replace(/\x00/g, "");
    if (/Brewed for [\d.]+s?/i.test(text) || /Thinking for [\d.]+s?/i.test(text)) {
      console.log("[Main] checkTaskDone: time-marker detected, session:", sessionId);
      ptyTaskDoneBuffers.delete(sessionId);
      notifyTaskFinished();
      return true;
    }
    if (/[✓✔]\s*(Done|Completed|Finished)/i.test(text) || /Task completed/i.test(text)) {
      console.log("[Main] checkTaskDone: done-marker detected, session:", sessionId);
      ptyTaskDoneBuffers.delete(sessionId);
      notifyTaskFinished();
      return true;
    }
    const normalized = text.replace(/\r/g, "");
    if (/\n>\s*$/.test(normalized) || /\n>\s*\n$/.test(normalized)) {
      console.log("[Main] checkTaskDone: prompt detected, session:", sessionId);
      ptyTaskDoneBuffers.delete(sessionId);
      notifyTaskFinished();
      return true;
    }
    return false;
  }
  function broadcastClaudeConfirmNeeded() {
    electron.BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send("claude-confirm-needed");
      }
    });
  }
  electron.ipcMain.handle("window-minimize", () => {
    mainWindow?.minimize();
  });
  electron.ipcMain.handle("window-maximize", () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });
  electron.ipcMain.handle("window-close", () => {
    mainWindow?.hide();
    floatWindow?.showInactive();
  });
  electron.ipcMain.handle("window-is-maximized", () => {
    return mainWindow?.isMaximized() ?? false;
  });
  electron.ipcMain.on("window-maximized-change", (_event, maximized) => {
    mainWindow?.webContents.send("window-maximized", maximized);
  });
  electron.ipcMain.handle("show-main-window", () => {
    showMainWindowFn();
  });
  electron.ipcMain.handle("quit-app", () => {
    electron.app.exit(0);
  });
  electron.ipcMain.handle("hide-float-ball", () => {
    floatWindow?.hide();
    floatBallVisible = false;
    rebuildTrayMenu();
  });
  electron.ipcMain.handle("show-float-ball", () => {
    if (floatWindow && !floatWindow.isDestroyed()) {
      floatWindow.showInactive();
    } else {
      createFloatWindow();
    }
    floatBallVisible = true;
    rebuildTrayMenu();
  });
  electron.ipcMain.handle("show-float-ball-context-menu", () => {
    const contextMenu = electron.Menu.buildFromTemplate([
      {
        label: "显示应用",
        click: () => {
          showMainWindowFn();
        }
      },
      { type: "separator" },
      {
        label: "退出",
        click: () => {
          electron.app.exit(0);
        }
      }
    ]);
    contextMenu.popup({ window: floatWindow ?? void 0 });
  });
  electron.ipcMain.handle("set-auto-expand-float-ball", (_event, enabled) => {
    autoExpandFloatBall = enabled;
  });
  electron.ipcMain.handle("check-update", async () => {
    await checkForUpdatesAndNotify();
  });
  electron.ipcMain.handle("download-update", async () => {
    await downloadUpdate();
  });
  electron.ipcMain.handle("install-update", () => {
    updateDownloaded = false;
    setImmediate(() => electronUpdater.autoUpdater.quitAndInstall());
  });
  electron.ipcMain.handle("get-update-downloaded", () => {
    return updateDownloaded;
  });
  electron.ipcMain.handle("float-ball-move-start", () => {
    return floatWindow?.getPosition() ?? [0, 0];
  });
  electron.ipcMain.handle("float-ball-move", (_event, x, y) => {
    floatWindow?.setPosition(x, y, true);
    floatBallPosition = { x, y };
  });
  function writePtyChunks(pty, data, onDone) {
    let terminator = "";
    if (data.endsWith("\r\n")) {
      terminator = "\r\n";
      data = data.slice(0, -2);
    } else if (data.endsWith("\r")) {
      terminator = "\r";
      data = data.slice(0, -1);
    } else if (data.endsWith("\n")) {
      terminator = "\n";
      data = data.slice(0, -1);
    }
    const CHUNK_SIZE = 256;
    if (data.length <= CHUNK_SIZE) {
      pty.write(data + terminator);
      onDone?.();
      return;
    }
    let offset = 0;
    const writeNext = () => {
      const chunk = data.slice(offset, offset + CHUNK_SIZE);
      pty.write(chunk);
      offset += CHUNK_SIZE;
      if (offset < data.length) {
        setTimeout(writeNext, 10);
      } else {
        pty.write(terminator);
        onDone?.();
      }
    };
    writeNext();
  }
  function sendPtyData(sessionId, data) {
    electron.BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send("pty-data", sessionId, data);
      }
    });
  }
  function sendPtyExit(sessionId, exitCode) {
    electron.BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send("pty-exit", sessionId, exitCode);
      }
    });
  }
  electron.ipcMain.handle("create-pty", (_event, sessionId, permission, cwd) => {
    const workDir = cwd || process.cwd();
    const isWin = process.platform === "win32";
    const permFlags = getPermissionFlags(permission);
    if (pendingKillTimers.has(sessionId)) {
      clearTimeout(pendingKillTimers.get(sessionId));
      pendingKillTimers.delete(sessionId);
      console.log("[PTY] cancelled pending kill for", sessionId);
    }
    if (ptySessions.has(sessionId)) {
      console.log("[PTY] killing existing session before recreate:", sessionId);
      const oldPty = ptySessions.get(sessionId);
      setTimeout(() => oldPty?.kill(), 300);
      ptySessions.delete(sessionId);
      pendingKillTimers.delete(sessionId);
      ptyCreateTime.delete(sessionId);
      ptyOutputHistory.delete(sessionId);
    }
    const shell = isWin ? "cmd.exe" : "claude";
    const claudeCmd = ["claude", ...permFlags].join(" ");
    const args = isWin ? ["/c", claudeCmd] : permFlags;
    console.log("[PTY] creating session:", sessionId, shell, args, "cwd:", workDir);
    const pty = nodePty.spawn(shell, args, {
      name: "xterm-256color",
      cols: 120,
      rows: 40,
      cwd: workDir,
      env: process.env
    });
    ptySessions.set(sessionId, pty);
    console.log("[PTY] session created:", sessionId);
    ptyCreateTime.set(sessionId, Date.now());
    pty.onData((data) => {
      const history = ptyOutputHistory.get(sessionId) || "";
      ptyOutputHistory.set(sessionId, history + data);
      sendPtyData(sessionId, data);
      parsePlanFromOutput(sessionId, data);
      if (checkNeedConfirm(sessionId, data)) {
        broadcastClaudeConfirmNeeded();
        scheduleAutoExpand();
      }
      if (checkTaskDone(sessionId, data)) {
        scheduleAutoExpand();
      }
    });
    pty.onExit(({ exitCode }) => {
      console.log("[PTY] session exited:", sessionId, "code:", exitCode);
      ptyConfirmDetected.delete(sessionId);
      ptyConfirmBuffers.delete(sessionId);
      ptyTaskDoneBuffers.delete(sessionId);
      planDetectionState.delete(sessionId);
      const currentPty = ptySessions.get(sessionId);
      if (currentPty === pty) {
        ptySessions.delete(sessionId);
        pendingKillTimers.delete(sessionId);
        ptyCreateTime.delete(sessionId);
        ptyOutputHistory.delete(sessionId);
        sendPtyExit(sessionId, exitCode ?? -1);
        if (exitCode === 0 || exitCode === null) {
          notifyTaskFinished();
        }
      } else {
        console.log("[PTY] session already replaced, ignoring exit for", sessionId);
      }
    });
    return { success: true, sessionId };
  });
  electron.ipcMain.handle("write-pty", async (_event, sessionId, data) => {
    console.log("[PTY] write, session:", sessionId, "data length:", data.length);
    for (let attempt = 0; attempt < 3; attempt++) {
      const pty = ptySessions.get(sessionId);
      if (pty) {
        writePtyChunks(pty, data, () => {
          if (data.includes("\r") || data.includes("\n")) {
            ptyTaskDoneBuffers.delete(sessionId);
          }
        });
        return { success: true };
      }
      if (attempt < 2) {
        console.log("[PTY] session not ready, retrying in 100ms:", sessionId);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    return { success: false, error: "PTY session not found: " + sessionId };
  });
  electron.ipcMain.handle("resize-pty", (_event, sessionId, cols, rows) => {
    const pty = ptySessions.get(sessionId);
    pty?.resize(cols, rows);
  });
  electron.ipcMain.handle("kill-pty", (_event, sessionId) => {
    if (pendingKillTimers.has(sessionId)) {
      clearTimeout(pendingKillTimers.get(sessionId));
    }
    pendingKillTimers.set(sessionId, setTimeout(() => {
      console.log("[PTY] delayed kill executing:", sessionId);
      const pty = ptySessions.get(sessionId);
      pty?.kill();
      ptySessions.delete(sessionId);
      pendingKillTimers.delete(sessionId);
    }, 1e3));
  });
  electron.ipcMain.handle("change-pty-permission", (_event, sessionId, permission) => {
    const pty = ptySessions.get(sessionId);
    if (!pty) {
      return { success: false, error: "PTY session not active: " + sessionId };
    }
    const createdAt = ptyCreateTime.get(sessionId);
    if (createdAt && Date.now() - createdAt < 3e3) {
      console.log("[PTY] ignoring permission change within 3s of creation for", sessionId);
      return { success: true };
    }
    const cmd = getPermissionSlashCommand(permission);
    console.log("[PTY] changing permission:", sessionId, permission, "→", JSON.stringify(cmd));
    pty.write(cmd);
    return { success: true };
  });
  electron.ipcMain.handle("enqueue-task", (_event, conversationId, prompt) => {
    const task = taskQueue.enqueue(conversationId, prompt);
    return task;
  });
  electron.ipcMain.handle("pause-task", (_event, taskId) => {
    return taskQueue.pause(taskId);
  });
  electron.ipcMain.handle("resume-task", (_event, taskId) => {
    return taskQueue.resume(taskId);
  });
  electron.ipcMain.handle("cancel-task", (_event, taskId) => {
    return taskQueue.cancel(taskId);
  });
  electron.ipcMain.handle("complete-task", (_event, taskId, result) => {
    return taskQueue.complete(taskId, result);
  });
  electron.ipcMain.handle("fail-task", (_event, taskId, error) => {
    return taskQueue.fail(taskId, error);
  });
  electron.ipcMain.handle("delete-task", (_event, taskId) => {
    return taskQueue.deleteTask(taskId);
  });
  electron.ipcMain.handle("get-tasks", () => {
    return taskQueue.getTasks();
  });
  electron.ipcMain.handle("create-conversation", (_event, id, title) => {
    return sessionStore.createConversation(id, title);
  });
  electron.ipcMain.handle("get-conversations", () => {
    return sessionStore.getAllConversations();
  });
  electron.ipcMain.handle("delete-conversation", (_event, id) => {
    sessionStore.deleteConversation(id);
  });
  electron.ipcMain.handle("add-message", (_event, conversationId, message) => {
    const validRole = ["user", "assistant", "system"].includes(message.role) ? message.role : "user";
    return sessionStore.addMessage(conversationId, { ...message, role: validRole });
  });
  electron.ipcMain.handle("get-messages", (_event, conversationId, limit, offset) => {
    return sessionStore.getMessages(conversationId, limit, offset);
  });
  electron.ipcMain.handle("get-file-change-summary", () => {
    return fileWatcher.getSummary();
  });
  electron.ipcMain.handle("toggle-file-watcher", (_event, enabled) => {
    if (enabled) {
      const cwd = process.cwd();
      fileWatcher.start(cwd);
    } else {
      fileWatcher.stop();
    }
  });
  electron.ipcMain.handle("kill-claude", () => {
    if (currentClaudePty) {
      currentClaudePty.kill();
    }
  });
  electron.ipcMain.handle("read-claude-config", () => {
    try {
      const configPath = path.join(os.homedir(), ".claude", "settings.json");
      if (!fs.existsSync(configPath)) return null;
      const content = fs.readFileSync(configPath, "utf-8");
      return JSON.parse(content);
    } catch (e) {
      console.error("[ClaudeConfig] read failed:", e);
      return null;
    }
  });
  electron.ipcMain.handle("get-git-changed-files", (_event, cwd) => {
    try {
      const workDir = cwd || process.cwd();
      const output = child_process.execSync("git status --porcelain", {
        cwd: workDir,
        timeout: 5e3,
        encoding: "utf-8"
      });
      const files = output.trim().split("\n").filter(Boolean).map((line) => {
        const status = line.slice(0, 2).trim();
        const filePath = line.slice(3).trim();
        let changeType = "modified";
        if (status === "??" || status === "A" || status === "AM") changeType = "added";
        else if (status === "D" || status === "AD") changeType = "deleted";
        else if (status === "M" || status === "MM" || status.startsWith("R")) changeType = "modified";
        return { filePath, changeType, status };
      });
      return { success: true, files, cwd: workDir };
    } catch (e) {
      console.error("[Git] get-git-changed-files failed:", e.message);
      return { success: false, files: [], error: e.message };
    }
  });
  electron.ipcMain.handle("get-git-diff", (_event, filePath, cwd) => {
    try {
      const workDir = cwd || process.cwd();
      let output = "";
      try {
        output = child_process.execSync(`git diff HEAD -- "${filePath}"`, {
          cwd: workDir,
          timeout: 5e3,
          encoding: "utf-8"
        });
      } catch {
        output = child_process.execSync(`git diff -- "${filePath}"`, {
          cwd: workDir,
          timeout: 5e3,
          encoding: "utf-8"
        });
      }
      return { success: true, diff: output, filePath };
    } catch (e) {
      console.error("[Git] get-git-diff failed:", e.message);
      return { success: false, diff: "", error: e.message };
    }
  });
  electron.ipcMain.handle("read-file-content", (_event, filePath) => {
    try {
      if (!fs.existsSync(filePath)) {
        return { success: false, content: "", error: "File not found" };
      }
      const content = fs.readFileSync(filePath, "utf-8");
      return { success: true, content };
    } catch (e) {
      return { success: false, content: "", error: e.message };
    }
  });
  const planDetectionState = /* @__PURE__ */ new Map();
  function parsePlanFromOutput(sessionId, data) {
    let state = planDetectionState.get(sessionId);
    if (!state) {
      state = { buffer: "", steps: [], detected: false };
      planDetectionState.set(sessionId, state);
    }
    if (state.detected) return;
    const clean = data.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "").replace(/\x00/g, "");
    state.buffer += clean;
    if (state.buffer.length > 2e4) state.buffer = state.buffer.slice(-2e4);
    const planHeaderPatterns = [
      /(?:Here'?s?\s*(?:is\s*)?(?:my\s*)?(?:plan|the\s*plan)|Let me (?:plan|outline|break\s*this\s*down))/i,
      /(?:任务规划|执行计划|实现步骤|Todo|Plan|Outline)/i
    ];
    const hasPlanHeader = planHeaderPatterns.some((p) => p.test(clean));
    if (hasPlanHeader || state.steps.length > 0) {
      state.detected = true;
      const stepPatterns = [
        /(?:^|\n)\s*(\d+)[\.\)、]\s*(.+)/g,
        /(?:^|\n)\s*[-*]\s*\[([ x])\]\s*(.+)/g,
        /(?:^|\n)\s*###?\s+(.+)/g
      ];
      const newSteps = [];
      let match;
      for (const pattern of stepPatterns) {
        pattern.lastIndex = 0;
        let idx = 0;
        while ((match = pattern.exec(state.buffer)) !== null) {
          const content = match[2] || match[1];
          if (content && content.trim().length > 3 && !content.includes("```")) {
            newSteps.push({
              id: `step-${idx++}`,
              content: content.trim().slice(0, 120),
              status: "pending"
            });
          }
        }
      }
      if (newSteps.length > 0) {
        state.steps = newSteps;
        electron.BrowserWindow.getAllWindows().forEach((win) => {
          if (!win.isDestroyed()) {
            win.webContents.send("plan-steps-detected", sessionId, state.steps);
          }
        });
      }
    }
  }
  electron.ipcMain.handle("detect-plan-from-output", (_event, sessionId) => {
    const state = planDetectionState.get(sessionId);
    return state?.steps || [];
  });
  electron.ipcMain.handle("reset-plan-detection", (_event, sessionId) => {
    planDetectionState.delete(sessionId);
    return true;
  });
  const planStepPtys = /* @__PURE__ */ new Map();
  const planStepOutputs = /* @__PURE__ */ new Map();
  function broadcastPlanStepOutput(stepId, data) {
    electron.BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send("plan-step-output", stepId, data);
      }
    });
  }
  function broadcastPlanStepComplete(stepId, exitCode, result) {
    electron.BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send("plan-step-complete", stepId, exitCode, result);
      }
    });
  }
  electron.ipcMain.handle("execute-plan-step", (_event, stepId, stepContent, planContext, cwd) => {
    const workDir = cwd || process.cwd();
    const isWin = process.platform === "win32";
    const oldPty = planStepPtys.get(stepId);
    if (oldPty) {
      oldPty.kill();
      planStepPtys.delete(stepId);
    }
    const subAgentPrompt = [
      "你是一个子 Agent，负责执行大型任务计划中的单个步骤。",
      "",
      "## 原始任务",
      planContext,
      "",
      "## 你的任务步骤",
      stepContent,
      "",
      "## 要求",
      "1. 只专注于执行上述步骤，不要偏离",
      "2. 完成步骤后，简要总结你的执行结果",
      "3. 如果步骤产生文件变更，请列出变更的文件路径"
    ].join("\n");
    const shell = isWin ? "cmd.exe" : "claude";
    const args = isWin ? ["/c", "claude"] : [];
    const pty = nodePty.spawn(shell, args, {
      name: "xterm-256color",
      cols: 120,
      rows: 40,
      cwd: workDir,
      env: process.env
    });
    planStepPtys.set(stepId, pty);
    planStepOutputs.set(stepId, "");
    setTimeout(() => {
      writePtyChunks(pty, subAgentPrompt + "\r");
    }, isWin ? 1500 : 500);
    pty.onData((data) => {
      const current = planStepOutputs.get(stepId) || "";
      planStepOutputs.set(stepId, current + data);
      broadcastPlanStepOutput(stepId, data);
    });
    pty.onExit(({ exitCode }) => {
      const result = planStepOutputs.get(stepId) || "";
      broadcastPlanStepComplete(stepId, exitCode ?? -1, result);
      planStepPtys.delete(stepId);
      planStepOutputs.delete(stepId);
    });
    return { success: true, stepId };
  });
  electron.ipcMain.handle("cancel-plan-step", (_event, stepId) => {
    const pty = planStepPtys.get(stepId);
    if (pty) {
      pty.kill();
      planStepPtys.delete(stepId);
      planStepOutputs.delete(stepId);
      return { success: true };
    }
    return { success: false, error: "No running PTY for step: " + stepId };
  });
  electron.ipcMain.handle("review-plan-steps", (_event, stepsJson, planContext, cwd) => {
    const workDir = cwd || process.cwd();
    const isWin = process.platform === "win32";
    const steps = JSON.parse(stepsJson);
    const stepsSummary = steps.map((s, i) => {
      const statusLabel = s.status === "completed" ? "✓ 已完成" : s.status === "failed" ? "✗ 失败" : "○ 未执行";
      const result = s.result ? `
   结果: ${s.result.slice(0, 500)}` : "";
      return `${i + 1}. ${statusLabel} ${s.content}${result}`;
    }).join("\n");
    const reviewPrompt = [
      "你是一个审查 Agent，负责检查已完成的子任务执行结果。",
      "",
      "## 原始任务",
      planContext,
      "",
      "## 已完成的步骤",
      stepsSummary,
      "",
      "## 要求",
      "1. 检查各步骤之间的 consistency（一致性）",
      "2. 确认所有步骤都正确完成",
      "3. 如果发现问题，请明确指出并提供修复方案",
      "4. 如果一切正常，请输出「审查通过」"
    ].join("\n");
    const reviewPtyId = "review-agent";
    const oldPty = planStepPtys.get(reviewPtyId);
    if (oldPty) {
      oldPty.kill();
      planStepPtys.delete(reviewPtyId);
    }
    const shell = isWin ? "cmd.exe" : "claude";
    const args = isWin ? ["/c", "claude"] : [];
    const pty = nodePty.spawn(shell, args, {
      name: "xterm-256color",
      cols: 120,
      rows: 40,
      cwd: workDir,
      env: process.env
    });
    planStepPtys.set(reviewPtyId, pty);
    planStepOutputs.set(reviewPtyId, "");
    setTimeout(() => {
      writePtyChunks(pty, reviewPrompt + "\r");
    }, isWin ? 1500 : 500);
    pty.onData((data) => {
      const current = planStepOutputs.get(reviewPtyId) || "";
      planStepOutputs.set(reviewPtyId, current + data);
      broadcastPlanStepOutput(reviewPtyId, data);
    });
    pty.onExit(({ exitCode }) => {
      const result = planStepOutputs.get(reviewPtyId) || "";
      broadcastPlanStepComplete(reviewPtyId, exitCode ?? -1, result);
      planStepPtys.delete(reviewPtyId);
      planStepOutputs.delete(reviewPtyId);
    });
    return { success: true, stepId: reviewPtyId };
  });
  electron.ipcMain.handle("send-to-claude", (_event, prompt, permission, cwd) => {
    const workDir = cwd || process.cwd();
    const isWin = process.platform === "win32";
    const permFlags = getPermissionFlags(permission);
    const TIMEOUT = 12e4;
    const timeoutId = setTimeout(() => {
      pty.kill();
      electron.BrowserWindow.getAllWindows().forEach((win) => {
        if (!win.isDestroyed()) {
          win.webContents.send("claude-error", "\n[系统] 执行超时（120秒），已强制终止");
          win.webContents.send("claude-close", -1);
        }
      });
    }, TIMEOUT);
    const shell = isWin ? "cmd.exe" : "claude";
    const claudeCmd = ["claude", ...permFlags].join(" ");
    const args = isWin ? ["/c", claudeCmd] : permFlags;
    if (currentClaudePty) {
      currentClaudePty.kill();
      currentClaudePty = null;
    }
    const pty = nodePty.spawn(shell, args, {
      name: "xterm-256color",
      cols: 120,
      rows: 40,
      cwd: workDir,
      env: process.env
    });
    currentClaudePty = pty;
    ptyConfirmDetected.set("legacy", false);
    ptyConfirmBuffers.set("legacy", "");
    console.log("[Main] sending claude-task-start to", electron.BrowserWindow.getAllWindows().length, "windows");
    electron.BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        console.log("[Main] sending claude-task-start to window", win.id);
        win.webContents.send("claude-task-start");
      }
    });
    setTimeout(() => {
      writePtyChunks(pty, prompt + "\r");
    }, isWin ? 1500 : 500);
    pty.onData((data) => {
      electron.BrowserWindow.getAllWindows().forEach((win) => {
        if (!win.isDestroyed()) win.webContents.send("claude-output", data);
      });
      parsePlanFromOutput("legacy", data);
      if (checkNeedConfirm("legacy", data)) {
        broadcastClaudeConfirmNeeded();
        scheduleAutoExpand();
      }
    });
    pty.onExit(({ exitCode }) => {
      clearTimeout(timeoutId);
      if (currentClaudePty === pty) {
        currentClaudePty = null;
      }
      ptyConfirmDetected.delete("legacy");
      ptyConfirmBuffers.delete("legacy");
      console.log("[Main] sending claude-close", exitCode, "to", electron.BrowserWindow.getAllWindows().length, "windows");
      electron.BrowserWindow.getAllWindows().forEach((win) => {
        if (!win.isDestroyed()) {
          console.log("[Main] sending claude-close to window", win.id);
          win.webContents.send("claude-close", exitCode);
        }
      });
      if (exitCode === 0 || exitCode === null) {
        notifyTaskFinished();
      }
    });
    return { success: true };
  });
}
electron.app.whenReady().then(() => {
  setupAutoUpdater();
  createFloatWindow();
  createTray();
  registerIPC();
  createMainWindow();
  setTimeout(() => checkForUpdatesSilent(), 3e4);
  scheduleNextFridayCheck();
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});
electron.app.on("window-all-closed", () => {
});
