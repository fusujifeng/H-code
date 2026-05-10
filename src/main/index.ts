import { app, BrowserWindow, shell, ipcMain, Tray, Menu, nativeImage, screen } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { generateStarIcon } from './icon-generator'

/* ── state ───────────────────────────────────────────────── */

let mainWindow: BrowserWindow | null = null
let floatWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false

const iconPath = join(app.getPath('userData'), 'tray-icon.png')
generateStarIcon(iconPath, 32)

/* ── main window ─────────────────────────────────────────── */

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 640,
    minHeight: 480,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#f5f5f5',
    icon: nativeImage.createFromPath(iconPath),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
    floatWindow?.hide()
  })

  // 拦截关闭 → 隐藏主窗口，显示悬浮球
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      mainWindow?.hide()
      floatWindow?.show()
    }
  })

  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('window-maximized', true)
  })

  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('window-maximized', false)
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // load
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

/* ── float ball window ───────────────────────────────────── */

function createFloatWindow(): void {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  floatWindow = new BrowserWindow({
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
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // 禁止 electron 自动裁剪透明区域导致鼠标事件丢失
  floatWindow.setIgnoreMouseEvents(false)

  const baseUrl = process.env['ELECTRON_RENDERER_URL'] || ''
  const url = is.dev && baseUrl
    ? new URL('float-ball.html', baseUrl).href
    : join(__dirname, '../renderer/float-ball.html')

  console.log('[FloatWindow] loading URL:', url)

  floatWindow.webContents.on('did-finish-load', () => {
    console.log('[FloatWindow] did-finish-load')
  })
  floatWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.log('[FloatWindow] did-fail-load:', errorCode, errorDescription)
  })
  floatWindow.on('ready-to-show', () => {
    console.log('[FloatWindow] ready-to-show')
  })
  floatWindow.webContents.on('dom-ready', () => {
    console.log('[FloatWindow] dom-ready')
  })
  floatWindow.webContents.on('console-message', (_event, level, message) => {
    console.log('[FloatWindow console]', level, message)
  })

  if (typeof url === 'string' && url.startsWith('http')) {
    floatWindow.loadURL(url)
  } else {
    floatWindow.loadFile(url as string)
  }
}

/* ── system tray ─────────────────────────────────────────── */

function createTray(): void {
  const icon = nativeImage.createFromPath(iconPath)
  tray = new Tray(icon.resize({ width: 16, height: 16 }))
  tray.setToolTip('ClaudeBridge')

  tray.on('click', () => showMainWindow())
  tray.on('double-click', () => showMainWindow())

  const contextMenu = Menu.buildFromTemplate([
    { label: '打开主界面', click: () => showMainWindow() },
    { type: 'separator' },
    { label: '退出', click: () => quitApp() }
  ])
  tray.setContextMenu(contextMenu)
}

/* ── helpers ─────────────────────────────────────────────── */

function showMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createMainWindow()
  }
  mainWindow?.show()
  mainWindow?.restore()
  mainWindow?.focus()
  floatWindow?.hide()
}

function quitApp(): void {
  isQuitting = true
  tray?.destroy()
  floatWindow?.destroy()
  mainWindow?.destroy()
  tray = null
  floatWindow = null
  mainWindow = null
  app.quit()
}

/* ── IPC ─────────────────────────────────────────────────── */

function registerIPC(): void {
  ipcMain.handle('get-theme', () => null)

  ipcMain.handle('set-theme', (_event, theme: string) => {
    return { success: true, theme }
  })

  ipcMain.handle('window-minimize', () => {
    mainWindow?.minimize()
  })

  ipcMain.handle('window-maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize()
    } else {
      mainWindow?.maximize()
    }
  })

  ipcMain.handle('window-close', () => {
    console.log('[IPC] window-close called')
    mainWindow?.hide()
    floatWindow?.show()
    floatWindow?.setAlwaysOnTop(true, 'screen-saver')
  })

  ipcMain.handle('window-is-maximized', () => {
    return mainWindow?.isMaximized() ?? false
  })

  ipcMain.handle('show-main-window', () => showMainWindow())
  ipcMain.handle('quit-app', () => quitApp())

  ipcMain.handle('float-ball-move-start', () => {
    return floatWindow?.getPosition() ?? [0, 0]
  })

  ipcMain.handle('float-ball-move', (_event, x: number, y: number) => {
    floatWindow?.setPosition(Math.round(x), Math.round(y))
  })
}

/* ── lifecycle ───────────────────────────────────────────── */

app.whenReady().then(() => {
  createFloatWindow()
  createTray()
  createMainWindow()
  registerIPC()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  // 不退出，托盘与悬浮球保持后台运行
})
