"use strict";
const electron = require("electron");
const nodePty = require("node-pty");
const path = require("path");
const electronUpdater = require("electron-updater");
const https = require("https");
function getIconPath() {
  if (electron.app.isPackaged) {
    return path.join(process.resourcesPath, "appIcon.png");
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
    return;
  }
  try {
    await electronUpdater.autoUpdater.checkForUpdates();
  } catch (err) {
    console.error("[Updater] check failed:", err);
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
let floatBallVisible = true;
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
      return "/permission-mode bypass\r";
    case "trust-edit":
      return "/permission-mode accept-edits\r";
    case "plan":
      return "/permission-mode plan\r";
    default:
      return "/permission-mode default\r";
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
  floatWindow = new electron.BrowserWindow({
    width: 54,
    height: 54,
    x: screenW - 74,
    y: screenH - 74,
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
  tray.setToolTip("ClaudeBridge");
  rebuildTrayMenu();
  tray.on("click", () => {
    mainWindow?.show();
    floatWindow?.hide();
  });
}
function registerIPC() {
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
    mainWindow?.show();
    floatWindow?.hide();
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
  });
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
      console.log("[PTY] reusing existing session", sessionId);
      return { success: true, sessionId };
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
    pty.onData((data) => {
      sendPtyData(sessionId, data);
    });
    pty.onExit(({ exitCode }) => {
      console.log("[PTY] session exited:", sessionId, "code:", exitCode);
      ptySessions.delete(sessionId);
      pendingKillTimers.delete(sessionId);
      sendPtyExit(sessionId, exitCode ?? -1);
    });
    return { success: true, sessionId };
  });
  electron.ipcMain.handle("write-pty", (_event, sessionId, data) => {
    console.log("[PTY] write, session:", sessionId, "data:", JSON.stringify(data));
    const pty = ptySessions.get(sessionId);
    if (!pty) {
      return { success: false, error: "PTY session not found: " + sessionId };
    }
    pty.write(data);
    return { success: true };
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
    const cmd = getPermissionSlashCommand(permission);
    console.log("[PTY] changing permission:", sessionId, permission, "→", JSON.stringify(cmd));
    pty.write(cmd);
    return { success: true };
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
    const pty = nodePty.spawn(shell, args, {
      name: "xterm-256color",
      cols: 120,
      rows: 40,
      cwd: workDir,
      env: process.env
    });
    electron.BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) win.webContents.send("claude-task-start");
    });
    setTimeout(() => {
      pty.write(prompt + "\r");
    }, isWin ? 1500 : 500);
    pty.onData((data) => {
      electron.BrowserWindow.getAllWindows().forEach((win) => {
        if (!win.isDestroyed()) win.webContents.send("claude-output", data);
      });
    });
    pty.onExit(({ exitCode }) => {
      clearTimeout(timeoutId);
      electron.BrowserWindow.getAllWindows().forEach((win) => {
        if (!win.isDestroyed()) win.webContents.send("claude-close", exitCode);
      });
    });
    return { success: true };
  });
}
electron.app.whenReady().then(() => {
  setupAutoUpdater();
  createFloatWindow();
  createTray();
  createMainWindow();
  registerIPC();
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
