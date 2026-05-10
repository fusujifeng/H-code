import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, screen } from 'electron'
import { spawn as spawnPty } from 'node-pty'
import path from 'path'
import { generateStarIcon } from './icon-generator'

let mainWindow: BrowserWindow | null = null
let floatWindow: BrowserWindow | null = null
let tray: Tray | null = null
let globalActivePty: ReturnType<typeof spawnPty> | null = null
let pendingKillTimer: ReturnType<typeof setTimeout> | null = null

/* ── 窗口创建 ────────────────────────────────────────────── */

function createMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show()
    return
  }

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    show: false,
    backgroundColor: '#ffffff'
  })

  if (!app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('close', (e) => {
    e.preventDefault()
    mainWindow?.hide()
    floatWindow?.showInactive()
  })
}

function createFloatWindow() {
  if (floatWindow && !floatWindow.isDestroyed()) return

  const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize

  floatWindow = new BrowserWindow({
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
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  floatWindow.setIgnoreMouseEvents(false)

  if (!app.isPackaged) {
    floatWindow.loadURL('http://localhost:5173/float-ball.html')
  } else {
    floatWindow.loadFile(path.join(__dirname, '../renderer/float-ball.html'))
  }

  floatWindow.webContents.on('dom-ready', () => {
    console.log('[FloatWindow] dom-ready')
  })

  floatWindow.webContents.on('did-finish-load', () => {
    console.log('[FloatWindow] did-finish-load')
  })

  floatWindow.webContents.on('console-message', (_event, level, message) => {
    console.log(`[FloatWindow console] ${level} ${message}`)
  })

  floatWindow.on('ready-to-show', () => {
    console.log('[FloatWindow] ready-to-show')
  })

  floatWindow.on('show', () => {
    console.log('[FloatWindow] show')
  })

  floatWindow.on('hide', () => {
    console.log('[FloatWindow] hide')
  })
}

/* ── 托盘 ────────────────────────────────────────────────── */

function createTray() {
  if (tray) return

  const iconPath = path.join(app.getPath('temp'), 'claudebridge-icon.png')
  generateStarIcon(iconPath, 32)
  const icon = nativeImage.createFromPath(iconPath)
  tray = new Tray(icon)

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '打开主界面',
      click: () => {
        mainWindow?.show()
        floatWindow?.hide()
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.exit(0)
      }
    }
  ])

  tray.setToolTip('ClaudeBridge')
  tray.setContextMenu(contextMenu)

  tray.on('click', () => {
    mainWindow?.show()
    floatWindow?.hide()
  })
}

/* ── IPC ─────────────────────────────────────────────────── */

function registerIPC() {
  /* 窗口控制 */
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
    mainWindow?.hide()
    floatWindow?.showInactive()
  })

  ipcMain.handle('window-is-maximized', () => {
    return mainWindow?.isMaximized() ?? false
  })

  ipcMain.on('window-maximized-change', (_event, maximized: boolean) => {
    mainWindow?.webContents.send('window-maximized', maximized)
  })

  /* 托盘 / 悬浮球 */
  ipcMain.handle('show-main-window', () => {
    mainWindow?.show()
    floatWindow?.hide()
  })

  ipcMain.handle('quit-app', () => {
    app.exit(0)
  })

  /* 悬浮球拖拽 */
  ipcMain.handle('float-ball-move-start', () => {
    return floatWindow?.getPosition() ?? [0, 0]
  })

  ipcMain.handle('float-ball-move', (_event, x: number, y: number) => {
    floatWindow?.setPosition(x, y, true)
  })

  /* ── PTY 终端会话（给 xterm.js 用）─────────────────────── */

  ipcMain.handle('create-pty', (_event, cwd?: string) => {
    const workDir = cwd || process.cwd()
    const isWin = process.platform === 'win32'

    // 取消待执行的 kill（应对 React StrictMode 的卸载-重挂载）
    if (pendingKillTimer) {
      clearTimeout(pendingKillTimer)
      pendingKillTimer = null
      console.log('[PTY] cancelled pending kill')
    }

    // 如果已有活跃会话，直接复用
    if (globalActivePty) {
      console.log('[PTY] reusing existing session')
      return { success: true }
    }

    const shell = isWin ? 'cmd.exe' : 'claude'
    const args = isWin ? ['/c', 'claude'] : []

    console.log('[PTY] creating session:', shell, args, 'cwd:', workDir)

    globalActivePty = spawnPty(shell, args, {
      name: 'xterm-256color',
      cols: 120,
      rows: 40,
      cwd: workDir,
      env: process.env as { [key: string]: string }
    })

    console.log('[PTY] session created')

    globalActivePty.onData((data) => {
      BrowserWindow.getAllWindows().forEach((win) => {
        if (!win.isDestroyed()) {
          win.webContents.send('pty-data', data)
        }
      })
    })

    globalActivePty.onExit(({ exitCode }) => {
      console.log('[PTY] session exited, code:', exitCode)
      globalActivePty = null
      BrowserWindow.getAllWindows().forEach((win) => {
        if (!win.isDestroyed()) {
          win.webContents.send('pty-exit', exitCode)
        }
      })
    })

    return { success: true }
  })

  ipcMain.handle('write-pty', (_event, data: string) => {
    console.log('[PTY] write, exists:', !!globalActivePty, 'data:', JSON.stringify(data))
    if (!globalActivePty) {
      return { success: false, error: 'PTY session not created yet' }
    }
    globalActivePty.write(data)
    return { success: true }
  })

  ipcMain.handle('resize-pty', (_event, cols: number, rows: number) => {
    globalActivePty?.resize(cols, rows)
  })

  ipcMain.handle('kill-pty', () => {
    // 延迟 kill，给 StrictMode 重挂载留出时间
    if (pendingKillTimer) clearTimeout(pendingKillTimer)
    pendingKillTimer = setTimeout(() => {
      console.log('[PTY] delayed kill executing')
      globalActivePty?.kill()
      globalActivePty = null
      pendingKillTimer = null
    }, 1000)
  })

  /* 保留旧的 CLI 流式接口（供 InputArea 用） */
  ipcMain.handle('send-to-claude', (_event, prompt: string, cwd?: string) => {
    const workDir = cwd || process.cwd()
    const isWin = process.platform === 'win32'

    const TIMEOUT = 120000
    const timeoutId = setTimeout(() => {
      pty.kill()
      BrowserWindow.getAllWindows().forEach((win) => {
        if (!win.isDestroyed()) {
          win.webContents.send('claude-error', '\n[系统] 执行超时（120秒），已强制终止')
          win.webContents.send('claude-close', -1)
        }
      })
    }, TIMEOUT)

    const shell = isWin ? 'cmd.exe' : 'claude'
    const args = isWin ? ['/c', 'claude'] : []

    const pty = spawnPty(shell, args, {
      name: 'xterm-256color',
      cols: 120,
      rows: 40,
      cwd: workDir,
      env: process.env as { [key: string]: string }
    })

    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) win.webContents.send('claude-task-start')
    })

    setTimeout(() => {
      pty.write(prompt + '\r')
    }, isWin ? 1500 : 500)

    pty.onData((data) => {
      BrowserWindow.getAllWindows().forEach((win) => {
        if (!win.isDestroyed()) win.webContents.send('claude-output', data)
      })
    })

    pty.onExit(({ exitCode }) => {
      clearTimeout(timeoutId)
      BrowserWindow.getAllWindows().forEach((win) => {
        if (!win.isDestroyed()) win.webContents.send('claude-close', exitCode)
      })
    })

    return { success: true }
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
