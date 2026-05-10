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
      floatBallMoveStart: () => Promise<[number, number]>
      floatBallMove: (x: number, y: number) => Promise<void>

      /* Claude Code CLI */
      sendToClaude: (prompt: string, cwd?: string) => Promise<{ success: boolean }>
      onClaudeOutput: (cb: (data: string) => void) => () => void
      onClaudeError: (cb: (err: string) => void) => () => void
      onClaudeClose: (cb: (code: number | null) => void) => () => void
      onClaudeTaskStart: (cb: () => void) => () => void

      /* PTY 终端会话 */
      createPty: (cwd?: string) => Promise<{ success: boolean }>
      writePty: (data: string) => Promise<void>
      resizePty: (cols: number, rows: number) => Promise<void>
      killPty: () => Promise<void>
      onPtyData: (cb: (data: string) => void) => () => void
      onPtyExit: (cb: (code: number | null) => void) => () => void
    }
  }
}
