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
      showFloatBallContextMenu: () => Promise<void>
      setAutoExpandFloatBall: (enabled: boolean) => Promise<void>

      /* Claude Code CLI */
      sendToClaude: (prompt: string, permission?: string, cwd?: string) => Promise<{ success: boolean }>
      onClaudeOutput: (cb: (data: string) => void) => () => void
      onClaudeError: (cb: (err: string) => void) => () => void
      onClaudeClose: (cb: (code: number | null) => void) => () => void
      onClaudeTaskStart: (cb: () => void) => () => void
      onClaudeConfirmNeeded: (cb: () => void) => () => void

      /* PTY 终端会话（多会话支持） */
      createPty: (sessionId: string, permission?: string, cwd?: string) => Promise<{ success: boolean; sessionId: string }>
      changePtyPermission: (sessionId: string, permission: string) => Promise<{ success: boolean }>
      writePty: (sessionId: string, data: string) => Promise<{ success: boolean }>
      resizePty: (sessionId: string, cols: number, rows: number) => Promise<void>
      killPty: (sessionId: string) => Promise<void>
      onPtyData: (cb: (sessionId: string, data: string) => void) => () => void
      onPtyExit: (cb: (sessionId: string, code: number | null) => void) => () => void
      onPtyHistory: (cb: (sessionId: string, history: string) => void) => () => void

      /* 自动更新 */
      checkUpdate: () => Promise<void>
      downloadUpdate: () => Promise<void>
      installUpdate: () => Promise<void>
      getUpdateDownloaded: () => Promise<boolean>
      onUpdateStatus: (cb: (status: string) => void) => () => void
      onUpdateProgress: (cb: (percent: number) => void) => () => void
      onUpdateError: (cb: (err: string) => void) => () => void

      /* 任务队列 */
      enqueueTask: (conversationId: string | null, prompt: string) => Promise<unknown>
      pauseTask: (taskId: number) => Promise<boolean>
      resumeTask: (taskId: number) => Promise<boolean>
      cancelTask: (taskId: number) => Promise<boolean>
      completeTask: (taskId: number, result?: string) => Promise<boolean>
      failTask: (taskId: number, error?: string) => Promise<boolean>
      deleteTask: (taskId: number) => Promise<boolean>
      getTasks: () => Promise<unknown[]>
      onTaskUpdated: (cb: (task: unknown) => void) => () => void
      onTaskExecute: (cb: (payload: { taskId: number; conversationId: string | null; prompt: string }) => void) => () => void
      onQueueStatus: (cb: (status: { total: number; active: number }) => void) => () => void
      onTaskDeleted: (cb: (payload: { taskId: number }) => void) => () => void
      killClaude: () => Promise<void>

      /* SQLite 会话存储 */
      createConversation: (id: string, title: string) => Promise<unknown>
      getConversations: () => Promise<unknown[]>
      deleteConversation: (id: string) => Promise<void>
      addMessage: (conversationId: string, message: { role: string; content: string; model?: string; tokenUsage?: number }) => Promise<unknown>
      getMessages: (conversationId: string, limit?: number, offset?: number) => Promise<unknown[]>

      /* 文件变动感知 */
      getFileChangeSummary: () => Promise<string | null>
      toggleFileWatcher: (enabled: boolean) => Promise<void>

      /* Claude Code CLI 配置读取 */
      readClaudeConfig: () => Promise<{
        env?: {
          ANTHROPIC_BASE_URL?: string
          ANTHROPIC_AUTH_TOKEN?: string
          ANTHROPIC_API_KEY?: string
          ANTHROPIC_MODEL?: string
          [key: string]: string | undefined
        }
        [key: string]: unknown
      } | null>
    }
  }
}
