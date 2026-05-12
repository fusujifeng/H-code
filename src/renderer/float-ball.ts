console.log('[FloatBallWindow] script loaded, electronAPI:', typeof window.electronAPI)

const ball = document.getElementById('ball')!
const menu = document.getElementById('menu')!

/* ── 拖拽 ─────────────────────────────────────────────── */

let dragging = false
let dragStart = { x: 0, y: 0 }
let winStart = { x: 0, y: 0 }
let hasDragged = false

ball.addEventListener('mousedown', async (e) => {
  if (e.button !== 0) return
  dragging = true
  hasDragged = false
  dragStart = { x: e.screenX, y: e.screenY }
  const pos = await window.electronAPI?.floatBallMoveStart()
  if (pos) winStart = { x: pos[0], y: pos[1] }
})

document.addEventListener('mousemove', (e) => {
  if (!dragging) return
  const dx = e.screenX - dragStart.x
  const dy = e.screenY - dragStart.y
  if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasDragged = true
  window.electronAPI?.floatBallMove(winStart.x + dx, winStart.y + dy)
})

document.addEventListener('mouseup', () => {
  dragging = false
})

/* ── 双击打开主界面 ─────────────────────────────────── */

ball.addEventListener('dblclick', () => {
  window.electronAPI?.showMainWindow()
})

/* ── 单击打开主界面（仅当没有拖拽时） ─────────────── */

ball.addEventListener('click', () => {
  if (!hasDragged) {
    window.electronAPI?.showMainWindow()
  }
})

/* ── 右键菜单（调用主进程原生菜单） ─────────────────── */

ball.addEventListener('contextmenu', (e) => {
  e.preventDefault()
  window.electronAPI?.showFloatBallContextMenu?.()
})

/* ── CLI 任务状态感知 ─────────────────────────────────── */

let statusTimer: ReturnType<typeof setTimeout> | null = null
let thinkingTimer: ReturnType<typeof setTimeout> | null = null
let wasRunning = false

function setBallStatus(status: 'running' | 'success' | 'error' | 'none') {
  console.log('[FloatBall] setBallStatus:', status)
  ball.classList.remove('status-running', 'status-success', 'status-error')
  if (statusTimer) {
    clearTimeout(statusTimer)
    statusTimer = null
  }
  if (status !== 'none') {
    ball.classList.add(`status-${status}`)
  }
  if (status === 'success' || status === 'error') {
    statusTimer = setTimeout(() => {
      ball.classList.remove(`status-${status}`)
    }, 3000)
  }
}

// PTY 数据监听：有输出 → 思考中（蓝色跳动）
window.electronAPI?.onPtyData(() => {
  if (!ball.classList.contains('status-running')) {
    setBallStatus('running')
  }
  if (thinkingTimer) clearTimeout(thinkingTimer)
  thinkingTimer = setTimeout(() => {
    if (ball.classList.contains('status-running')) {
      ball.classList.remove('status-running')
    }
  }, 2000)
})

// 直接调用 Claude 的任务
window.electronAPI?.onClaudeTaskStart(() => {
  console.log('[FloatBall] onClaudeTaskStart')
  setBallStatus('running')
})

window.electronAPI?.onClaudeClose((code) => {
  console.log('[FloatBall] onClaudeClose:', code)
  if (code === 0) {
    setBallStatus('success')
  } else {
    setBallStatus('error')
  }
})

// 任务队列状态监听
window.electronAPI?.onQueueStatus((status) => {
  console.log('[FloatBall] onQueueStatus:', status)
  if (status.active > 0) {
    wasRunning = true
    setBallStatus('running')
  } else if (wasRunning && status.active === 0) {
    wasRunning = false
    setBallStatus('success')
    // 任务完成后恢复主窗口
    window.electronAPI?.showMainWindow?.()
  }
})

// 点击打开主窗口时清除状态
ball.addEventListener('click', () => {
  if (!hasDragged) {
    setBallStatus('none')
  }
})

ball.addEventListener('dblclick', () => {
  setBallStatus('none')
})
