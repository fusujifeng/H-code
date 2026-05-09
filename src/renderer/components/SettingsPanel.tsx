import { useAppStore, type ThemeId } from '../stores/app-store'
import { ArrowLeftOutlined } from '@ant-design/icons'

interface ThemeCard {
  id: ThemeId
  name: string
  description: string
  image: string
}

const themeCards: ThemeCard[] = [
  {
    id: 'antdx',
    name: '汇川蓝',
    description: '清爽、专业的浅色主题',
    image: '../assets/moyk5mua-image.png'
  },
  {
    id: 'blackgold',
    name: '至臻皮肤',
    description: '黑金配色，高端质感',
    image: '../assets/moyk03lm-image.png'
  },
  {
    id: 'vscode',
    name: 'VS Code',
    description: '经典深色编辑器风格',
    image: '../assets/moyjtptb-image.png'
  },
  {
    id: 'claude',
    name: 'Claude Code',
    description: '温暖橙色，纸质感',
    image: '../assets/moyjqbvz-image.png'
  },
  {
    id: 'trae',
    name: 'TRAE',
    description: '黑底绿光，赛博风',
    image: '../assets/moyk4jfw-image.png'
  },
  {
    id: 'qoder',
    name: 'Qoder',
    description: '翠绿色主色，自然清新',
    image: '../assets/moyk7tec-image.png'
  },
  {
    id: 'idea',
    name: 'IDEA',
    description: '深灰蓝底，亮蓝强调',
    image: '../assets/moyk4xi4-image.png'
  }
]

export default function SettingsPanel() {
  const theme = useAppStore((s) => s.theme)
  const setTheme = useAppStore((s) => s.setTheme)
  const setMidPanelView = useAppStore((s) => s.setMidPanelView)

  return (
    <div style={{ height: '100%', overflowY: 'auto' }}>
      {/* Section: Themes */}
      <div style={{ padding: '12px 16px' }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            marginBottom: 10,
            letterSpacing: 0.5
          }}
        >
          主题
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 10
          }}
        >
          {themeCards.map((card) => (
            <div
              key={card.id}
              onClick={() => setTheme(card.id)}
              style={{
                padding: 10,
                borderRadius: 10,
                cursor: 'pointer',
                background: 'var(--surface)',
                border:
                  theme === card.id
                    ? '2px solid var(--blue)'
                    : '1px solid var(--border)',
                boxShadow:
                  theme === card.id ? '0 0 0 3px var(--blue-glow)' : 'var(--shadow)',
                transition: 'all 0.15s',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  overflow: 'hidden',
                  background: getThemePreviewBg(card.id),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <img
                  src={card.image}
                  alt={card.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onError={(e) => {
                    ;(e.target as HTMLImageElement).style.display = 'none'
                  }}
                />
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>
                  {card.name}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1 }}>
                  {card.description}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section: Other Settings */}
      <div style={{ padding: '12px 16px' }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            marginBottom: 10,
            letterSpacing: 0.5
          }}
        >
          其他设置
        </div>
        <div
          style={{
            background: 'var(--surface)',
            borderRadius: 10,
            border: '1px solid var(--border)',
            overflow: 'hidden'
          }}
        >
          {[
            { label: '自动保存对话历史', key: 'autoSave' },
            { label: '显示消息时间戳', key: 'showTimestamp' },
            { label: '代码块语法高亮', key: 'syntaxHighlight' },
            { label: 'Markdown 实时渲染', key: 'markdownRender' }
          ].map((item, index) => (
            <div
              key={item.key}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 14px',
                borderBottom:
                  index < 3 ? '1px solid var(--border)' : 'none'
              }}
            >
              <span style={{ fontSize: 13, color: 'var(--text)' }}>{item.label}</span>
              <ToggleSwitch defaultChecked={true} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function ToggleSwitch({ defaultChecked }: { defaultChecked: boolean }) {
  return (
    <div
      style={{
        width: 40,
        height: 22,
        borderRadius: 11,
        background: defaultChecked ? 'var(--blue)' : 'var(--text-tertiary)',
        cursor: 'pointer',
        position: 'relative',
        transition: 'background 0.2s',
        flexShrink: 0
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 2,
          left: defaultChecked ? 20 : 2,
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: '#fff',
          transition: 'left 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.15)'
        }}
      />
    </div>
  )
}

function getThemePreviewBg(themeId: ThemeId): string {
  const map: Record<ThemeId, string> = {
    antdx: '#f5f5f5',
    blackgold: '#14141c',
    vscode: '#3c3f41',
    claude: '#faf9f7',
    trae: '#1c2128',
    qoder: '#ffffff',
    idea: '#2a2d38'
  }
  return map[themeId] || '#f5f5f5'
}
