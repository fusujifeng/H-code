"use strict";
const electron = require("electron");
const nodePty = require("node-pty");
const path = require("path");
const fs = require("fs");
const zlib = require("zlib");
const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 3988292384 ^ c >>> 1 : c >>> 1;
    }
    t[i] = c;
  }
  return t;
})();
function crc32(buf) {
  let crc = 4294967295;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 255] ^ crc >>> 8;
  }
  return (crc ^ 4294967295) >>> 0;
}
function chunk(type, data) {
  const t = Buffer.from(type, "ascii");
  const c = Buffer.alloc(4);
  c.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  const l = Buffer.alloc(4);
  l.writeUInt32BE(data.length, 0);
  return Buffer.concat([l, t, data, c]);
}
function mod(a, b) {
  return (a % b + b) % b;
}
function pointInSparkle(px, py, cx, cy, maxDist) {
  const dx = px - cx;
  const dy = py - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist <= maxDist * 0.22) return true;
  if (dist > maxDist) return false;
  const angle = Math.atan2(dy, dx);
  const normalized = Math.abs(mod(angle + Math.PI / 4, Math.PI / 2) - Math.PI / 4);
  const maxWidth = 0.35 - 0.18 * (dist / maxDist);
  return normalized < maxWidth;
}
function generateStarIcon(path$1, size = 32) {
  if (fs.existsSync(path$1)) {
    try {
      fs.unlinkSync(path$1);
    } catch {
    }
  }
  fs.mkdirSync(path.dirname(path$1), { recursive: true });
  const cx = size / 2;
  const cy = size / 2;
  const circleR = size * 0.46;
  const starMaxDist = size * 0.4;
  const rowSize = 1 + size * 4;
  const raw = Buffer.alloc(size * rowSize);
  for (let y = 0; y < size; y++) {
    raw[y * rowSize] = 0;
    for (let x = 0; x < size; x++) {
      const off = y * rowSize + 1 + x * 4;
      const dist = Math.sqrt((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2);
      if (dist <= circleR) {
        raw[off] = 255;
        raw[off + 1] = 255;
        raw[off + 2] = 255;
        raw[off + 3] = 255;
      }
      if (pointInSparkle(x + 0.5, y + 0.5, cx, cy, starMaxDist)) {
        raw[off] = 245;
        raw[off + 1] = 166;
        raw[off + 2] = 35;
        raw[off + 3] = 255;
      }
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const png = Buffer.concat([
    PNG_SIG,
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
  fs.writeFileSync(path$1, png);
}
let mainWindow = null;
let floatWindow = null;
let tray = null;
let globalActivePty = null;
let pendingKillTimer = null;
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
function createTray() {
  if (tray) return;
  const iconPath = path.join(electron.app.getPath("temp"), "claudebridge-icon.png");
  generateStarIcon(iconPath, 32);
  const icon = electron.nativeImage.createFromPath(iconPath);
  tray = new electron.Tray(icon);
  const contextMenu = electron.Menu.buildFromTemplate([
    {
      label: "打开主界面",
      click: () => {
        mainWindow?.show();
        floatWindow?.hide();
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
  tray.setToolTip("ClaudeBridge");
  tray.setContextMenu(contextMenu);
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
  electron.ipcMain.handle("float-ball-move-start", () => {
    return floatWindow?.getPosition() ?? [0, 0];
  });
  electron.ipcMain.handle("float-ball-move", (_event, x, y) => {
    floatWindow?.setPosition(x, y, true);
  });
  electron.ipcMain.handle("create-pty", (_event, cwd) => {
    const workDir = cwd || process.cwd();
    const isWin = process.platform === "win32";
    if (pendingKillTimer) {
      clearTimeout(pendingKillTimer);
      pendingKillTimer = null;
      console.log("[PTY] cancelled pending kill");
    }
    if (globalActivePty) {
      console.log("[PTY] reusing existing session");
      return { success: true };
    }
    const shell = isWin ? "cmd.exe" : "claude";
    const args = isWin ? ["/c", "claude"] : [];
    console.log("[PTY] creating session:", shell, args, "cwd:", workDir);
    globalActivePty = nodePty.spawn(shell, args, {
      name: "xterm-256color",
      cols: 120,
      rows: 40,
      cwd: workDir,
      env: process.env
    });
    console.log("[PTY] session created");
    globalActivePty.onData((data) => {
      electron.BrowserWindow.getAllWindows().forEach((win) => {
        if (!win.isDestroyed()) {
          win.webContents.send("pty-data", data);
        }
      });
    });
    globalActivePty.onExit(({ exitCode }) => {
      console.log("[PTY] session exited, code:", exitCode);
      globalActivePty = null;
      electron.BrowserWindow.getAllWindows().forEach((win) => {
        if (!win.isDestroyed()) {
          win.webContents.send("pty-exit", exitCode);
        }
      });
    });
    return { success: true };
  });
  electron.ipcMain.handle("write-pty", (_event, data) => {
    console.log("[PTY] write, exists:", !!globalActivePty, "data:", JSON.stringify(data));
    if (!globalActivePty) {
      return { success: false, error: "PTY session not created yet" };
    }
    globalActivePty.write(data);
    return { success: true };
  });
  electron.ipcMain.handle("resize-pty", (_event, cols, rows) => {
    globalActivePty?.resize(cols, rows);
  });
  electron.ipcMain.handle("kill-pty", () => {
    if (pendingKillTimer) clearTimeout(pendingKillTimer);
    pendingKillTimer = setTimeout(() => {
      console.log("[PTY] delayed kill executing");
      globalActivePty?.kill();
      globalActivePty = null;
      pendingKillTimer = null;
    }, 1e3);
  });
  electron.ipcMain.handle("send-to-claude", (_event, prompt, cwd) => {
    const workDir = cwd || process.cwd();
    const isWin = process.platform === "win32";
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
    const args = isWin ? ["/c", "claude"] : [];
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
  createFloatWindow();
  createTray();
  createMainWindow();
  registerIPC();
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});
electron.app.on("window-all-closed", () => {
});
