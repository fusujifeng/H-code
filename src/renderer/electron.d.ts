export {}

declare global {
  interface Window {
    electronAPI?: {
      windowMinimize: () => Promise<void>
      windowMaximize: () => Promise<void>
      windowClose: () => Promise<void>
      windowIsMaximized: () => Promise<boolean>
      onWindowMaximized: (cb: (maximized: boolean) => void) => () => void

      showMainWindow: () => Promise<void>
      quitApp: () => Promise<void>
      hideFloatBall: () => Promise<void>
      showFloatBall: () => Promise<void>
      floatBallMoveStart: () => Promise<[number, number]>
      floatBallMove: (x: number, y: number) => Promise<void>

      /* Claude Code CLI */
      sendToClaude: (prompt: string, permission?: string, cwd?: string) => Promise<{ success: boolean }>
      onClaudeOutput: (cb: (data: string) => void) => () => void
      onClaudeError: (cb: (err: string) => void) => () => void
      onClaudeClose: (cb: (code: number | null) => void) => () => void
      onClaudeTaskStart: (cb: () => void) => () => void

      /* PTY 终端会话（多会话支持） */
      createPty: (sessionId: string, permission?: string, cwd?: string) => Promise<{ success: boolean; sessionId: string }>
      changePtyPermission: (sessionId: string, permission: string) => Promise<{ success: boolean }>
      writePty: (sessionId: string, data: string) => Promise<{ success: boolean }>
      resizePty: (sessionId: string, cols: number, rows: number) => Promise<void>
      killPty: (sessionId: string) => Promise<void>
      onPtyData: (cb: (sessionId: string, data: string) => void) => () => void
      onPtyExit: (cb: (sessionId: string, code: number | null) => void) => () => void

      /* 自动更新 */
      checkUpdate: () => Promise<void>
      downloadUpdate: () => Promise<void>
      installUpdate: () => Promise<void>
      getUpdateDownloaded: () => Promise<boolean>
      onUpdateStatus: (cb: (status: string) => void) => () => void
      onUpdateProgress: (cb: (percent: number) => void) => () => void
      onUpdateError: (cb: (err: string) => void) => () => void
    }
  }
}
