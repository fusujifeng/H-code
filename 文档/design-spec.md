# ClaudeBridge 设计规范文档

> 本规范基于原型文件 `claudebridge-antdx-2-2.html` 提取，供 React + TypeScript + Ant Design X + Tailwind CSS 工程化开发使用。

---

## 1. 项目概述

ClaudeBridge 是一款 AI 编码助手桌面应用，采用三栏式布局，参考 Ant Design X RICH 设计范式（唤醒 → 输入 → 生成 → 反馈）。

- **技术栈**：React 18 + TypeScript + Ant Design X + Tailwind CSS
- **构建工具**：Vite（推荐）
- **状态管理**：React Context + useReducer（或 Zustand）
- **持久化**：localStorage（主题、模型列表、余额数据）

---

## 2. 布局结构

### 2.1 三栏网格

```
+----------+---------------+---------------------------+
| 52px     | 260px         | 1fr (flex)                |
| LeftRail | MidPanel      | RightPanel                |
+----------+---------------+---------------------------+
```

| 区域 | 宽度 | 说明 |
|------|------|------|
| Left Rail | `52px` | 图标导航栏，固定宽度 |
| Mid Panel | `260px` | 会话列表 / 设置 / 模型配置 / 余额查询，可切换视图 |
| Right Panel | `1fr` | 聊天主界面（Header + Chat Scroll + Input Area） |

### 2.2 Left Rail 图标顺序（从上到下）

1. **CB Logo** — 应用标识，渐变背景
2. **Code** — 代码图标，active 态
3. **New Session** (+) — 新建会话
4. **Customize** (铅笔) — 自定义
5. **More** (三点) — 更多
6. 分隔线
7. **Sessions** (消息气泡) — 切换至会话列表，带未读红点
8. **模型** (层叠方块) — 切换至模型配置
9. **余额** ($) — 切换至余额查询
10. **Settings** (齿轮) — 切换至设置面板
11. 弹性占位
12. **用户头像** — "我"，圆形

### 2.3 响应式断点

| 断点 | 行为 |
|------|------|
| `<= 1023px` | 隐藏 Mid Panel（抽屉或悬浮处理） |
| `<= 640px` | 隐藏 Left Rail，底部 Tab 或汉堡菜单替代 |

---

## 3. 主题系统（7 套）

主题通过 CSS 变量动态注入 `:root`，**全部 7 套主题共享同一套变量名**，仅色值不同。

### 3.1 核心变量名

```css
--bg, --bg-elevated, --surface, --surface-hover
--border, --border-hover
--text, --text-secondary, --text-tertiary
--blue /* 主强调色 */, --blue-light, --blue-hover, --blue-glow, --blue-glow-lg
--green, --green-light
--yellow, --yellow-light
--red, --red-light
--shadow, --shadow-md, --shadow-lg
```

### 3.2 七套主题色值

#### ① 汇川蓝（默认）
```
--bg:           #f5f5f5
--bg-elevated:  #fafafa
--surface:      #ffffff
--surface-hover:#f5f5f5
--border:       #f0f0f0
--text:         rgba(0,0,0,0.88)
--text-secondary:rgba(0,0,0,0.45)
--blue:         #1677ff
--blue-light:   #e6f4ff
--blue-hover:   #4096ff
--green:        #52c41a
--yellow:       #faad14
--red:          #f5222d
--shadow:       0 2px 8px rgba(0,0,0,0.06)
--shadow-md:    0 4px 16px rgba(0,0,0,0.08)
--shadow-lg:    0 8px 32px rgba(0,0,0,0.1)
```

#### ② 至臻皮肤（黑金）
```
--bg:           #07070a
--bg-elevated:  #0e0e14
--surface:      #14141c
--surface-hover:#1c1c28
--border:       rgba(255,255,255,0.055)
--text:         #e6e4df
--text-secondary:#8a8594
--blue:         #c8a45c   /* 金色主色 */
--blue-light:   rgba(200,164,92,0.08)
--blue-hover:   #ddb978
--green:        #5acf7a
--yellow:       #e8c84a
--red:          #e86a6a
--shadow:       0 2px 8px rgba(0,0,0,0.4)
--shadow-md:    0 4px 16px rgba(0,0,0,0.5)
--shadow-lg:    0 8px 32px rgba(0,0,0,0.6)
```

#### ③ VS Code（深色）
```
--bg:           #2b2b2b
--bg-elevated:  #313335
--surface:      #3c3f41
--surface-hover:#45484a
--border:       #555555
--text:         #bbbbbb
--text-secondary:#a9b7c6
--blue:         #4e9fdf
--blue-light:   rgba(78,159,223,0.1)
--blue-hover:   #5aa8e6
--green:        #6a8759
--yellow:       #bbb529
--red:          #bc3f3c
--shadow:       0 2px 8px rgba(0,0,0,0.3)
--shadow-md:    0 4px 16px rgba(0,0,0,0.4)
--shadow-lg:    0 8px 32px rgba(0,0,0,0.5)
```

#### ④ Claude Code（暖橙）
```
--bg:           #faf9f7
--bg-elevated:  #f5f3ef
--surface:      #ffffff
--surface-hover:#f5f3ef
--border:       #edeae5
--text:         #1a1a1a
--text-secondary:#6b6b6b
--blue:         #d97757   /* 橙色主色 */
--blue-light:   #fdf2ed
--blue-hover:   #e08a6d
--green:        #2d8a4e
--yellow:       #b8860b
--red:          #c73e3e
--shadow:       0 2px 8px rgba(0,0,0,0.05)
--shadow-md:    0 4px 16px rgba(0,0,0,0.06)
--shadow-lg:    0 8px 32px rgba(0,0,0,0.08)
```

#### ⑤ TRAE（黑底绿光）
```
--bg:           #0d1117
--bg-elevated:  #161b22
--surface:      #1c2128
--surface-hover:#21262d
--border:       #30363d
--text:         #c9d1d9
--text-secondary:#8b949e
--blue:         #3ecf8e   /* 绿色主色 */
--blue-light:   rgba(62,207,142,0.1)
--blue-hover:   #4dd89a
--green:        #3ecf8e
--yellow:       #d29922
--red:          #f85149
--shadow:       0 2px 8px rgba(0,0,0,0.4)
--shadow-md:    0 4px 16px rgba(0,0,0,0.5)
--shadow-lg:    0 8px 32px rgba(0,0,0,0.6)
```

#### ⑥ Qoder（翠绿）
```
--bg:           #f8fafb
--bg-elevated:  #f0f4f5
--surface:      #ffffff
--surface-hover:#f0f4f5
--border:       #e8eef1
--text:         #1a2b3c
--text-secondary:#5a6b7c
--blue:         #00c853   /* 翠绿主色 */
--blue-light:   #e8f5e9
--blue-hover:   #00e676
--green:        #00c853
--yellow:       #ffab00
--red:          #ff1744
--shadow:       0 2px 8px rgba(0,0,0,0.05)
--shadow-md:    0 4px 16px rgba(0,0,0,0.06)
--shadow-lg:    0 8px 32px rgba(0,0,0,0.08)
```

#### ⑦ IDEA（深灰蓝）
```
--bg:           #1e1e2e
--bg-elevated:  #252830
--surface:      #2a2d38
--surface-hover:#323540
--border:       #3a3d4a
--text:         #d4d4d4
--text-secondary:#a0a0a0
--blue:         #4fc1ff   /* 亮蓝主色 */
--blue-light:   rgba(79,193,255,0.1)
--blue-hover:   #6fd1ff
--green:        #6a9955
--yellow:       #dcdcaa
--red:          #f44747
--shadow:       0 2px 8px rgba(0,0,0,0.4)
--shadow-md:    0 4px 16px rgba(0,0,0,0.5)
--shadow-lg:    0 8px 32px rgba(0,0,0,0.6)
```

### 3.3 主题切换组件

- 设置面板以 **2 列网格** 展示 7 张主题卡片
- 每张卡片：圆角矩形色块（36×36px，使用主题图片填充）+ 主题名称 + 描述
- 当前激活主题：`border: 2px solid var(--blue)` + `box-shadow: 0 0 0 3px var(--blue-glow)`
- 切换即时生效，持久化到 `localStorage('cb-theme')`

---

## 4. 消息气泡规范

### 4.1 对齐与宽度

- **全部左对齐**，不使用左右交替
- AI 和用户消息都从左侧开始
- 宽度：`calc(100% - 16px)`（两侧约 8px 呼吸边距）
- 通过背景色区分说话者

### 4.2 AI 气泡

```
background: var(--surface)
border: 1px solid var(--border)
box-shadow: 0 1px 4px rgba(0,0,0,0.04)
border-radius: 16px
padding: 14px 18px
```

- **头像**：28px 圆形，渐变背景 `linear-gradient(135deg, var(--blue), var(--blue-deep))`，白色四芒星 Sparkle SVG
- **名称**："ClaudeBridge"，`color: var(--blue)`，font-weight: 600
- **时间**：右侧，`color: var(--text-tertiary)`，font-size: 11px

### 4.3 用户气泡

```
background: var(--blue-light)
border: 1px solid var(--user-bubble-border, rgba(22,119,255,0.12))
border-radius: 16px
padding: 14px 18px
```

- **头像**：28px 圆形，背景 `var(--blue-light)`，文字 `var(--blue)`，显示"我"
- **名称**："你"，`color: var(--text)`
- **Hover 操作**：底部显示「编辑」「删除」按钮，opacity 0→1 过渡

### 4.4 消息操作栏（仅 AI 消息）

每条 AI 消息底部悬浮操作栏（hover 时显示）：
- 复制（点击后变「已复制」，2s 恢复）
- 重新生成
- 点赞 / 点踩（互斥选中态）

---

## 5. 核心页面

### 5.1 聊天主界面（RightPanel）

#### 顶部 Header（48px 高）
- 面包屑导航：`项目名 > 会话名`，使用 `>` 分隔
- 右侧：显示器图标（查看上下文）

#### 欢迎区（空会话时展示）
- **Sparkle 图标**：56px 容器，40px 四芒星 SVG，蓝色，呼吸动画（scale 1→1.12）
- **光晕**：径向渐变 `radial-gradient(circle, var(--blue-glow), transparent 70%)`，同步呼吸
- **标题**："你好，我是 ClaudeBridge"，font-size: 20px，font-weight: 600
- **副标题**："你的 AI 编码助手，随时为你执行任务"
- **推荐卡片**：4 张纵向排列，每张含图标 + 标题 + 描述
  - 切换项目语言 / 修复 UI 问题 / 生成单元测试 / 重构代码

#### 消息流（Chat Scroll）
- 支持的消息类型：
  - 纯文本
  - **代码块**（Mac 终端风格：红黄绿三圆点 + 文件名 + 复制按钮，暗色背景 `#1e1e2e`）
  - **Diff 视图**（add 绿底 / del 红底，行号左对齐）
  - **Alert 卡片**（warning 黄底 / error 红底）
  - **进度条**（步骤展示，百分比填充）
  - **思考过程**（可折叠展开，默认收起）

#### 输入区（底部）
- **输入框**：多行 textarea，placeholder "Type / for commands"，focus 时 `border-color: var(--blue)` + glow ring
- **工具栏**：
  - 左侧：上传图片、语音输入、停止生成（生成时显示）
  - 右侧：⌘K 快捷键提示、发送按钮（蓝色圆形箭头）
- **底部状态栏**：
  - 左：权限选择器（YOLO 等）+ 分隔线 + 新建会话按钮
  - 右：模型徽章（蓝色圆点 + 模型名称）

### 5.2 设置面板（MidPanel）

- **Header**：返回箭头 + "设置"标题
- **主题网格**：7 张卡片，2 列布局
- **其他设置**（卡片容器内）：
  - 自动保存对话历史
  - 显示消息时间戳
  - 代码块语法高亮
  - Markdown 实时渲染
  - 每项带 toggle-switch 开关

### 5.3 模型配置（MidPanel）

- **Header**：返回箭头 + "模型配置" + 右上角「添加模型」按钮 +「DeepSeek 快速配置」按钮
- **模型列表**：纵向卡片列表
  - 每张卡片：品牌色圆形图标（文字首字母或 DeepSeek 图片）+ 模型名称 + Provider/BaseURL 元信息 + 状态徽章 + 悬浮操作（编辑/删除）
  - 启用/禁用开关在卡片内
- **默认预设模型**：
  - GPT-4o（OpenAI，已启用）
  - Claude 3.5 Sonnet（Anthropic，已启用）
  - Gemini 1.5 Pro（Google，已禁用）
  - Mistral Large（Mistral，已启用）
  - DeepSeek-V3（DeepSeek，已禁用，baseURL 预填 `https://api.deepseek.com/v1`）
- **弹窗表单**（新增/编辑）：
  - 模型名称（输入框）
  - Provider（下拉选择：OpenAI / Anthropic / Google / DeepSeek / Cohere / Mistral / 本地 / 其他）
  - API Key（password 输入框，可选）
  - Base URL（输入框，可选）
  - 启用/禁用（toggle-switch）
- **DeepSeek 快速配置**：点击后若 DeepSeek 不存在则自动添加预设并打开编辑弹窗

### 5.4 余额查询（MidPanel）

- **Header**：返回箭头 + "余额查询" + 右上角「刷新」按钮
- **余额卡片列表**：每张卡片展示
  - 品牌色圆形图标（模型名称首字母或 DeepSeek 图片）
  - 模型名称
  - Provider · Key 掩码 · 最后更新时间
  - 余额金额（正常绿色 / 失败红色 / 查询中灰色）
  - 状态标签（绿色「正常」/ 红色「查询失败」/ 灰色「查询中」）
- **默认预设数据**：
  - GPT-4o — $12.45
  - Claude 3.5 Sonnet — $8.20
  - Gemini 1.5 Pro — 查询失败
  - Mistral Large — €3.15
  - DeepSeek-V3 — ¥5.80
- **刷新逻辑**：模拟刷新（loading → 随机更新余额，1.2s 延迟），持久化到 `localStorage('cb-balances')`

---

## 6. 权限系统

底部输入区左侧的权限选择器，4 种模式：

| 模式 | 颜色 | 行为 |
|------|------|------|
| **YOLO** | 红色 `#f5222d` | 跳过所有确认，直接全自动执行 |
| **信任编辑** | 绿色 `#52c41a` | 仅自动执行安全的文件编辑操作 |
| **计划模式** | 黄色 `#faad14` | 先展示执行计划，用户确认后才执行 |
| **手动确认** | 灰色 | 每一步都需用户手动确认 |

- 点击展开下拉菜单选择
- YOLO 模式下用户发送后直接执行，无弹窗
- 计划模式下弹出确认 Modal，显示命令内容和确认/取消按钮

---

## 7. 悬浮球（Floating Orb）

### 7.1 位置与外观
- 固定定位：右下角 `bottom: 90px; right: 36px`
- 尺寸：56×56px 白色圆形
- 背景：`var(--surface)`，边框 `1px solid var(--border)`
- 内部：26px 四芒星 Sparkle SVG

### 7.2 状态颜色（固定，不随主题切换）

| 状态 | 颜色 | 动画 | 说明 |
|------|------|------|------|
| **空闲** | 灰色 `#9ca3af` | 柔和呼吸（scale 1→1.15） | 无后台任务 |
| **进行中** | 蓝色 `#1677ff` | 活跃弹跳 | 任务执行中 |
| **成功** | 绿色 `#52c41a` | 闪耀旋转（scale+rotate+brightness） | 任务完成 |
| **需确认** | 金黄色 `#faad14` | 脉冲跳动 | 等待用户确认 |
| **出错** | 红色 `#f5222d` | 剧烈抖动 | 执行失败 |

### 7.3 交互
- 左键点击：循环切换 5 种状态（演示用，实际由应用状态驱动）
- 右键点击：展开菜单（打开主界面 / 暂停所有任务 / 显示余额 / 退出）
- 支持拖拽移动位置

---

## 8. Ant Design X 组件映射

| 原型元素 | Ant Design X 组件 | 备注 |
|----------|-------------------|------|
| 欢迎区 | `<Welcome>` | Sparkle 图标 + 推荐卡片 |
| AI 消息气泡 | `<Bubble>` | 带 avatar、header、footer（操作栏） |
| 用户消息气泡 | `<Bubble>` | placement="start"，自定义样式 |
| 输入框 | `<Sender>` | 底部输入，支持多行、附件、停止 |
| 推荐卡片 | `<Suggestion>` | 点击填充输入框 |
| 会话列表 | `<Conversations>` | 左侧 MidPanel 会话视图 |
| 思考过程 | `<Thinking>` 或自定义 Collapse | 可折叠展开 |
| 加载动画 | `<Loading>` 或自定义 dots | 三点弹跳 |

---

## 9. 交互规范

### 9.1 动画时序
- 消息入场：`0.3s cubic-bezier(0.22, 1, 0.36, 1)`，translateY(8px)→0
- Hover 过渡：`0.15s`
- 主题切换：即时（CSS 变量热更新）
- Modal 入场：`0.3s`，scale(0.95)→1 + opacity

### 9.2 圆角体系
- 小：`6px`（按钮、标签）
- 中：`8px`（输入框、卡片）
- 大：`12px`（代码块、弹窗）
- 超大：`16px`（消息气泡）

### 9.3 阴影体系
- `--shadow`: `0 2px 8px rgba(0,0,0,0.06)` — 卡片默认
- `--shadow-md`: `0 4px 16px rgba(0,0,0,0.08)` — 卡片 hover
- `--shadow-lg`: `0 8px 32px rgba(0,0,0,0.1)` — 弹窗、悬浮球

---

## 10. 资产文件清单

| 文件名 | 用途 | 使用位置 |
|--------|------|----------|
| `moyk5mua-image.png` | 汇川蓝主题图标 | 设置面板主题卡片 |
| `moyk03lm-image.png` | 至臻皮肤主题图标 | 设置面板主题卡片 |
| `moyjolfd-image.png` | VS Code 主题图标 | 设置面板主题卡片 |
| `moyjxlh2-image.png` | Claude Code 主题图标 | 设置面板主题卡片 |
| `moyk4jfw-image.png` | TRAE 主题图标 | 设置面板主题卡片 |
| `moyk7tec-image.png` | Qoder 主题图标 | 设置面板主题卡片 |
| `moyk4xi4-image.png` | IDEA 主题图标 | 设置面板主题卡片 |
| `moymelr2-image.png` | DeepSeek 图标 | 模型配置卡片、余额查询卡片 |

---

## 11. localStorage 数据键

| Key | 数据类型 | 说明 |
|-----|----------|------|
| `cb-theme` | `string` | 当前主题 ID（antdx/blackgold/jetbrains/claude/trae/qoder/idea） |
| `cb-models` | `JSON` | 模型配置数组 |
| `cb-balances` | `JSON` | 余额数据数组 |

---

## 12. 代码块语法高亮色（暗色背景）

用于 Mac 终端风格的代码块展示：

| Token | 颜色 |
|-------|------|
| 关键字 (kw) | `#ff7b72` |
| 函数 (fn) | `#d2a8ff` |
| 字符串 (str) | `#a5d6a7` |
| 数字 (num) | `#79c0ff` |
| 注释 (cm) | `#6e7681` italic |
| 类型 (type) | `#ffa657` |
| 背景 | `#1e1e2e` |
| 文字 | `#c8c4d4` |

---

*文档版本：v1.0 — 基于原型 `claudebridge-antdx-2-2.html`*
