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
    }
  }
}
