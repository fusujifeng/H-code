import { BrowserWindow } from 'electron'
import { sessionStore, type Task } from './session-store'

class TaskQueue {
  private queue: Task[] = []
  private isProcessing = false
  private currentTaskId: number | null = null

  enqueue(conversationId: string | null, prompt: string, pipelineConfig?: object): Task {
    const task = sessionStore.createTask(conversationId, prompt, pipelineConfig)
    this.queue.push(task)
    this.broadcast('task-updated', task)
    this.broadcastQueueStatus()
    this.process()
    return task
  }

  pause(taskId: number): boolean {
    const task = this.queue.find((t) => t.id === taskId)
    if (!task) return false

    if (task.status === 'running') {
      task.status = 'paused'
      sessionStore.updateTaskStatus(taskId, 'paused')
      this.currentTaskId = null
      this.isProcessing = false
      this.broadcast('task-updated', task)
      this.broadcastQueueStatus()
      this.process()
      return true
    }
    if (task.status === 'queued') {
      task.status = 'paused'
      sessionStore.updateTaskStatus(taskId, 'paused')
      this.broadcast('task-updated', task)
      this.broadcastQueueStatus()
      return true
    }
    return false
  }

  resume(taskId: number): boolean {
    const task = this.queue.find((t) => t.id === taskId)
    if (!task || task.status !== 'paused') return false
    task.status = 'queued'
    sessionStore.updateTaskStatus(taskId, 'queued')
    this.broadcast('task-updated', task)
    this.broadcastQueueStatus()
    this.process()
    return true
  }

  cancel(taskId: number): boolean {
    const task = this.queue.find((t) => t.id === taskId)
    if (!task) return false
    const wasRunning = task.status === 'running'
    task.status = 'cancelled'
    sessionStore.updateTaskStatus(taskId, 'cancelled')
    if (wasRunning) {
      this.currentTaskId = null
      this.isProcessing = false
    }
    this.broadcast('task-updated', task)
    this.broadcastQueueStatus()
    if (wasRunning) {
      this.process()
    }
    return true
  }

  complete(taskId: number, result?: string): boolean {
    const task = this.queue.find((t) => t.id === taskId)
    if (!task || task.status !== 'running') return false
    task.status = 'completed'
    task.result = result || null
    sessionStore.updateTaskStatus(taskId, 'completed', result)
    this.currentTaskId = null
    this.isProcessing = false
    this.broadcast('task-updated', task)
    this.broadcastQueueStatus()
    this.process()
    return true
  }

  fail(taskId: number, error?: string): boolean {
    const task = this.queue.find((t) => t.id === taskId)
    if (!task || task.status !== 'running') return false
    task.status = 'failed'
    task.result = error || null
    sessionStore.updateTaskStatus(taskId, 'failed', error)
    this.currentTaskId = null
    this.isProcessing = false
    this.broadcast('task-updated', task)
    this.broadcastQueueStatus()
    this.process()
    return true
  }

  getTasks(): Task[] {
    const dbTasks = sessionStore.getTasks()
    const merged = dbTasks.map((dbTask) => {
      const memTask = this.queue.find((q) => q.id === dbTask.id)
      return memTask || dbTask
    })
    const memOnly = this.queue.filter((q) => !dbTasks.find((d) => d.id === q.id))
    return [...merged, ...memOnly]
  }

  getCurrentTaskId(): number | null {
    return this.currentTaskId
  }

  private process() {
    if (this.isProcessing) return
    const next = this.queue.find((t) => t.status === 'queued')
    if (!next) return

    this.isProcessing = true
    this.currentTaskId = next.id
    next.status = 'running'
    sessionStore.updateTaskStatus(next.id, 'running')
    this.broadcast('task-updated', next)
    this.broadcastQueueStatus()
    this.broadcast('task-execute', {
      taskId: next.id,
      conversationId: next.conversationId,
      prompt: next.prompt
    })
  }

  private broadcast(channel: string, ...args: unknown[]) {
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send(channel, ...args)
      }
    })
  }

  private broadcastQueueStatus() {
    const total = this.queue.length
    const active = this.queue.filter((t) => t.status === 'running').length
    this.broadcast('queue-status', { total, active })
  }
}

export const taskQueue = new TaskQueue()
