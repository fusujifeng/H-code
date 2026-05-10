import { useMemo } from 'react'
import { useAppStore } from '../stores/app-store'

const funnyPhrases: Record<string, string[]> = {
  queued: [
    '任务正在排队，像极了周末的奶茶店...',
    '前方还有任务，AI 正在热身',
    '排队中，请保持耐心，好代码值得等待',
    '您的任务已取号，当前排队中'
  ],
  running: [
    'AI 正在疯狂敲代码，键盘都要冒烟了',
    '思考中... 可能比你想的还要深',
    '代码正在生成，coffee break 一下？',
    'AI 的大脑正在全速运转',
    '正在与 Claude 进行深度灵魂交流',
    '别催了，AI 也在 debug 呢'
  ],
  paused: [
    '任务已暂停，AI 去喝口水',
    '暂停中，随时可以继续',
    'AI 正在休息，按恢复让它继续',
    '中场休息，AI 需要充充电'
  ],
  completed: [
    '任务完成！又解决了一个 Bug',
    '搞定收工，代码已就位',
    'AI 表示这题太简单了',
    '完美交付，可以愉快地摸鱼了'
  ],
  failed: [
    '任务失败了，但别灰心，再来一次',
    '出错了，AI 也需要 debug',
    '失败是成功之母，重新排队试试吧',
    '这波操作有点迷，建议重试'
  ],
  cancelled: [
    '任务已取消，潇洒转身',
    '取消了，也许有更好的方案？',
    '任务已终止，AI 表示理解'
  ]
}

export default function FunnyStatusBar() {
  const funnyMode = useAppStore((s) => s.funnyMode)
  const tasks = useAppStore((s) => s.tasks)

  if (!funnyMode) return null

  const runningTask = tasks.find((t) => t.status === 'running')
  if (!runningTask) return null

  const phrase = useMemo(() => {
    const phrases = funnyPhrases[runningTask.status] || funnyPhrases.running
    const idx = Math.floor(Math.random() * phrases.length)
    return phrases[idx]
  }, [runningTask.id, runningTask.status])

  return (
    <div
      style={{
        padding: '6px 16px',
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        fontSize: 12,
        color: 'var(--text-secondary)',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        flexShrink: 0
      }}
    >
      <span style={{ fontSize: 14 }}>🤖</span>
      <span>{phrase}</span>
    </div>
  )
}
