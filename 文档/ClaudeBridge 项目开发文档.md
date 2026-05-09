ClaudeBridge 项目开发文档
文档目的
为 Claude Code CLI 的 DeepSeek V4 Pro 模型提供完整的项目开发指引，使其能够独立完成 ClaudeBridge 桌面应用的编码任务。

1. 项目概述
项目名称: ClaudeBridge
项目类型: Electron 桌面应用
核心定位: 多模型 AI 任务协作的桌面指挥中心。用户通过自然语言与 AI 对话，AI 负责所有代码的编写、修改和执行，用户不触碰代码编辑器（Vibe Coding 模式）。

关键能力:

任务队列（FIFO，支持暂停/恢复/取消）

会话管理（多会话上下文保持）

历史记录本地持久化（SQLite）

文件变动感知与快照保护

悬浮球后台运行

余额查询

多模型流水线（GPT 规划 → DeepSeek 执行 → GPT 审查）

权限模式切换（YOLO / 信任编辑 / 计划模式 / 手动确认）

2. 技术栈
层级	技术选型	说明
桌面框架	Electron 28+	主进程 Node.js 环境
包管理器	pnpm	快速、严格依赖管理
开发语言	TypeScript (全栈)	类型安全
UI 框架	React 18	渲染进程
UI 组件库	Ant Design X v2	AI 专用组件 (Bubble, Sender, Conversations 等)
样式方案	Tailwind CSS + Ant Design Token	辅助布局与间距，主样式由 Ant Design 驱动
状态管理	Zustand	轻量、跨组件状态
本地数据库	better-sqlite3	嵌入式，零配置
CLI 通信	child_process.spawn + JSON Stream	与 Claude Code CLI 交互
文件监听	chokidar	感知外部文件变动
自动更新	electron-updater	GitHub Releases 源
打包工具	electron-builder	多平台分发
代码规范	ESLint + Prettier	保证代码风格一致
3. 项目目录结构
text
claude-bridge/
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── electron.vite.config.ts
├── electron-builder.yml
├── .github/workflows/release.yml
├── src/
│   ├── main/                       # Electron 主进程
│   │   ├── index.ts                # 入口，窗口管理，服务初始化
│   │   ├── cli-manager.ts          # Claude Code CLI 进程管理
│   │   ├── task-queue.ts           # 任务队列管理器
│   │   ├── session-store.ts        # SQLite 数据库操作封装
│   │   ├── file-watcher.ts         # 文件变动感知 (chokidar)
│   │   ├── snapshot-manager.ts     # 文件快照
│   │   ├── balance-checker.ts      # 余额查询 (DeepSeek / SiliconFlow)
│   │   ├── float-ball.ts           # 悬浮球窗口创建与管理
│   │   ├── auto-updater.ts         # 自动更新
│   │   └── ipc-handlers.ts         # 注册所有 IPC 通道
│   ├── preload/
│   │   └── index.ts                # contextBridge 暴露安全 API
│   └── renderer/                   # React 渲染进程
│       ├── index.html
│       ├── main.tsx                # 入口
│       ├── App.tsx
│       ├── components/
│       │   ├── MainLayout.tsx      # 主窗口布局 (侧边栏 + 对话区)
│       │   ├── ChatView.tsx        # 对话气泡 + 输入区
│       │   ├── TaskQueuePanel.tsx   # 底部任务队列面板
│       │   ├── FloatBallUI.tsx     # 悬浮球渲染组件
│       │   ├── SettingsCenter.tsx  # 设置页面
│       │   ├── FunnyStatusBar.tsx  # 趣味状态条
│       │   └── PermissionToggle.tsx# 权限模式切换
│       ├── stores/
│       │   └── app-store.ts        # Zustand 全局状态
│       ├── hooks/
│       │   └── useCLIStream.ts     # 处理 CLI 流式数据
│       └── styles/
│           └── index.css           # Tailwind 导入
└── resources/                      # 应用图标等静态资源
4. 数据设计 (SQLite)
4.1 表结构
sql
-- 会话表
CREATE TABLE conversations (
    id TEXT PRIMARY KEY,                -- session-id
    title TEXT NOT NULL,                -- 自动根据首条消息生成
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 消息表
CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id TEXT NOT NULL REFERENCES conversations(id),
    role TEXT NOT NULL CHECK(role IN ('user','assistant','system')),
    content TEXT NOT NULL,
    model TEXT,                         -- 生成该消息的模型名称
    token_usage INTEGER,                -- 可选，token 消耗
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 任务表（记录队列执行的每个任务）
CREATE TABLE tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id TEXT,
    status TEXT NOT NULL CHECK(status IN ('queued','running','completed','failed')),
    pipeline_config TEXT,               -- JSON 格式，多模型配置
    result TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    finished_at DATETIME
);

-- 文件快照记录
CREATE TABLE snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER REFERENCES tasks(id),
    file_path TEXT NOT NULL,
    snapshot_path TEXT NOT NULL,        -- 快照文件存储位置
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
5. 核心模块实现指引
5.1 主进程入口 (src/main/index.ts)
职责:

创建主窗口和悬浮球窗口

初始化所有服务模块（CLI管理器、任务队列、会话存储、文件监听、快照管理器、余额查询、自动更新）

注册所有 IPC 处理程序

处理 powerSaveBlocker 防止后台挂起

关键实现:

typescript
// 伪代码骨架
import { app, BrowserWindow, powerSaveBlocker } from 'electron';
import { createFloatBall } from './float-ball';
import { setupIPC } from './ipc-handlers';
// ... 其他模块引用

let mainWindow: BrowserWindow | null;
let floatBall: BrowserWindow | null;
let blockerId: number;

app.whenReady().then(() => {
  // 禁止后台节流
  app.commandLine.appendSwitch('disable-renderer-backgrounding');
  blockerId = powerSaveBlocker.start('prevent-app-suspension');
  
  mainWindow = new BrowserWindow({/* 主窗口配置 */});
  floatBall = createFloatBall(mainWindow);
  
  // 初始化各个服务并传递依赖
  const dependencies = { mainWindow, floatBall };
  setupIPC(dependencies);
  // ...
});

app.on('will-quit', () => {
  powerSaveBlocker.stop(blockerId);
});
5.2 CLI 管理器 (src/main/cli-manager.ts)
职责: 通过 child_process.spawn 启动 Claude Code CLI 子进程，利用 JSON 流进行双向通信。

关键细节:

启动命令: claude --dangerously-skip-permissions --input-format stream-json --output-format stream-json --session-id <id>

通过 stdin 发送用户消息，格式为 JSON.stringify({type:'user', message:{role:'user', content:[{type:'text', text:'...'}]}})\n

监听 stdout，按行解析 JSON 事件，将 AI 回复推送给渲染进程

提供 send(message: string) 和 stop() 方法

5.3 任务队列 (src/main/task-queue.ts)
职责: 实现 FIFO 任务队列，支持暂停/恢复/取消。

核心逻辑:

typescript
class TaskQueue {
  private queue: Task[] = [];
  private isProcessing = false;

  enqueue(task: Task) { this.queue.push(task); this.process(); }
  
  private async process() {
    if (this.isProcessing || this.queue.length === 0) return;
    this.isProcessing = true;
    const task = this.queue.find(t => t.status === 'queued');
    if (!task) return;
    
    task.status = 'running';
    // 1. 从文件监听器获取变动摘要
    // 2. 构建完整消息（摘要 + 用户原文）
    // 3. 调用 cliManager.send(fullMessage)
    // 4. 等待 CLI 结束信号（stop_reason 事件）
    // 5. 更新任务状态，写入数据库
    this.isProcessing = false;
    this.process(); // 继续下一个
  }
}
5.4 文件变动感知 (src/main/file-watcher.ts)
职责: 使用 chokidar 监听项目 src 目录，记录变动文件路径和时间戳，支持时间窗口过滤。

配置接口:

typescript
interface WatcherOptions {
  maxAgeMs: number;       // 默认 10800000 (3小时)
  maxChangeCount: number; // 默认 10
}
提供方法:

start(projectPath: string, options?: Partial<WatcherOptions>)

getSummary(): string | null 生成变动摘要文本，用于注入到任务提示中

5.5 会话存储 (src/main/session-store.ts)
职责: 封装 better-sqlite3 操作，提供以下方法：

createConversation(sessionId, title) → 返回会话对象

getAllConversations() → 返回所有会话列表

addMessage(conversationId, message)

getMessages(conversationId, limit?, offset?)

deleteConversation(id)

5.6 快照管理器 (src/main/snapshot-manager.ts)
职责: 在 CLI 执行文件修改前，复制目标文件到用户数据目录下的 snapshots/ 文件夹。

createSnapshot(filePath: string) → 返回快照路径

getSnapshots(taskId) → 按任务查询快照

cleanOldSnapshots(maxCount: number)

5.7 余额查询 (src/main/balance-checker.ts)
职责: 调用各平台 API 查询余额。

checkDeepSeekBalance(apiKey: string) → 访问 https://api.deepseek.com/user/balance

checkSiliconFlowBalance(apiKey: string) → 调用硅基流动接口（待定）

结果统一在设置页面展示

5.8 IPC 处理 (src/main/ipc-handlers.ts)
需要注册的频道 (使用 ipcMain.handle):

send-message：接收渲染进程的消息，加入队列

get-conversations：获取会话列表

get-messages：获取指定会话的消息

create-conversation：创建新会话

delete-conversation：删除会话

pause-task / resume-task / cancel-task：任务控制

get-file-change-summary：获取变动摘要

check-balance：查询余额

get-settings / update-settings：设置操作

预加载脚本 (src/preload/index.ts):
通过 contextBridge.exposeInMainWorld 暴露以上频道，确保渲染进程可以安全调用。

5.9 悬浮球窗口 (src/main/float-ball.ts)
职责: 创建一个 64x64 的无边框、置顶窗口，在 Windows/macOS 上显示任务状态。

关键特性:

监听主窗口的 minimize 事件，隐藏主窗口并显示悬浮球

悬浮球 click 事件：恢复主窗口并隐藏自己

通过 IPC 接收任务状态更新，更新 UI（进度环、数字）

提供右键菜单（打开、暂停、退出等）

支持拖拽移动，保存位置到设置

6. 渲染进程 (React) 关键组件
6.1 整体布局 (MainLayout.tsx)
text
┌──────────────────────────────────────┐
│ 菜单栏 / 状态栏                      │
├───────────┬──────────────────────────┤
│ 会话列表  │  对话区域                │
│ (240px)   │   - 趣味状态条           │
│           │   - Bubble.List          │
│           │   - Sender 输入框        │
├───────────┴──────────────────────────┤
│ 任务队列面板 (可折叠)                │
└──────────────────────────────────────┘
6.2 对话视图 (ChatView.tsx)
使用 Ant Design X 组件：

tsx
import { Bubble, Sender, Conversations, ThoughtChain, XMarkdown } from '@ant-design/x';
import { useXChat, useXConversations } from '@ant-design/x-sdk';

function ChatView() {
  const { conversations, activeKey } = useXConversations();
  const { messages, onRequest, loading } = useXChat({
    // 自定义 provider，通过 IPC 发送消息
    provider: async (message) => {
      return await window.electronAPI.sendMessage(message);
    }
  });

  return (
    <div className="flex h-full">
      <Conversations items={conversations} activeKey={activeKey} style={{ width: 240 }} />
      <div className="flex-1 flex flex-col">
        <Bubble.List
          items={messages.map(msg => ({
            key: msg.id,
            placement: msg.role === 'user' ? 'end' : 'start',
            contentRender: (content) => <XMarkdown content={content} />,
          }))}
        />
        <Sender onSubmit={onRequest} loading={loading} />
      </div>
    </div>
  );
}
6.3 任务队列面板 (TaskQueuePanel.tsx)
展示任务状态列表，提供暂停、恢复、取消按钮。使用 Tabs 或手风琴布局展示不同状态的任务。

6.4 趣味状态条 (FunnyStatusBar.tsx)
根据任务状态从预设短语库随机抽取一句显示，使用 Alert 组件，仅在设置开启时显示。

6.5 设置中心 (SettingsCenter.tsx)
侧边导航 + 内容区域的布局，包含以下设置分组：

常规 (启动行为、最小化行为)

悬浮球 (完成行为、闪烁时长、尺寸)

权限 (默认权限模式)

模型 (API Key 配置)

余额 (查询与展示)

文件感知 (时间窗口、范围)

趣味模式 (开关)

关于 (版本、更新)

7. 状态管理 (Zustand)
定义全局 Store：

typescript
import create from 'zustand';

interface AppState {
  conversations: Conversation[];
  activeSessionId: string | null;
  tasks: Task[];
  queueStatus: { total: number; active: number };
  floatStatus: 'idle' | 'running' | 'completed' | 'error';
  funnyMode: boolean;
  // ... setter 方法
}
8. 开发启动流程
使用 pnpm 初始化项目：

bash
pnpm create electron-vite@latest claude-bridge -- --template react-ts
cd claude-bridge
pnpm install
安装必要依赖：

bash
pnpm add @ant-design/x @ant-design/x-sdk @ant-design/x-markdown antd @ant-design/icons better-sqlite3 chokidar electron-updater zustand
pnpm add -D @types/better-sqlite3 @types/chokidar
按上面的目录结构创建文件，从 main/index.ts 开始搭建主进程。

先实现 CLI 管理器和任务队列的基本通信，确保能够在对话界面发送消息并收到流式回复。

逐步集成会话存储、文件监听、悬浮球等模块。

使用 pnpm dev 运行开发环境测试。

9. 关键注意事项
JSON 流解析：CLI 输出的 JSON 可能跨多个 data 事件，需要缓冲并分割完整的行进行解析。

权限模式：启动 CLI 时通过参数 --dangerously-skip-permissions 或 --permission-mode 控制，并在设置中提供切换。

文件监听范围：仅监听项目源码目录，避免 node_modules 等大目录。

快照存储：快照文件保存在 app.getPath('userData')/snapshots/ 下，定期清理。

跨平台打包：Windows 下生成 .exe，macOS 下可借助同事或 GitHub Actions 生成 .dmg；若未签名需手动授权。

10. 下一步行动
开始编写 src/main/index.ts，搭建基础 Electron 窗口和 IPC 通信框架，然后依次实现 CLI 管理器和任务队列。遇到具体 API 或配置问题，可随时查阅 Electron 和 Ant Design X 官方文档。

