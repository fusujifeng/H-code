import { useEffect, useRef } from 'react'
import { useAppStore } from './stores/app-store'
import MainLayout from './components/MainLayout'
import FloatBall from './components/FloatBall'

export default function App() {
  const theme = useAppStore((s) => s.theme)
  const setUpdateStatus = useAppStore((s) => s.setUpdateStatus)
  const setUpdateProgress = useAppStore((s) => s.setUpdateProgress)
  const setUpdateError = useAppStore((s) => s.setUpdateError)
  const updateTask = useAppStore((s) => s.updateTask)
  const setQueueStatus = useAppStore((s) => s.setQueueStatus)
  const setTasks = useAppStore((s) => s.setTasks)
  const setCurrentTaskId = useAppStore((s) => s.setCurrentTaskId)
  const addMessage = useAppStore((s) => s.addMessage)
  const updateMessage = useAppStore((s) => s.updateMessage)
  const activeSessionId = useAppStore((s) => s.activeSessionId)
  const fileWatcherEnabled = useAppStore((s) => s.fileWatcherEnabled)
  const currentTaskIdRef = useRef<number | null>(null)
  const assistantIdRef = useRef<string | null>(null)
  const fullContentRef = useRef('')
  const activeSessionIdRef = useRef(activeSessionId)
  activeSessionIdRef.current = activeSessionId

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  // 监听主进程的更新事件
  useEffect(() => {
    const unsubStatus = window.electronAPI?.onUpdateStatus((status) => {
      if (status === 'available') setUpdateStatus('available')
      else if (status === 'not-available') setUpdateStatus('not-available')
      else if (status === 'checking') setUpdateStatus('checking')
      else if (status === 'downloaded') setUpdateStatus('downloaded')
    })

    const unsubProgress = window.electronAPI?.onUpdateProgress((percent) => {
      setUpdateStatus('downloading')
      setUpdateProgress(percent)
    })

    const unsubError = window.electronAPI?.onUpdateError((err) => {
      setUpdateStatus('error')
      setUpdateError(err)
    })

    return () => {
      unsubStatus?.()
      unsubProgress?.()
      unsubError?.()
    }
  }, [])

  // 初始化任务队列 & 文件监听
  useEffect(() => {
    // 加载已有任务
    window.electronAPI?.getTasks?.().then((tasks) => {
      setTasks(tasks as unknown as ReturnType<typeof useAppStore.getState>['tasks'])
    })

    // 监听任务更新
    const unsubTaskUpdated = window.electronAPI?.onTaskUpdated((task) => {
      updateTask(task as unknown as ReturnType<typeof useAppStore.getState>['tasks'][number])
    })

    const unsubQueueStatus = window.electronAPI?.onQueueStatus((status) => {
      setQueueStatus(status)
    })

    // 监听任务执行指令，自动创建消息并调用 Claude
    const unsubTaskExecute = window.electronAPI?.onTaskExecute((payload) => {
      currentTaskIdRef.current = payload.taskId
      setCurrentTaskId(payload.taskId)

      const sessionId = payload.conversationId || activeSessionIdRef.current || 'default'

      // 创建用户消息
      addMessage({
        id: `task-user-${payload.taskId}`,
        role: 'user',
        content: payload.prompt,
        timestamp: new Date().toISOString(),
        sessionId
      })

      // 创建 assistant 占位消息
      const assistantId = `task-assistant-${payload.taskId}`
      assistantIdRef.current = assistantId
      fullContentRef.current = ''
      addMessage({
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
        model: 'Claude Code CLI',
        sessionId
      })

      window.electronAPI?.sendToClaude(payload.prompt)
    })

    // 监听 CLI 输出，更新任务消息
    const unsubOutput = window.electronAPI?.onClaudeOutput((data: string) => {
      if (assistantIdRef.current) {
        fullContentRef.current += data
        updateMessage(assistantIdRef.current, { content: fullContentRef.current })
      }
    })

    const unsubError = window.electronAPI?.onClaudeError((err: string) => {
      if (assistantIdRef.current) {
        fullContentRef.current += err
        updateMessage(assistantIdRef.current, { content: fullContentRef.current })
      }
    })

    // 监听 CLI 完成，自动完成任务
    const unsubClaudeClose = window.electronAPI?.onClaudeClose((code) => {
      const taskId = currentTaskIdRef.current
      if (taskId !== null) {
        if (code !== 0 && code !== null) {
          fullContentRef.current += `\n[进程退出码: ${code}]`
          if (assistantIdRef.current) {
            updateMessage(assistantIdRef.current, { content: fullContentRef.current })
          }
          window.electronAPI?.failTask?.(taskId, `退出码: ${code}`)
        } else {
          window.electronAPI?.completeTask?.(taskId, fullContentRef.current)
        }
        currentTaskIdRef.current = null
        assistantIdRef.current = null
        fullContentRef.current = ''
        setCurrentTaskId(null)
      }
    })

    // 初始化文件监听
    if (fileWatcherEnabled) {
      window.electronAPI?.toggleFileWatcher?.(true)
    }

    return () => {
      unsubTaskUpdated?.()
      unsubQueueStatus?.()
      unsubTaskExecute?.()
      unsubOutput?.()
      unsubError?.()
      unsubClaudeClose?.()
    }
  }, [])

  return (
    <div
      style={{
        height: '100vh',
        width: '100vw',
        display: 'flex',
        background: 'var(--bg)',
        color: 'var(--text)',
        overflow: 'hidden'
      }}
    >
      <MainLayout />
      <FloatBall />
    </div>
  )
}
