import { useState } from 'react'
import { useAppStore, type ModelConfig as ModelConfigType } from '../stores/app-store'
import { PlusOutlined, DeleteOutlined, EditOutlined, ThunderboltOutlined } from '@ant-design/icons'

export default function ModelConfig() {
  const models = useAppStore((s) => s.models)
  const toggleModel = useAppStore((s) => s.toggleModel)
  const [showForm, setShowForm] = useState(false)
  const [editingModel, setEditingModel] = useState<ModelConfigType | null>(null)
  const deepseekIcon = '../assets/moymelr2-image.png'

  const handleAdd = () => {
    setEditingModel(null)
    setShowForm(true)
  }

  const handleEdit = (model: ModelConfigType) => {
    setEditingModel(model)
    setShowForm(true)
  }

  const handleDeepSeekQuick = () => {
    const dsModel: ModelConfigType = {
      id: 'deepseek-' + Date.now(),
      name: 'DeepSeek-V4-Pro',
      provider: 'DeepSeek',
      enabled: true,
      baseUrl: 'https://api.deepseek.com/anthropic'
    }
    setEditingModel(dsModel)
    setShowForm(true)
  }

  const getModelIcon = (model: ModelConfigType) => {
    if (model.provider === 'DeepSeek') {
      return (
        <img
          src={deepseekIcon}
          alt="DeepSeek"
          style={{ width: 32, height: 32, borderRadius: '50%' }}
          onError={(e) => {
            const el = e.target as HTMLImageElement
            el.style.display = 'none'
            const parent = el.parentElement
            if (parent) {
              parent.style.background = 'var(--blue-light)'
              parent.style.color = 'var(--blue)'
              parent.textContent = model.name.charAt(0)
            }
          }}
        />
      )
    }
    const colors: Record<string, string> = {
      OpenAI: '#10a37f',
      Anthropic: '#d97757',
      Google: '#4285f4',
      Mistral: '#f59e0b',
      DeepSeek: '#4e9fdf',
      Cohere: '#6b4ce6',
      小米: '#ff6900'
    }
    return (
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: colors[model.provider] || 'var(--blue)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 15,
          fontWeight: 700
        }}
      >
        {model.name.charAt(0)}
      </div>
    )
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Action buttons */}
      <div style={{ padding: '12px 16px', display: 'flex', gap: 8 }}>
        <button
          onClick={handleAdd}
          style={{
            flex: 1,
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid var(--blue)',
            background: 'var(--blue-light)',
            color: 'var(--blue)',
            fontWeight: 600,
            fontSize: 13,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4
          }}
        >
          <PlusOutlined /> 添加模型
        </button>
        <button
          onClick={handleDeepSeekQuick}
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            color: 'var(--text)',
            fontWeight: 500,
            fontSize: 12,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4
          }}
        >
          <ThunderboltOutlined /> DeepSeek
        </button>
      </div>

      {/* Model list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 12px' }}>
        {models.map((model) => (
          <div
            key={model.id}
            style={{
              padding: '12px',
              borderRadius: 10,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              marginBottom: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              transition: 'box-shadow 0.15s',
              cursor: 'pointer'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = 'var(--shadow-md)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            {getModelIcon(model)}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                {model.name}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                {model.provider}
                {model.baseUrl && ` · ${model.baseUrl}`}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  fontSize: 10,
                  padding: '2px 7px',
                  borderRadius: 4,
                  background: model.enabled ? 'var(--green-light)' : 'var(--text-tertiary)',
                  color: model.enabled ? 'var(--green)' : 'var(--text-secondary)',
                  fontWeight: 600
                }}
              >
                {model.enabled ? '已启用' : '已禁用'}
              </span>
              <ToggleSwitch
                checked={model.enabled}
                onChange={() => toggleModel(model.id)}
              />
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleEdit(model)
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-tertiary)',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex'
                }}
              >
                <EditOutlined style={{ fontSize: 13 }} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                }}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--text-tertiary)',
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex'
                }}
              >
                <DeleteOutlined style={{ fontSize: 13 }} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <ModelFormModal
          model={editingModel}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  )
}

function ToggleSwitch({
  checked,
  onChange
}: {
  checked: boolean
  onChange: () => void
}) {
  return (
    <div
      onClick={(e) => {
        e.stopPropagation()
        onChange()
      }}
      style={{
        width: 36,
        height: 20,
        borderRadius: 10,
        background: checked ? 'var(--blue)' : 'var(--text-tertiary)',
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
          left: checked ? 18 : 2,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: '#fff',
          transition: 'left 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.15)'
        }}
      />
    </div>
  )
}

function ModelFormModal({
  model,
  onClose
}: {
  model: ModelConfigType | null
  onClose: () => void
}) {
  const models = useAppStore((s) => s.models)
  const setModels = useAppStore((s) => s.setModels)

  const [name, setName] = useState(model?.name || '')
  const [provider, setProvider] = useState(model?.provider || 'OpenAI')
  const [apiKey, setApiKey] = useState(model?.apiKey || '')
  const [baseUrl, setBaseUrl] = useState(model?.baseUrl || '')

  const handleSave = () => {
    const trimmedName = name.trim()
    if (!trimmedName) return

    const newModel: ModelConfigType = {
      id: model?.id || 'model-' + Date.now(),
      name: trimmedName,
      provider,
      apiKey: apiKey.trim() || undefined,
      baseUrl: baseUrl.trim() || undefined,
      enabled: model?.enabled ?? false
    }

    if (model) {
      // 编辑：替换原有模型
      setModels(models.map((m) => (m.id === model.id ? newModel : m)))
    } else {
      // 新增：追加到列表
      setModels([...models, newModel])
    }
    onClose()
  }

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.3)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      />
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 101,
          width: 360,
          background: 'var(--surface)',
          borderRadius: 12,
          padding: 24,
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--border)'
        }}
      >
        <div
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: 'var(--text)',
            marginBottom: 20
          }}
        >
          {model ? '编辑模型' : '添加模型'}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <FormField label="模型名称">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="输入模型名称"
              style={inputStyle}
            />
          </FormField>
          <FormField label="Provider">
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              style={inputStyle}
            >
              {['OpenAI', 'Anthropic', 'Google', 'DeepSeek', 'Cohere', 'Mistral', '小米', '本地', '其他'].map(
                (p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                )
              )}
            </select>
          </FormField>
          <FormField label="API Key">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="输入 API Key"
              style={inputStyle}
            />
          </FormField>
          <FormField label="Base URL">
            <input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="输入 Base URL"
              style={inputStyle}
            />
          </FormField>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
            marginTop: 20
          }}
        >
          <button onClick={onClose} style={secondaryBtnStyle}>
            取消
          </button>
          <button onClick={handleSave} style={primaryBtnStyle}>
            保存
          </button>
        </div>
      </div>
    </>
  )
}

function FormField({
  label,
  children
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>
        {label}
      </span>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  padding: '8px 12px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--bg)',
  color: 'var(--text)',
  fontSize: 13,
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box'
}

const primaryBtnStyle: React.CSSProperties = {
  padding: '8px 20px',
  borderRadius: 8,
  border: 'none',
  background: 'var(--blue)',
  color: '#fff',
  fontWeight: 600,
  fontSize: 13,
  cursor: 'pointer'
}

const secondaryBtnStyle: React.CSSProperties = {
  padding: '8px 20px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text)',
  fontWeight: 500,
  fontSize: 13,
  cursor: 'pointer'
}
