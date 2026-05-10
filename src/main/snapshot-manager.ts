import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import { sessionStore } from './session-store'

class SnapshotManager {
  private snapshotDir: string

  constructor() {
    this.snapshotDir = app.isPackaged
      ? path.join(app.getPath('userData'), 'snapshots')
      : path.join(process.cwd(), 'snapshots')

    if (!fs.existsSync(this.snapshotDir)) {
      fs.mkdirSync(this.snapshotDir, { recursive: true })
    }
  }

  createSnapshot(filePath: string, taskId?: number): string {
    const timestamp = Date.now()
    const fileName = `${timestamp}_${path.basename(filePath)}`
    const snapshotPath = path.join(this.snapshotDir, fileName)

    if (fs.existsSync(filePath)) {
      fs.copyFileSync(filePath, snapshotPath)
    } else {
      fs.writeFileSync(snapshotPath, '', 'utf-8')
    }

    sessionStore.createSnapshot(taskId ?? null, filePath, snapshotPath)
    console.log('[SnapshotManager] created snapshot for', filePath, '→', snapshotPath)
    return snapshotPath
  }

  getSnapshots(taskId: number) {
    return sessionStore.getSnapshots(taskId)
  }

  cleanOldSnapshots(maxCount: number) {
    sessionStore.cleanOldSnapshots(maxCount)

    try {
      const files = fs.readdirSync(this.snapshotDir)
      const fileStats = files
        .map((f) => ({
          name: f,
          path: path.join(this.snapshotDir, f),
          mtime: fs.statSync(path.join(this.snapshotDir, f)).mtimeMs
        }))
        .sort((a, b) => b.mtime - a.mtime)

      const toDelete = fileStats.slice(maxCount)
      for (const file of toDelete) {
        try {
          fs.unlinkSync(file.path)
          console.log('[SnapshotManager] cleaned old snapshot', file.name)
        } catch (e) {
          console.error('[SnapshotManager] failed to delete', file.name, e)
        }
      }
    } catch (e) {
      console.error('[SnapshotManager] clean failed', e)
    }
  }
}

export const snapshotManager = new SnapshotManager()
