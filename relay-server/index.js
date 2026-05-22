import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 9527

// ── HTTP server ──────────────────────────────────────
const server = createServer((req, res) => {
  // PWA 前端页面
  if (req.url === '/' || req.url === '/index.html') {
    try {
      const html = readFileSync(join(__dirname, '..', 'pwa', 'index.html'), 'utf-8')
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(html)
    } catch {
      // fallback: 内联的极简页面
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(getFallbackHTML())
    }
  } else if (req.url === '/health') {
    res.writeHead(200)
    res.end('ok')
  } else {
    res.writeHead(404)
    res.end()
  }
})

// ── WebSocket ────────────────────────────────────────
const wss = new WebSocketServer({ server })

// 6位随机配对码
function genPairingCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

// 会话: pairingCode -> { desktop, phone, createdAt }
const sessions = new Map()

setInterval(() => {
  const now = Date.now()
  for (const [code, s] of sessions) {
    if (now - s.createdAt > 24 * 60 * 60 * 1000) {
      s.desktop?.close()
      s.phone?.close()
      sessions.delete(code)
    }
  }
}, 60 * 60 * 1000)

wss.on('connection', (ws) => {
  console.log('[relay] new connection')
  let role = null
  let pairingCode = null

  ws.on('message', (raw) => {
    let msg
    try { msg = JSON.parse(raw.toString()) } catch { return }

    switch (msg.type) {
      case 'register': {
        pairingCode = msg.pairingCode || genPairingCode()
        if (!sessions.has(pairingCode)) {
          sessions.set(pairingCode, { desktop: null, phone: null, createdAt: Date.now() })
        }
        sessions.get(pairingCode).desktop = ws
        role = 'desktop'
        send(ws, { type: 'registered', pairingCode })
        console.log(`[relay] desktop registered, code=${pairingCode}`)
        break
      }
      case 'pair': {
        const code = msg.pairingCode
        const s = sessions.get(code)
        if (!s) { send(ws, { type: 'error', payload: '配对码无效或已过期' }); return }
        if (!s.desktop || s.desktop.readyState !== 1) {
          send(ws, { type: 'error', payload: '桌面端不在线' }); return
        }
        s.phone = ws
        role = 'phone'
        pairingCode = code
        send(ws, { type: 'paired', pairingCode: code })
        send(s.desktop, { type: 'phone-connected' })
        console.log(`[relay] phone paired, code=${code}`)
        break
      }
      case 'command':
      case 'confirm-response':
      case 'cancel': {
        const s = pairingCode ? sessions.get(pairingCode) : null
        if (!s) { send(ws, { type: 'error', payload: '未配对' }); return }
        const target = role === 'phone' ? s.desktop : s.phone
        if (target?.readyState === 1) send(target, msg)
        break
      }
      case 'output':
      case 'task-start':
      case 'task-end':
      case 'confirm-needed':
      case 'status': {
        const s = pairingCode ? sessions.get(pairingCode) : null
        if (s?.phone?.readyState === 1) send(s.phone, msg)
        break
      }
    }
  })

  ws.on('close', () => {
    if (pairingCode) {
      const s = sessions.get(pairingCode)
      if (s) {
        if (role === 'desktop') {
          s.desktop = null
          if (s.phone) send(s.phone, { type: 'status', payload: 'desktop-offline' })
        }
        if (role === 'phone') {
          s.phone = null
          if (s.desktop) send(s.desktop, { type: 'status', payload: 'phone-offline' })
        }
        if (!s.desktop && !s.phone) sessions.delete(pairingCode)
      }
    }
    console.log(`[relay] ${role} disconnected, code=${pairingCode}`)
  })
})

function send(ws, data) {
  if (ws.readyState === 1) ws.send(JSON.stringify(data))
}

// ── start ───────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`[relay] http://0.0.0.0:${PORT} (PWA)`)
  console.log(`[relay] ws://0.0.0.0:${PORT} (WebSocket)`)
})

process.on('SIGTERM', () => {
  for (const [, s] of sessions) { s.desktop?.close(); s.phone?.close() }
  wss.close()
  server.close()
  process.exit(0)
})

// ── 内联 PWA fallback ─────────────────────────────────
function getFallbackHTML() {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="theme-color" content="#1a1a2e">
<title>H-code Remote</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f0f1a;color:#e0e0e0;height:100dvh;overflow:hidden;user-select:none;-webkit-user-select:none}
#app{display:flex;flex-direction:column;height:100dvh;max-width:480px;margin:0 auto}
header{padding:12px 16px 8px;display:flex;align-items:center;gap:10px;border-bottom:1px solid #2a2a3e;flex-shrink:0}
.status-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
.status-dot.offline{background:#666}.status-dot.online{background:#3498db}
.status-dot.paired{background:#2ecc71}.status-dot.running{background:#f39c12;animation:pulse 1s infinite}
@keyframes pulse{50%{opacity:.5}}header .label{font-size:13px;color:#999;flex:1}header .code{font-size:18px;font-weight:700;letter-spacing:4px;color:#fff}
#messages{flex:1;overflow-y:auto;padding:12px 16px;display:flex;flex-direction:column;gap:10px;-webkit-overflow-scrolling:touch}
.msg{max-width:90%;padding:10px 14px;border-radius:14px;font-size:15px;line-height:1.5;word-break:break-word}
.msg.out{align-self:flex-end;background:#3498db;color:#fff}
.msg.in{align-self:flex-start;background:#2a2a3e;color:#e0e0e0;font-family:monospace;font-size:13px;white-space:pre-wrap}
.msg.event{align-self:center;background:transparent;color:#666;font-size:12px;padding:4px 8px}
.msg.alert{align-self:center;background:#f39c1222;color:#f39c12;font-size:13px}
#input-area{padding:10px 16px 24px;border-top:1px solid #2a2a3e;display:flex;gap:8px;flex-shrink:0}
#input-area input{flex:1;padding:12px 16px;border-radius:24px;border:1px solid #3a3a4e;background:#1a1a2e;color:#e0e0e0;font-size:16px;outline:none}
#input-area input:focus{border-color:#3498db}
#input-area button{width:48px;height:48px;border-radius:50%;border:none;background:#3498db;color:#fff;font-size:20px;cursor:pointer;flex-shrink:0}
#input-area button:active{opacity:.8}#input-area button:disabled{background:#333;color:#666}
#pair-overlay{position:fixed;inset:0;background:#0f0f1a;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;z-index:100}
#pair-overlay.hidden{display:none}#pair-overlay h1{font-size:24px;color:#fff}
#pair-overlay .hint{font-size:14px;color:#999;text-align:center;line-height:1.6}
#pair-overlay input{width:200px;padding:14px 20px;border-radius:12px;border:2px solid #3a3a4e;background:#1a1a2e;color:#fff;font-size:28px;text-align:center;letter-spacing:8px;outline:none}
#pair-overlay input:focus{border-color:#3498db}#pair-overlay button{padding:14px 40px;border-radius:24px;border:none;background:#3498db;color:#fff;font-size:16px;cursor:pointer}
#pair-overlay .error{color:#e74c3c;font-size:14px}
</style></head>
<body>
<div id="pair-overlay"><h1>H-code Remote</h1>
<p class="hint">在桌面 H-code 中开启远程控制<br>输入屏幕上的 6 位配对码</p>
<input id="code-input" type="text" maxlength="6" inputmode="numeric" autocomplete="one-time-code" placeholder="000000">
<button onclick="doPair()">连接</button><p class="error" id="pair-error"></p></div>
<div id="app"><header><div class="status-dot offline" id="status-dot"></div>
<span class="label" id="status-label">未连接</span><span class="code" id="header-code"></span></header>
<div id="messages"></div><div id="input-area">
<input id="cmd-input" type="text" placeholder="输入指令..." disabled autocomplete="off">
<button id="send-btn" onclick="sendCommand()" disabled>→</button></div></div>
<script>
const RELAY=(location.protocol==='https:'?'wss:':'ws:')+'//'+location.host
let ws=null,state='offline'
const $=s=>document.querySelector(s)
function addMsg(t,x){const e=document.createElement('div');e.className='msg '+t;if(t==='in')x=x.replace(/\\x1b\\[[0-9;]*m/g,'').replace(/\\x00/g,'');e.textContent=x;$('#messages').appendChild(e);$('#messages').scrollTop=$('#messages').scrollHeight}
function setStatus(s){state=s;$('#status-dot').className='status-dot '+s;const L={offline:'未连接',online:'等待手机配对',paired:'已配对，待命',running:'执行中...'};$('#status-label').textContent=L[s]||s;const d=s!=='paired';$('#cmd-input').disabled=d;$('#send-btn').disabled=d}
function connect(c){addMsg('event','正在连接...');ws=new WebSocket(RELAY);ws.onopen=()=>{if(c)ws.send(JSON.stringify({type:'pair',pairingCode:c}))};ws.onmessage=e=>{const m=JSON.parse(e.data);switch(m.type){case'paired':$('#pair-overlay').classList.add('hidden');$('#header-code').textContent=m.pairingCode;setStatus('paired');addMsg('event','✓ 已连接到桌面');break;case'task-start':setStatus('running');addMsg('event','▸ '+m.payload);break;case'output':addMsg('in',m.payload);break;case'task-end':setStatus('paired');addMsg('event','✓ 任务完成 (exit: '+m.payload+')');break;case'confirm-needed':addMsg('alert','⚠ 桌面端需要确认权限，请在桌面操作');break;case'status':if(m.payload==='desktop-offline'){setStatus('offline');addMsg('event','桌面端已断开')}break;case'error':addMsg('event','✗ '+m.payload);break}};ws.onclose=()=>{setStatus('offline');addMsg('event','连接已断开')};ws.onerror=()=>{$('#pair-error').textContent='连接失败'}}
function doPair(){const c=$('#code-input').value.trim();if(c.length!==6){$('#pair-error').textContent='请输入 6 位配对码';return}$('#pair-error').textContent='';connect(c)}
function sendCommand(){const t=$('#cmd-input').value.trim();if(!t||!ws||ws.readyState!==1)return;ws.send(JSON.stringify({type:'command',payload:t}));addMsg('out',t);$('#cmd-input').value=''}
$('#cmd-input').addEventListener('keydown',e=>{if(e.key==='Enter')sendCommand()})
</script></body></html>\n`
}
