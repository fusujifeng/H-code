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

/* ── 右键菜单 ───────────────────────────────────────── */

ball.addEventListener('contextmenu', (e) => {
  e.preventDefault()
  const rect = ball.getBoundingClientRect()
  menu.style.display = 'block'
  menu.style.left = rect.left + 'px'
  menu.style.top = rect.bottom + 4 + 'px'
})

document.addEventListener('click', (e) => {
  if (!(e.target as HTMLElement).closest('#menu')) {
    menu.style.display = 'none'
  }
})

menu.addEventListener('click', (e) => {
  const target = e.target as HTMLElement
  const action = target.dataset.action
  if (action === 'show') {
    window.electronAPI?.showMainWindow()
  } else if (action === 'quit') {
    window.electronAPI?.quitApp()
  }
  menu.style.display = 'none'
})
