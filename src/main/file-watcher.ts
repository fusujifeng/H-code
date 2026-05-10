import { watch, type FSWatcher } from 'chokidar'
import path from 'path'

export interface WatcherOptions {
  maxAgeMs: number
  maxChangeCount: number
}

interface FileChange {
  filePath: string
  timestamp: number
}

class FileWatcher {
  private watcher?: FSWatcher
  private changes: FileChange[] = []
  private options: WatcherOptions = {
    maxAgeMs: 3 * 60 * 60 * 1000, // 3小时
    maxChangeCount: 10
  }
  private projectPath: string = ''

  start(projectPath: string, options?: Partial<WatcherOptions>) {
    if (this.watcher) {
      this.watcher.close()
    }

    this.projectPath = projectPath
    if (options) {
      this.options = { ...this.options, ...options }
    }
    this.changes = []

    const watchPath = path.join(projectPath, 'src')

    this.watcher = watch(watchPath, {
      ignored: /(^|[\/\\])\../, // 忽略隐藏文件
      ignoreInitial: true,
      persistent: true,
      depth: 5
    })

    this.watcher.on('change', (filePath: string) => this.recordChange(filePath))
    this.watcher.on('add', (filePath: string) => this.recordChange(filePath))
    this.watcher.on('unlink', (filePath: string) => this.recordChange(filePath))

    console.log('[FileWatcher] watching', watchPath)
  }

  stop() {
    if (this.watcher) {
      this.watcher.close()
      this.watcher = undefined
      console.log('[FileWatcher] stopped')
    }
  }

  private recordChange(filePath: string) {
    const now = Date.now()
    this.changes = this.changes.filter((c) => now - c.timestamp < this.options.maxAgeMs)

    const existing = this.changes.find((c) => c.filePath === filePath)
    if (existing) {
      existing.timestamp = now
    } else {
      this.changes.push({ filePath, timestamp: now })
    }

    if (this.changes.length > this.options.maxChangeCount) {
      this.changes = this.changes.slice(-this.options.maxChangeCount)
    }
  }

  getSummary(): string | null {
    if (this.changes.length === 0) return null

    const now = Date.now()
    const recent = this.changes.filter((c) => now - c.timestamp < this.options.maxAgeMs)

    if (recent.length === 0) return null

    const lines = recent.map((c) => {
      const relPath = path.relative(this.projectPath, c.filePath)
      const minsAgo = Math.round((now - c.timestamp) / 60000)
      return `- ${relPath} (${minsAgo}分钟前)`
    })

    return `【文件变动摘要】\n${lines.join('\n')}`
  }

  isWatching(): boolean {
    return !!this.watcher
  }
}

export const fileWatcher = new FileWatcher()
