"use strict";
const electron = require("electron");
const path = require("path");
const fs = require("fs");
const zlib = require("zlib");
const is = {
  dev: !electron.app.isPackaged
};
({
  isWindows: process.platform === "win32",
  isMacOS: process.platform === "darwin",
  isLinux: process.platform === "linux"
});
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
let isQuitting = false;
const iconPath = path.join(electron.app.getPath("userData"), "tray-icon.png");
generateStarIcon(iconPath, 32);
function createMainWindow() {
  mainWindow = new electron.BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 640,
    minHeight: 480,
    show: false,
    frame: false,
    titleBarStyle: "hidden",
    backgroundColor: "#f5f5f5",
    icon: electron.nativeImage.createFromPath(iconPath),
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.on("ready-to-show", () => {
    mainWindow?.show();
    floatWindow?.hide();
  });
  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
      floatWindow?.show();
    }
  });
  mainWindow.on("maximize", () => {
    mainWindow?.webContents.send("window-maximized", true);
  });
  mainWindow.on("unmaximize", () => {
    mainWindow?.webContents.send("window-maximized", false);
  });
  mainWindow.webContents.setWindowOpenHandler((details) => {
    electron.shell.openExternal(details.url);
    return { action: "deny" };
  });
  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}
function createFloatWindow() {
  const { width, height } = electron.screen.getPrimaryDisplay().workAreaSize;
  floatWindow = new electron.BrowserWindow({
    width: 54,
    height: 54,
    x: width - 74,
    y: height - 134,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  floatWindow.setIgnoreMouseEvents(false);
  const baseUrl = process.env["ELECTRON_RENDERER_URL"] || "";
  const url = is.dev && baseUrl ? new URL("float-ball.html", baseUrl).href : path.join(__dirname, "../renderer/float-ball.html");
  console.log("[FloatWindow] loading URL:", url);
  floatWindow.webContents.on("did-finish-load", () => {
    console.log("[FloatWindow] did-finish-load");
  });
  floatWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription) => {
    console.log("[FloatWindow] did-fail-load:", errorCode, errorDescription);
  });
  floatWindow.on("ready-to-show", () => {
    console.log("[FloatWindow] ready-to-show");
  });
  floatWindow.webContents.on("dom-ready", () => {
    console.log("[FloatWindow] dom-ready");
  });
  floatWindow.webContents.on("console-message", (_event, level, message) => {
    console.log("[FloatWindow console]", level, message);
  });
  if (typeof url === "string" && url.startsWith("http")) {
    floatWindow.loadURL(url);
  } else {
    floatWindow.loadFile(url);
  }
}
function createTray() {
  const icon = electron.nativeImage.createFromPath(iconPath);
  tray = new electron.Tray(icon.resize({ width: 16, height: 16 }));
  tray.setToolTip("ClaudeBridge");
  tray.on("click", () => showMainWindow());
  tray.on("double-click", () => showMainWindow());
  const contextMenu = electron.Menu.buildFromTemplate([
    { label: "打开主界面", click: () => showMainWindow() },
    { type: "separator" },
    { label: "退出", click: () => quitApp() }
  ]);
  tray.setContextMenu(contextMenu);
}
function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createMainWindow();
  }
  mainWindow?.show();
  mainWindow?.restore();
  mainWindow?.focus();
  floatWindow?.hide();
}
function quitApp() {
  isQuitting = true;
  tray?.destroy();
  floatWindow?.destroy();
  mainWindow?.destroy();
  tray = null;
  floatWindow = null;
  mainWindow = null;
  electron.app.quit();
}
function registerIPC() {
  electron.ipcMain.handle("get-theme", () => null);
  electron.ipcMain.handle("set-theme", (_event, theme) => {
    return { success: true, theme };
  });
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
    console.log("[IPC] window-close called");
    mainWindow?.hide();
    floatWindow?.show();
    floatWindow?.setAlwaysOnTop(true, "screen-saver");
  });
  electron.ipcMain.handle("window-is-maximized", () => {
    return mainWindow?.isMaximized() ?? false;
  });
  electron.ipcMain.handle("show-main-window", () => showMainWindow());
  electron.ipcMain.handle("quit-app", () => quitApp());
  electron.ipcMain.handle("float-ball-move-start", () => {
    return floatWindow?.getPosition() ?? [0, 0];
  });
  electron.ipcMain.handle("float-ball-move", (_event, x, y) => {
    floatWindow?.setPosition(Math.round(x), Math.round(y));
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
