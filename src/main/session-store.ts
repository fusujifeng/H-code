import Database from 'better-sqlite3'
import path from 'path'
import { app } from 'electron'

export interface Conversation {
  id: string
  title: string
  createdAt: string
  updatedAt: string
}

export interface Message {
  id: number
  conversationId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  model?: string
  tokenUsage?: number
  timestamp: string
}

export interface Task {
  id: number
  conversationId: string | null
  status: 'queued' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'
  pipelineConfig: string | null
  result: string | null
  prompt: string
  createdAt: string
  finishedAt: string | null
}

export interface Snapshot {
  id: number
  taskId: number | null
  filePath: string
  snapshotPath: string
  createdAt: string
}

class SessionStore {
  private db: Database.Database

  constructor() {
    const dbPath = app.isPackaged
      ? path.join(app.getPath('userData'), 'h-code.db')
      : path.join(process.cwd(), 'h-code.db')

    this.db = new Database(dbPath)
    this.initTables()
  }

  private initTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id TEXT NOT NULL REFERENCES conversations(id),
        role TEXT NOT NULL CHECK(role IN ('user','assistant','system')),
        content TEXT NOT NULL,
        model TEXT,
        token_usage INTEGER,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id TEXT,
        status TEXT NOT NULL CHECK(status IN ('queued','running','paused','completed','failed','cancelled')),
        pipeline_config TEXT,
        result TEXT,
        prompt TEXT NOT NULL DEFAULT '',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        finished_at DATETIME
      );

      CREATE TABLE IF NOT EXISTS snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER REFERENCES tasks(id),
        file_path TEXT NOT NULL,
        snapshot_path TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `)
  }

  createConversation(id: string, title: string): Conversation {
    const now = new Date().toISOString()
    const stmt = this.db.prepare(
      'INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)'
    )
    stmt.run(id, title, now, now)
    return { id, title, createdAt: now, updatedAt: now }
  }

  getAllConversations(): Conversation[] {
    const stmt = this.db.prepare(
      'SELECT id, title, created_at as createdAt, updated_at as updatedAt FROM conversations ORDER BY updated_at DESC'
    )
    return stmt.all() as Conversation[]
  }

  updateConversationTime(id: string) {
    const stmt = this.db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?')
    stmt.run(new Date().toISOString(), id)
  }

  deleteConversation(id: string) {
    this.db.prepare('DELETE FROM messages WHERE conversation_id = ?').run(id)
    this.db.prepare('DELETE FROM tasks WHERE conversation_id = ?').run(id)
    this.db.prepare('DELETE FROM conversations WHERE id = ?').run(id)
  }

  addMessage(
    conversationId: string,
    message: Omit<Message, 'id' | 'timestamp' | 'conversationId'>
  ): Message {
    const stmt = this.db.prepare(
      'INSERT INTO messages (conversation_id, role, content, model, token_usage) VALUES (?, ?, ?, ?, ?)'
    )
    const result = stmt.run(
      conversationId,
      message.role,
      message.content,
      message.model ?? null,
      message.tokenUsage ?? null
    )
    this.updateConversationTime(conversationId)
    return {
      id: result.lastInsertRowid as number,
      conversationId,
      role: message.role,
      content: message.content,
      model: message.model,
      tokenUsage: message.tokenUsage,
      timestamp: new Date().toISOString()
    }
  }

  getMessages(conversationId: string, limit?: number, offset?: number): Message[] {
    let sql =
      'SELECT id, conversation_id as conversationId, role, content, model, token_usage as tokenUsage, timestamp FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC'
    const params: (string | number)[] = [conversationId]
    if (limit !== undefined) {
      sql += ' LIMIT ?'
      params.push(limit)
      if (offset !== undefined) {
        sql += ' OFFSET ?'
        params.push(offset)
      }
    }
    const stmt = this.db.prepare(sql)
    return stmt.all(...params) as Message[]
  }

  createTask(
    conversationId: string | null,
    prompt: string,
    pipelineConfig?: object
  ): Task {
    const stmt = this.db.prepare(
      'INSERT INTO tasks (conversation_id, status, pipeline_config, prompt) VALUES (?, ?, ?, ?)'
    )
    const result = stmt.run(
      conversationId,
      'queued',
      pipelineConfig ? JSON.stringify(pipelineConfig) : null,
      prompt
    )
    return {
      id: result.lastInsertRowid as number,
      conversationId,
      status: 'queued',
      pipelineConfig: pipelineConfig ? JSON.stringify(pipelineConfig) : null,
      result: null,
      prompt,
      createdAt: new Date().toISOString(),
      finishedAt: null
    }
  }

  getTasks(): Task[] {
    const stmt = this.db.prepare(
      'SELECT id, conversation_id as conversationId, status, pipeline_config as pipelineConfig, result, prompt, created_at as createdAt, finished_at as finishedAt FROM tasks ORDER BY created_at DESC'
    )
    return stmt.all() as Task[]
  }

  getTasksByConversation(conversationId: string): Task[] {
    const stmt = this.db.prepare(
      'SELECT id, conversation_id as conversationId, status, pipeline_config as pipelineConfig, result, prompt, created_at as createdAt, finished_at as finishedAt FROM tasks WHERE conversation_id = ? ORDER BY created_at DESC'
    )
    return stmt.all(conversationId) as Task[]
  }

  updateTaskStatus(id: number, status: Task['status'], result?: string) {
    const stmt = this.db.prepare(
      'UPDATE tasks SET status = ?, result = ?, finished_at = ? WHERE id = ?'
    )
    stmt.run(
      status,
      result ?? null,
      status === 'completed' || status === 'failed' || status === 'cancelled'
        ? new Date().toISOString()
        : null,
      id
    )
  }

  resetRunningTasks() {
    this.db.prepare(
      "UPDATE tasks SET status = 'queued', finished_at = NULL WHERE status = 'running'"
    ).run()
  }

  deleteTask(id: number) {
    this.db.prepare('DELETE FROM snapshots WHERE task_id = ?').run(id)
    this.db.prepare('DELETE FROM tasks WHERE id = ?').run(id)
  }

  createSnapshot(taskId: number | null, filePath: string, snapshotPath: string): Snapshot {
    const stmt = this.db.prepare(
      'INSERT INTO snapshots (task_id, file_path, snapshot_path) VALUES (?, ?, ?)'
    )
    const result = stmt.run(taskId, filePath, snapshotPath)
    return {
      id: result.lastInsertRowid as number,
      taskId,
      filePath,
      snapshotPath,
      createdAt: new Date().toISOString()
    }
  }

  getSnapshots(taskId: number): Snapshot[] {
    const stmt = this.db.prepare(
      'SELECT id, task_id as taskId, file_path as filePath, snapshot_path as snapshotPath, created_at as createdAt FROM snapshots WHERE task_id = ?'
    )
    return stmt.all(taskId) as Snapshot[]
  }

  cleanOldSnapshots(maxCount: number) {
    const stmt = this.db.prepare(
      'DELETE FROM snapshots WHERE id NOT IN (SELECT id FROM snapshots ORDER BY created_at DESC LIMIT ?)'
    )
    stmt.run(maxCount)
  }

  close() {
    this.db.close()
  }
}

export const sessionStore = new SessionStore()
