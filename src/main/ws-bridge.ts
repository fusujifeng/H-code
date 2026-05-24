import WebSocket from 'ws'
import { BrowserWindow } from 'electron'

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected'

interface WSBridgeConfig {
  serverUrl: string
}

export class WSBridge {
  private ws: WebSocket | null = null
  private config: WSBridgeConfig
  private status: ConnectionStatus = 'disconnected'
  private pairCode: string | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectDelay = 1000
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private onCommand: ((payload: string) => void) | null = null
  private aiResponseBuffer = ''
  private aiResponseFlushTimer: ReturnType<typeof setTimeout> | null = null

  constructor(config: WSBridgeConfig) {
    this.config = config
  }

  setOnCommand(handler: (payload: string) => void) {
    this.onCommand = handler
  }

  getStatus(): ConnectionStatus {
    return this.status
  }

  getPairCode(): string | null {
    return this.pairCode
  }

  connect() {
    if (this.ws) {
      this.ws.close()
    }
    this.setStatus('connecting')
    try {
      this.ws = new WebSocket(this.config.serverUrl)

      this.ws.on('open', () => {
        console.log('[ws-bridge] connected to', this.config.serverUrl)
        this.ws!.send(JSON.stringify({ type: 'register', client_type: 'desktop' }))
      })

      this.ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw.toString())
          switch (msg.type) {
            case 'pair_code':
              this.pairCode = typeof msg.payload === 'string' ? msg.payload : JSON.stringify(msg.payload)
              this.setStatus('connected')
              this.reconnectDelay = 1000
              this.startHeartbeat()
              this.notifyRenderers('pair-code-updated', this.pairCode)
              console.log('[ws-bridge] pair code:', this.pairCode)
              break
            case 'command':
              if (this.onCommand) {
                const payload = typeof msg.payload === 'string' ? msg.payload : JSON.stringify(msg.payload)
                this.onCommand(payload)
              }
              break
            case 'heartbeat':
              break
            case 'disconnect':
              console.log('[ws-bridge] peer disconnected:', msg.payload)
              break
            case 'error':
              console.error('[ws-bridge] server error:', msg.payload)
              break
          }
        } catch (e) {
          console.error('[ws-bridge] parse error:', e)
        }
      })

      this.ws.on('close', () => {
        console.log('[ws-bridge] disconnected')
        this.heartbeatTimer && clearInterval(this.heartbeatTimer)
        this.heartbeatTimer = null
        this.setStatus('disconnected')
        this.scheduleReconnect()
      })

      this.ws.on('error', (err) => {
        console.error('[ws-bridge] error:', err.message)
        this.ws?.close()
      })
    } catch (e) {
      console.error('[ws-bridge] connect error:', e)
      this.setStatus('disconnected')
      this.scheduleReconnect()
    }
  }

  sendAIResponse(payload: string) {
    this.aiResponseBuffer += payload
    if (this.aiResponseFlushTimer) {
      clearTimeout(this.aiResponseFlushTimer)
    }
    this.aiResponseFlushTimer = setTimeout(() => this.flushAIResponse(), 300)
  }

  sendTodoUpdate(payload: string) {
    if (this.ws && this.status === 'connected') {
      this.ws.send(JSON.stringify({ type: 'todo_update', payload }))
    }
  }

  sendProjectSync(project: { id: string; name: string; description: string; status: string; taskCount: number; lastActive: number }) {
    if (this.ws && this.status === 'connected') {
      this.ws.send(JSON.stringify({ type: 'project_sync', payload: project }))
    }
  }

  private flushAIResponse() {
    this.aiResponseFlushTimer = null
    if (this.aiResponseBuffer.trim().length > 0 && this.ws && this.status === 'connected') {
      this.ws.send(JSON.stringify({ type: 'ai_response', payload: this.aiResponseBuffer }))
      this.aiResponseBuffer = ''
    }
  }

  private startHeartbeat() {
    this.heartbeatTimer && clearInterval(this.heartbeatTimer)
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'heartbeat' }))
      }
    }, 30000)
  }

  private setStatus(s: ConnectionStatus) {
    this.status = s
    this.notifyRenderers('connection-status-changed', s)
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return
    console.log(`[ws-bridge] reconnect in ${this.reconnectDelay}ms`)
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000)
      this.connect()
    }, this.reconnectDelay)
  }

  private notifyRenderers(channel: string, data: unknown) {
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send(channel, data)
      }
    })
  }

  destroy() {
    this.heartbeatTimer && clearInterval(this.heartbeatTimer)
    this.aiResponseFlushTimer && clearTimeout(this.aiResponseFlushTimer)
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
    }
    this.ws?.close()
    this.ws = null
  }
}
