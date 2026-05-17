import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, screen, dialog } from 'electron'
import { spawn as spawnPty } from 'node-pty'
import path from 'path'
import fs from 'fs'
import os from 'os'
import { autoUpdater } from 'electron-updater'
import https from 'https'
import { sessionStore } from './session-store'
import { taskQueue } from './task-queue'
import { fileWatcher } from './file-watcher'
import { snapshotManager } from './snapshot-manager'

let currentClaudePty: ReturnType<typeof spawnPty> | null = null

function getIconPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'appIcon.png')
  }
  return path.join(__dirname, '../../src/renderer/assets/appIcon.png')
}

/* ── 自动更新 ──────────────────────────────────────────────── */

let updateDownloaded = false

function setupAutoUpdater() {
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'fusujifeng',
    repo: 'H-code'
  })

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false

  autoUpdater.on('update-available', () => {
    console.log('[Updater] update available, attempting silent download')
    mainWindow?.webContents.send('update-status', 'available')
  })

  autoUpdater.on('update-not-available', () => {
    console.log('[Updater] no update available')
    mainWindow?.webContents.send('update-status', 'not-available')
  })

  autoUpdater.on('download-progress', (progress) => {
    mainWindow?.webContents.send('update-progress', progress.percent)
  })

  autoUpdater.on('update-downloaded', () => {
    console.log('[Updater] update downloaded')
    updateDownloaded = true
    mainWindow?.webContents.send('update-status', 'downloaded')
  })

  autoUpdater.on('error', (err) => {
    console.error('[Updater] error:', err.message)
    mainWindow?.webContents.send('update-error', err.message)
  })
}

function checkGitHubReachable(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = https.get('https://github.com', { timeout: 10000 }, (res) => {
      resolve(res.statusCode === 200 || res.statusCode === 301 || res.statusCode === 302)
    })
    req.on('error', () => resolve(false))
    req.on('timeout', () => {
      req.destroy()
      resolve(false)
    })
  })
}

async function checkForUpdatesSilent() {
  const reachable = await checkGitHubReachable()
  if (!reachable) {
    console.log('[Updater] GitHub not reachable, skipping check')
    mainWindow?.webContents.send('update-status', 'not-available')
    return
  }
  try {
    await autoUpdater.checkForUpdates()
  } catch (err: any) {
    console.error('[Updater] check failed:', err)
    mainWindow?.webContents.send('update-error', err?.message ?? String(err))
  }
}

async function checkForUpdatesAndNotify() {
  mainWindow?.webContents.send('update-status', 'checking')
  await checkForUpdatesSilent()
}

async function downloadUpdate() {
  try {
    await autoUpdater.downloadUpdate()
  } catch (err) {
    console.error('[Updater] download failed:', err)
    mainWindow?.webContents.send('update-error', String(err))
  }
}

function scheduleNextFridayCheck() {
  const now = new Date()
  // 周五 = 5, 北京时间 10:00
  const target = new Date(now)
  target.setHours(10, 0, 0, 0)
  // 找到下一个周五
  const daysUntilFriday = (5 - target.getDay() + 7) % 7
  target.setDate(target.getDate() + daysUntilFriday)
  // 如果今天就是周五但已经过了 10:00，则移到下周五
  if (daysUntilFriday === 0 && now > target) {
    target.setDate(target.getDate() + 7)
  }
  const delay = target.getTime() - now.getTime()
  console.log('[Updater] next check scheduled at', target.toLocaleString(), 'in', Math.round(delay / 3600000), 'hours')

  setTimeout(() => {
    checkForUpdatesSilent()
    // 之后每周检查一次
    setInterval(checkForUpdatesSilent, 7 * 24 * 60 * 60 * 1000)
  }, delay)
}

let mainWindow: BrowserWindow | null = null
let floatWindow: BrowserWindow | null = null
let tray: Tray | null = null
const ptySessions = new Map<string, ReturnType<typeof spawnPty>>()
const pendingKillTimers = new Map<string, ReturnType<typeof setTimeout>>()
const ptyCreateTime = new Map<string, number>()
const ptyOutputHistory = new Map<string, string>()
let floatBallVisible = true
let autoExpandFloatBall = false
let pendingAutoExpandTimer: ReturnType<typeof setTimeout> | null = null
const ptyConfirmBuffers = new Map<string, string>()
const ptyConfirmDetected = new Map<string, boolean>()
const ptyTaskDoneBuffers = new Map<string, string>()
let floatBallPosition: { x: number; y: number } | null = null

function showMainWindowFn() {
  if (pendingAutoExpandTimer) {
    clearTimeout(pendingAutoExpandTimer)
    pendingAutoExpandTimer = null
  }
  mainWindow?.show()
  mainWindow?.restore()
  floatWindow?.hide()
}

function scheduleAutoExpand() {
  console.log('[Main] scheduleAutoExpand called, autoExpandFloatBall:', autoExpandFloatBall)
  if (!autoExpandFloatBall) return
  if (pendingAutoExpandTimer) {
    clearTimeout(pendingAutoExpandTimer)
  }
  pendingAutoExpandTimer = setTimeout(() => {
    pendingAutoExpandTimer = null
    console.log('[Main] scheduleAutoExpand: timer fired, showing main window')
    showMainWindowFn()
  }, 2400)
}

function notifyTaskFinished() {
  BrowserWindow.getAllWindows().forEach((win) => {
    if (!win.isDestroyed()) {
      win.webContents.send('task-finished')
    }
  })
  scheduleAutoExpand()
}

/* ── 权限映射 ────────────────────────────────────────────── */

type UIPermission = 'yolo' | 'trust-edit' | 'plan' | 'manual'

function getPermissionFlags(mode?: UIPermission): string[] {
  switch (mode) {
    case 'yolo':
      return ['--dangerously-skip-permissions']
    case 'trust-edit':
      return ['--permission-mode', 'accept-edits']
    case 'plan':
      return ['--permission-mode', 'plan']
    default:
      return []
  }
}

function getPermissionSlashCommand(mode: UIPermission): string {
  switch (mode) {
    case 'yolo':
      return '/permissions bypass\r'
    case 'trust-edit':
      return '/permissions accept-edits\r'
    case 'plan':
      return '/permissions plan\r'
    default:
      return '/permissions default\r'
  }
}

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
    icon: getIconPath(),
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
    floatWindow?.hide()
  })

  mainWindow.on('minimize', () => {
    floatWindow?.showInactive()
  })

  mainWindow.on('restore', () => {
    floatWindow?.hide()
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

  const defaultX = screenW - 74
  const defaultY = Math.round((screenH - 54) / 2)
  const x = floatBallPosition?.x ?? defaultX
  const y = floatBallPosition?.y ?? defaultY

  floatWindow = new BrowserWindow({
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

  // 开发模式下打开悬浮球窗口的 DevTools，方便调试
  if (!app.isPackaged) {
    floatWindow.webContents.openDevTools({ mode: 'detach' })
  }

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

function rebuildTrayMenu() {
  if (!tray) return

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '打开主界面',
      click: () => {
        mainWindow?.show()
        floatWindow?.hide()
      }
    },
    {
      label: floatBallVisible ? '隐藏悬浮球' : '显示悬浮球',
      click: () => {
        if (floatBallVisible) {
          floatWindow?.hide()
          floatBallVisible = false
        } else {
          if (floatWindow && !floatWindow.isDestroyed()) {
            floatWindow.showInactive()
          } else {
            createFloatWindow()
          }
          floatBallVisible = true
        }
        rebuildTrayMenu()
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

  tray.setContextMenu(contextMenu)
}

function createTray() {
  if (tray) return

  const iconPath = getIconPath()
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 32, height: 32 })
  tray = new Tray(icon)

  tray.setToolTip('H-code')
  rebuildTrayMenu()

  tray.on('click', () => {
    showMainWindowFn()
  })
}

/* ── IPC ─────────────────────────────────────────────────── */

function registerIPC() {
  taskQueue.onTaskFinished = notifyTaskFinished

  function checkNeedConfirm(sessionId: string, data: string): boolean {
    if (ptyConfirmDetected.get(sessionId)) return false

    let buffer = ptyConfirmBuffers.get(sessionId) || ''
    buffer += data
    if (buffer.length > 2000) buffer = buffer.slice(-2000)
    ptyConfirmBuffers.set(sessionId, buffer)

    const text = buffer.replace(/\x1b\[[0-9;]*m/g, '').replace(/\x00/g, '')
    const patterns = [
      /Allow (edit|create|delete|command)\b/i,
      /Would you like me to/i,
      /Press Enter to continue/i,
      /\(\s*Y\s*\/\s*n\s*\)/i,
      /\(\s*y\s*\/\s*N\s*\)/i,
    ]
    if (patterns.some(p => p.test(text))) {
      ptyConfirmDetected.set(sessionId, true)
      ptyConfirmBuffers.delete(sessionId)
      return true
    }
    return false
  }

  function checkTaskDone(sessionId: string, data: string): boolean {
    let buffer = ptyTaskDoneBuffers.get(sessionId) || ''
    buffer += data
    if (buffer.length > 8000) buffer = buffer.slice(-8000)
    ptyTaskDoneBuffers.set(sessionId, buffer)

    // 更彻底地去除 ANSI escape 序列
    const text = buffer.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '').replace(/\x00/g, '')

    // 模式1: Claude Code CLI 完成任务后输出 "Brewed for Xs" / "Thinking for Xs"
    if (/Brewed for [\d.]+s?/i.test(text) || /Thinking for [\d.]+s?/i.test(text)) {
      console.log('[Main] checkTaskDone: time-marker detected, session:', sessionId)
      ptyTaskDoneBuffers.delete(sessionId)
      notifyTaskFinished()
      return true
    }

    // 模式2: Done / Completed 标记（新版 Claude Code）
    if (/[✓✔]\s*(Done|Completed|Finished)/i.test(text) || /Task completed/i.test(text)) {
      console.log('[Main] checkTaskDone: done-marker detected, session:', sessionId)
      ptyTaskDoneBuffers.delete(sessionId)
      notifyTaskFinished()
      return true
    }

    // 模式3: 检测到回到命令提示符 (> 在空行后面)
    // 去除所有 \r 后检查末尾是否包含 \n> 或 \n>\n
    const normalized = text.replace(/\r/g, '')
    if (/\n>\s*$/.test(normalized) || /\n>\s*\n$/.test(normalized)) {
      console.log('[Main] checkTaskDone: prompt detected, session:', sessionId)
      ptyTaskDoneBuffers.delete(sessionId)
      notifyTaskFinished()
      return true
    }

    return false
  }

  function broadcastClaudeConfirmNeeded() {
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send('claude-confirm-needed')
      }
    })
  }

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
    showMainWindowFn()
  })

  ipcMain.handle('quit-app', () => {
    app.exit(0)
  })

  ipcMain.handle('hide-float-ball', () => {
    floatWindow?.hide()
    floatBallVisible = false
    rebuildTrayMenu()
  })

  ipcMain.handle('show-float-ball', () => {
    if (floatWindow && !floatWindow.isDestroyed()) {
      floatWindow.showInactive()
    } else {
      createFloatWindow()
    }
    floatBallVisible = true
    rebuildTrayMenu()
  })

  ipcMain.handle('show-float-ball-context-menu', () => {
    const contextMenu = Menu.buildFromTemplate([
      {
        label: '显示应用',
        click: () => {
          showMainWindowFn()
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
    contextMenu.popup({ window: floatWindow ?? undefined })
  })

  ipcMain.handle('set-auto-expand-float-ball', (_event, enabled: boolean) => {
    autoExpandFloatBall = enabled
  })

  /* 自动更新 */
  ipcMain.handle('check-update', async () => {
    await checkForUpdatesAndNotify()
  })

  ipcMain.handle('download-update', async () => {
    await downloadUpdate()
  })

  ipcMain.handle('install-update', () => {
    updateDownloaded = false
    setImmediate(() => autoUpdater.quitAndInstall())
  })

  ipcMain.handle('get-update-downloaded', () => {
    return updateDownloaded
  })

  /* 悬浮球拖拽 */
  ipcMain.handle('float-ball-move-start', () => {
    return floatWindow?.getPosition() ?? [0, 0]
  })

  ipcMain.handle('float-ball-move', (_event, x: number, y: number) => {
    floatWindow?.setPosition(x, y, true)
    floatBallPosition = { x, y }
  })

  /* ── PTY 辅助函数 ───────────────────────────────────────── */

  // 分块写入 PTY，避免长文本被输入缓冲区截断导致需要额外回车
  function writePtyChunks(pty: ReturnType<typeof spawnPty>, data: string, onDone?: () => void) {
    const CHUNK_SIZE = 512
    if (data.length <= CHUNK_SIZE) {
      pty.write(data)
      onDone?.()
      return
    }
    let offset = 0
    const writeNext = () => {
      const chunk = data.slice(offset, offset + CHUNK_SIZE)
      pty.write(chunk)
      offset += CHUNK_SIZE
      if (offset < data.length) {
        setTimeout(writeNext, 15)
      } else {
        onDone?.()
      }
    }
    writeNext()
  }

  /* ── PTY 终端会话（给 xterm.js 用，支持多会话）─────────── */

  function sendPtyData(sessionId: string, data: string) {
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send('pty-data', sessionId, data)
      }
    })
  }

  function sendPtyExit(sessionId: string, exitCode: number | null) {
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send('pty-exit', sessionId, exitCode)
      }
    })
  }

  ipcMain.handle('create-pty', (_event, sessionId: string, permission?: UIPermission, cwd?: string) => {
    const workDir = cwd || process.cwd()
    const isWin = process.platform === 'win32'
    const permFlags = getPermissionFlags(permission)

    if (pendingKillTimers.has(sessionId)) {
      clearTimeout(pendingKillTimers.get(sessionId))
      pendingKillTimers.delete(sessionId)
      console.log('[PTY] cancelled pending kill for', sessionId)
    }

    if (ptySessions.has(sessionId)) {
      console.log('[PTY] killing existing session before recreate:', sessionId)
      const oldPty = ptySessions.get(sessionId)
      // 延迟 kill 旧 PTY，避免 Windows 上 AttachConsole 冲突
      setTimeout(() => oldPty?.kill(), 300)
      ptySessions.delete(sessionId)
      pendingKillTimers.delete(sessionId)
      ptyCreateTime.delete(sessionId)
      ptyOutputHistory.delete(sessionId)
    }

    const shell = isWin ? 'cmd.exe' : 'claude'
    const claudeCmd = ['claude', ...permFlags].join(' ')
    const args = isWin ? ['/c', claudeCmd] : permFlags

    console.log('[PTY] creating session:', sessionId, shell, args, 'cwd:', workDir)

    const pty = spawnPty(shell, args, {
      name: 'xterm-256color',
      cols: 120,
      rows: 40,
      cwd: workDir,
      env: process.env as { [key: string]: string }
    })

    ptySessions.set(sessionId, pty)
    console.log('[PTY] session created:', sessionId)
    ptyCreateTime.set(sessionId, Date.now())

    pty.onData((data) => {
      const history = ptyOutputHistory.get(sessionId) || ''
      ptyOutputHistory.set(sessionId, history + data)
      sendPtyData(sessionId, data)

      if (checkNeedConfirm(sessionId, data)) {
        broadcastClaudeConfirmNeeded()
        scheduleAutoExpand()
      }

      if (checkTaskDone(sessionId, data)) {
        scheduleAutoExpand()
      }
    })

    pty.onExit(({ exitCode }) => {
      console.log('[PTY] session exited:', sessionId, 'code:', exitCode)
      ptyConfirmDetected.delete(sessionId)
      ptyConfirmBuffers.delete(sessionId)
      ptyTaskDoneBuffers.delete(sessionId)
      const currentPty = ptySessions.get(sessionId)
      if (currentPty === pty) {
        ptySessions.delete(sessionId)
        pendingKillTimers.delete(sessionId)
        ptyCreateTime.delete(sessionId)
        ptyOutputHistory.delete(sessionId)
        sendPtyExit(sessionId, exitCode ?? -1)
        if (exitCode === 0 || exitCode === null) {
          notifyTaskFinished()
        }
      } else {
        console.log('[PTY] session already replaced, ignoring exit for', sessionId)
      }
    })

    return { success: true, sessionId }
  })

  ipcMain.handle('write-pty', (_event, sessionId: string, data: string) => {
    console.log('[PTY] write, session:', sessionId, 'data length:', data.length)
    const pty = ptySessions.get(sessionId)
    if (!pty) {
      return { success: false, error: 'PTY session not found: ' + sessionId }
    }
    writePtyChunks(pty, data, () => {
      // 用户按回车输入新问题时，清空任务完成检测缓冲区
      if (data.includes('\r') || data.includes('\n')) {
        ptyTaskDoneBuffers.delete(sessionId)
      }
    })
    return { success: true }
  })

  ipcMain.handle('resize-pty', (_event, sessionId: string, cols: number, rows: number) => {
    const pty = ptySessions.get(sessionId)
    pty?.resize(cols, rows)
  })

  ipcMain.handle('kill-pty', (_event, sessionId: string) => {
    if (pendingKillTimers.has(sessionId)) {
      clearTimeout(pendingKillTimers.get(sessionId))
    }
    pendingKillTimers.set(sessionId, setTimeout(() => {
      console.log('[PTY] delayed kill executing:', sessionId)
      const pty = ptySessions.get(sessionId)
      pty?.kill()
      ptySessions.delete(sessionId)
      pendingKillTimers.delete(sessionId)
    }, 1000))
  })

  /* 运行时切换权限：向 PTY 发送 /permission-mode 命令 */
  ipcMain.handle('change-pty-permission', (_event, sessionId: string, permission: UIPermission) => {
    const pty = ptySessions.get(sessionId)
    if (!pty) {
      return { success: false, error: 'PTY session not active: ' + sessionId }
    }
    const createdAt = ptyCreateTime.get(sessionId)
    if (createdAt && Date.now() - createdAt < 3000) {
      console.log('[PTY] ignoring permission change within 3s of creation for', sessionId)
      return { success: true }
    }
    const cmd = getPermissionSlashCommand(permission)
    console.log('[PTY] changing permission:', sessionId, permission, '→', JSON.stringify(cmd))
    pty.write(cmd)
    return { success: true }
  })

  /* ── 任务队列 IPC ──────────────────────────────────────── */

  ipcMain.handle('enqueue-task', (_event, conversationId: string | null, prompt: string) => {
    const task = taskQueue.enqueue(conversationId, prompt)
    return task
  })

  ipcMain.handle('pause-task', (_event, taskId: number) => {
    return taskQueue.pause(taskId)
  })

  ipcMain.handle('resume-task', (_event, taskId: number) => {
    return taskQueue.resume(taskId)
  })

  ipcMain.handle('cancel-task', (_event, taskId: number) => {
    return taskQueue.cancel(taskId)
  })

  ipcMain.handle('complete-task', (_event, taskId: number, result?: string) => {
    return taskQueue.complete(taskId, result)
  })

  ipcMain.handle('fail-task', (_event, taskId: number, error?: string) => {
    return taskQueue.fail(taskId, error)
  })

  ipcMain.handle('delete-task', (_event, taskId: number) => {
    return taskQueue.deleteTask(taskId)
  })

  ipcMain.handle('get-tasks', () => {
    return taskQueue.getTasks()
  })

  /* ── SQLite 会话存储 IPC ───────────────────────────────── */

  ipcMain.handle('create-conversation', (_event, id: string, title: string) => {
    return sessionStore.createConversation(id, title)
  })

  ipcMain.handle('get-conversations', () => {
    return sessionStore.getAllConversations()
  })

  ipcMain.handle('delete-conversation', (_event, id: string) => {
    sessionStore.deleteConversation(id)
  })

  ipcMain.handle('add-message', (_event, conversationId: string, message: { role: string; content: string; model?: string; tokenUsage?: number }) => {
    const validRole = ['user', 'assistant', 'system'].includes(message.role) ? message.role as 'user' | 'assistant' | 'system' : 'user'
    return sessionStore.addMessage(conversationId, { ...message, role: validRole })
  })

  ipcMain.handle('get-messages', (_event, conversationId: string, limit?: number, offset?: number) => {
    return sessionStore.getMessages(conversationId, limit, offset)
  })

  /* ── 文件变动感知 IPC ──────────────────────────────────── */

  ipcMain.handle('get-file-change-summary', () => {
    return fileWatcher.getSummary()
  })

  ipcMain.handle('toggle-file-watcher', (_event, enabled: boolean) => {
    if (enabled) {
      const cwd = process.cwd()
      fileWatcher.start(cwd)
    } else {
      fileWatcher.stop()
    }
  })

  ipcMain.handle('kill-claude', () => {
    if (currentClaudePty) {
      currentClaudePty.kill()
    }
  })

  /* ── 读取 Claude Code CLI 配置 ───────────────────────────── */

  ipcMain.handle('read-claude-config', () => {
    try {
      const configPath = path.join(os.homedir(), '.claude', 'settings.json')
      if (!fs.existsSync(configPath)) return null
      const content = fs.readFileSync(configPath, 'utf-8')
      return JSON.parse(content)
    } catch (e) {
      console.error('[ClaudeConfig] read failed:', e)
      return null
    }
  })

  /* 保留旧的 CLI 流式接口（供 InputArea 用） */
  ipcMain.handle('send-to-claude', (_event, prompt: string, permission?: UIPermission, cwd?: string) => {
    const workDir = cwd || process.cwd()
    const isWin = process.platform === 'win32'
    const permFlags = getPermissionFlags(permission)

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
    const claudeCmd = ['claude', ...permFlags].join(' ')
    const args = isWin ? ['/c', claudeCmd] : permFlags

    if (currentClaudePty) {
      currentClaudePty.kill()
      currentClaudePty = null
    }

    const pty = spawnPty(shell, args, {
      name: 'xterm-256color',
      cols: 120,
      rows: 40,
      cwd: workDir,
      env: process.env as { [key: string]: string }
    })
    currentClaudePty = pty
    ptyConfirmDetected.set('legacy', false)
    ptyConfirmBuffers.set('legacy', '')

    console.log('[Main] sending claude-task-start to', BrowserWindow.getAllWindows().length, 'windows')
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        console.log('[Main] sending claude-task-start to window', win.id)
        win.webContents.send('claude-task-start')
      }
    })

    setTimeout(() => {
      writePtyChunks(pty, prompt + '\r')
    }, isWin ? 1500 : 500)

    pty.onData((data) => {
      BrowserWindow.getAllWindows().forEach((win) => {
        if (!win.isDestroyed()) win.webContents.send('claude-output', data)
      })
      if (checkNeedConfirm('legacy', data)) {
        broadcastClaudeConfirmNeeded()
        scheduleAutoExpand()
      }
    })

    pty.onExit(({ exitCode }) => {
      clearTimeout(timeoutId)
      if (currentClaudePty === pty) {
        currentClaudePty = null
      }
      ptyConfirmDetected.delete('legacy')
      ptyConfirmBuffers.delete('legacy')
      console.log('[Main] sending claude-close', exitCode, 'to', BrowserWindow.getAllWindows().length, 'windows')
      BrowserWindow.getAllWindows().forEach((win) => {
        if (!win.isDestroyed()) {
          console.log('[Main] sending claude-close to window', win.id)
          win.webContents.send('claude-close', exitCode)
        }
      })
      if (exitCode === 0 || exitCode === null) {
        notifyTaskFinished()
      }
    })

    return { success: true }
  })
}

/* ── lifecycle ───────────────────────────────────────────── */

app.whenReady().then(() => {
  setupAutoUpdater()
  createFloatWindow()
  createTray()
  createMainWindow()
  registerIPC()

  // 启动后延迟检查更新，然后按每周五 10:00 安排定时检查
  setTimeout(() => checkForUpdatesSilent(), 30000)
  scheduleNextFridayCheck()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  // 不退出，托盘与悬浮球保持后台运行
})
