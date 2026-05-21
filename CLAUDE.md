# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev              # Start dev server (Vite HMR for renderer, electron-vite for main/preload)
pnpm build            # Production build
pnpm preview          # Preview production build
pnpm typecheck        # Run type checks on both node (main+preload) and web (renderer)
pnpm typecheck:node   # Type-check main + preload only
pnpm typecheck:web    # Type-check renderer only
pnpm lint             # ESLint with auto-fix
pnpm format           # Prettier format src/**/*.{ts,tsx,css,json}
```

## Architecture

Electron app that wraps the Claude Code CLI in a graphical interface. Three-process model via **electron-vite**:

- **Main** (`src/main/index.ts`): Window management (main + float ball), PTY sessions (node-pty), system tray, auto-updater, and all IPC handlers. `icon-generator.ts` generates a PNG tray icon programmatically at runtime.
- **Preload** (`src/preload/index.ts`): Exposes `window.electronAPI` via `contextBridge` — IPC bridge for renderer.
- **Renderer** (`src/renderer/`): React 18 + TypeScript UI with Ant Design and Tailwind CSS. Two entry points: `index.html` (main app) and `float-ball.html` (always-on-top floating widget).

### State management

Single zustand store in `src/renderer/stores/app-store.ts`. Manages: theme, sessions, messages, models, balances, split terminal sessions, history entries, and update state. Chat history is persisted to localStorage (14-day TTL, max 10 entries).

### Two chat execution paths

1. **Terminal mode** (default): Spawns Claude Code CLI inside a PTY via `node-pty`. Input goes to `writePty`, output comes back as raw terminal data. Multi-session support for split-pane terminals. Configured per-session via permission modes (yolo/trust-edit/plan/manual).
2. **API mode** (`src/renderer/api/ai-client.ts`): Direct HTTP streaming via SSE. Supports both OpenAI-compatible and Anthropic API formats. Selected by whether the enabled model's `baseUrl` contains `/anthropic`.

### Theme system

CSS custom properties (defined in `src/renderer/styles/themes.css`). Theme IDs: `antdx`, `blackgold`, `vscode`, `claude`, `trae`, `qoder`, `idea`. Tailwind's `preflight` is disabled; all colors use `var(--cb-*)` tokens.

### Key dependencies

- `@xterm/xterm` + `node-pty`: Embedded terminal emulation
- `antd` + `@ant-design/x`: UI components (ConfigProvider in main.tsx sets primary color and border radius)
- `zustand`: Global state
- `electron-updater`: Auto-update via GitHub Releases, checks every Friday at 10:00 Beijing time
- `better-sqlite3`: Available for local DB (imported but usage not yet active in current source)

## Data upgrade compatibility

This project releases frequently. When adding features that touch persisted data, **always** consider backward compatibility for upgrading users:

- **localStorage keys**: `cb-chat-history`, model configs, theme/preference settings stored via `loadSetting`/`saveSetting` in `app-store.ts`. Do not rename or change the shape of these keys without a migration path.
- **Model configs** (`models` array in store): persisted with `saveModels`/`loadModels`. Adding optional fields is safe; renaming or removing fields needs migration.
- **Chat history** (`HISTORY_KEY`): has 14-day TTL and max 10 entries, so breaking changes self-heal quickly and are generally acceptable without migration.
- When you must change a persisted format: read the old key first, transform the data, write back under the new key, and remove the old key.

## Code conventions

- No semicolons, single quotes, trailing commas: none (see `.prettierrc`)
- `@/` path alias resolves to `src/renderer/` (configured in both `electron.vite.config.ts` and `tsconfig.web.json`)
- CSS variables use `--cb-` prefix namespace; Tailwind `cb-*` color tokens map to these variables
- Window frame is hidden (`frame: false`), custom title bar handles drag regions via `WebkitAppRegion`
