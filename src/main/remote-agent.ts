import { WebSocket } from 'ws'
import { spawn as spawnPty } from 'node-pty'

type MessageHandler = (msg: RemoteMessage) => void

interface RemoteMessage {
  type: string
  pairingCode?: string
  payload?: string
}

export class RemoteAgent {
  private ws: WebSocket | null = null
  private pty: ReturnType<typeof spawnPty> | null = null
  private pairingCode = ''
  private serverUrl: string
  private handlers: Map<string, MessageHandler[]> = new Map()
  private confirmResolve: ((v: string) => void) | null = null
  private outputBuffer = ''
  private status: 'offline' | 'online' | 'paired' = 'offline'

  constructor(serverUrl: string) {
    this.serverUrl = serverUrl
  }

  getStatus() { return this.status }
  getPairingCode() { return this.pairingCode }

  connect(existingCode?: string): void {
    if (this.ws) this.ws.close()
    this.ws = new WebSocket(this.serverUrl)
    this.status = 'online'

    this.ws.on('open', () => {
      this.send({
        type: 'register',
        pairingCode: existingCode,
      })
    })

    this.ws.on('message', (raw) => {
      try {
        const msg: RemoteMessage = JSON.parse(raw.toString())
        this.handleMessage(msg)
      } catch { /* ignore malformed */ }
    })

    this.ws.on('close', () => {
      this.status = 'offline'
      this.pty?.kill()
      this.emit('status-change', 'offline')
    })

    this.ws.on('error', (err) => {
      console.error('[RemoteAgent] ws error:', err.message)
      this.emit('error', err.message)
    })
  }

  disconnect(): void {
    this.pty?.kill()
    this.pty = null
    this.ws?.close()
    this.ws = null
    this.status = 'offline'
  }

  /**
   * 执行一条从手机发来的指令
   */
  private executeCommand(command: string, cwd?: string): void {
    // Kill existing PTY
    if (this.pty) { this.pty.kill(); this.pty = null }
    this.outputBuffer = ''

    this.emit('task-start', command)
    this.send({ type: 'task-start', payload: command })

    const workDir = cwd || process.cwd()

    this.pty = spawnPty(process.platform === 'win32' ? 'cmd.exe' : 'claude', process.platform === 'win32' ? ['/c', 'claude', '-p'] : ['-p'], {
      name: 'xterm-256color',
      cols: 120,
      rows: 40,
      cwd: workDir,
      env: process.env as Record<string, string>,
    })

    this.pty.onData((data: string) => {
      this.outputBuffer += data
      this.send({ type: 'output', payload: data })
      this.emit('output', data)

      // 检测权限确认提示
      if (this.detectConfirm(data)) {
        this.send({ type: 'confirm-needed', payload: data })
        this.emit('confirm-needed', data)
      }
    })

    this.pty.onExit(({ exitCode }: { exitCode: number }) => {
      this.send({ type: 'task-end', payload: String(exitCode) })
      this.emit('task-end', exitCode)
      this.pty = null
    })

    // 发送指令
    setTimeout(() => {
      this.pty?.write(command + '\r')
    }, 500)
  }

  /**
   * 响应手机端发来的确认
   */
  sendConfirm(response: string): void {
    this.pty?.write(response + '\r')
    if (this.confirmResolve) {
      this.confirmResolve(response)
      this.confirmResolve = null
    }
  }

  /**
   * 取消当前任务
   */
  cancelTask(): void {
    this.pty?.kill()
    this.pty = null
    this.send({ type: 'status', payload: 'cancelled' })
  }

  /**
   * 检测 Claude CLI 是否需要确认
   */
  private detectConfirm(data: string): boolean {
    const markers = [
      '是否继续',
      'Do you want to proceed',
      'permission',
      'y/n',
      '(y/n)',
      'confirm',
      'allow',
      'deny',
    ]
    const lower = data.toLowerCase()
    return markers.some((m) => lower.includes(m.toLowerCase()))
  }

  // ── 消息路由 ──────────────────────────────

  private handleMessage(msg: RemoteMessage): void {
    switch (msg.type) {
      case 'registered':
        this.pairingCode = msg.pairingCode || ''
        this.status = 'online'
        this.emit('registered', this.pairingCode)
        break

      case 'phone-connected':
        this.status = 'paired'
        this.emit('status-change', 'paired')
        break

      case 'command':
        this.executeCommand(msg.payload || '')
        break

      case 'confirm-response':
        this.sendConfirm(msg.payload || '')
        break

      case 'cancel':
        this.cancelTask()
        break

      case 'status':
        if (msg.payload === 'phone-offline') {
          this.status = 'online'
          this.emit('status-change', 'online')
        }
        break

      case 'error':
        this.emit('error', msg.payload || 'unknown')
        break
    }
  }

  // ── 简单事件系统 ──────────────────────────

  on(event: string, handler: MessageHandler): void {
    if (!this.handlers.has(event)) this.handlers.set(event, [])
    this.handlers.get(event)!.push(handler)
  }

  private emit(event: string, data: unknown): void {
    const list = this.handlers.get(event)
    if (list) list.forEach((h) => h(data as RemoteMessage))
  }

  private send(msg: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg))
    }
  }
}
