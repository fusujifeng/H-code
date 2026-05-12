import { useAppStore } from '../stores/app-store'
import {
  SwapOutlined,
  BugOutlined,
  ExperimentOutlined,
  CodeOutlined
} from '@ant-design/icons'

const suggestions = [
  {
    icon: <SwapOutlined />,
    title: '切换项目语言',
    description: '将当前项目的编程语言从 JavaScript 切换到 TypeScript'
  },
  {
    icon: <BugOutlined />,
    title: '修复 UI 问题',
    description: '检查并修复界面中的布局错位和样式问题'
  },
  {
    icon: <ExperimentOutlined />,
    title: '生成单元测试',
    description: '为当前模块生成完整的单元测试用例'
  },
  {
    icon: <CodeOutlined />,
    title: '重构代码',
    description: '优化代码结构，提高可读性和可维护性'
  }
]

export default function WelcomeArea({ sessionId }: { sessionId: string }) {
  const addMessage = useAppStore((s) => s.addMessage)

  const handleSuggestionClick = (suggestion: (typeof suggestions)[0]) => {
    const userId = Date.now().toString()
    const assistantId = (Date.now() + 1).toString()

    addMessage({
      id: userId,
      role: 'user',
      content: suggestion.description,
      timestamp: new Date().toISOString(),
      sessionId
    })

    addMessage({
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      model: 'Claude Code CLI',
      sessionId
    })

    window.electronAPI?.sendToClaude?.(suggestion.description)
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        padding: '40px 20px'
      }}
    >
      {/* Sparkle Icon */}
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: 'var(--blue-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 20,
          position: 'relative',
          animation: 'breath 2s ease-in-out infinite'
        }}
      >
        {/* Glow */}
        <div
          style={{
            position: 'absolute',
            inset: -12,
            borderRadius: '50%',
            background:
              'radial-gradient(circle, var(--blue-glow), transparent 70%)',
            animation: 'breath 2s ease-in-out infinite'
          }}
        />
        <SparkleIcon />
      </div>

      {/* Title */}
      <h1
        style={{
          fontSize: 20,
          fontWeight: 600,
          color: 'var(--text)',
          marginBottom: 8,
          textAlign: 'center'
        }}
      >
        你好，我是 ClaudeBridge
      </h1>

      {/* Subtitle */}
      <p
        style={{
          fontSize: 14,
          color: 'var(--text-secondary)',
          marginBottom: 32,
          textAlign: 'center'
        }}
      >
        你的 AI 编码助手，随时为你执行任务
      </p>

      {/* Suggestion Cards */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          width: '100%',
          maxWidth: 420
        }}
      >
        {suggestions.map((s, i) => (
          <div
            key={i}
            onClick={() => handleSuggestionClick(s)}
            style={{
              padding: '12px 16px',
              borderRadius: 10,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              transition: 'box-shadow 0.15s, border-color 0.15s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = 'var(--shadow-md)'
              e.currentTarget.style.borderColor = 'var(--blue)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = 'none'
              e.currentTarget.style.borderColor = 'var(--border)'
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: 'var(--blue-light)',
                color: 'var(--blue)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 16,
                flexShrink: 0
              }}
            >
              {s.icon}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                {s.title}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 1 }}>
                {s.description}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SparkleIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 2L13.5 8.5L12 10L10.5 8.5L12 2Z"
        fill="var(--blue)"
        transform="translate(0,0)"
      />
      <path
        d="M12 14L13.5 20.5L12 22L10.5 20.5L12 14Z"
        fill="var(--blue)"
      />
      <path
        d="M2 12L8.5 10.5L10 12L8.5 13.5L2 12Z"
        fill="var(--blue)"
      />
      <path
        d="M14 12L20.5 10.5L22 12L20.5 13.5L14 12Z"
        fill="var(--blue)"
      />
      <circle cx="12" cy="12" r="2.5" fill="var(--blue)" />
    </svg>
  )
}
