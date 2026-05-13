import { useState, useEffect } from 'react'
import { useAppStore, type BalanceInfo } from '../stores/app-store'
import { ReloadOutlined } from '@ant-design/icons'

export default function BalanceQuery() {
  const balances = useAppStore((s) => s.balances)
  const models = useAppStore((s) => s.models)
  const updateBalance = useAppStore((s) => s.updateBalance)
  const [refreshing, setRefreshing] = useState(false)

  // 进入页面自动查询一次
  useEffect(() => {
    handleRefresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const deepseekIcon = '../assets/moymelr2-image.png'

  const handleRefresh = async () => {
    setRefreshing(true)
    balances.forEach((b) => {
      updateBalance(b.id, { status: 'loading', amount: '...' })
    })

    // DeepSeek 真实余额查询
    const deepseekModel = models.find((m) => m.provider === 'DeepSeek' && m.enabled)
    let apiKey = deepseekModel?.apiKey

    // 如果模型配置中没有 Key，尝试从 Claude Code CLI 配置读取
    if (!apiKey) {
      try {
        const claudeConfig = await window.electronAPI?.readClaudeConfig?.()
        if (claudeConfig?.env?.ANTHROPIC_AUTH_TOKEN) {
          apiKey = claudeConfig.env.ANTHROPIC_AUTH_TOKEN
        } else if (claudeConfig?.env?.ANTHROPIC_API_KEY) {
          apiKey = claudeConfig.env.ANTHROPIC_API_KEY
        }
      } catch { /* ignore */ }
    }

    if (apiKey) {
      try {
        const res = await fetch('https://api.deepseek.com/user/balance', {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: 'application/json'
          }
        })
        const data = await res.json()
        if (data.is_available && data.balance_infos?.length > 0) {
          const info = data.balance_infos[0]
          const mask = apiKey.length > 8 ? `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}` : '****'
          updateBalance('1', {
            status: 'ok',
            amount: `¥${info.total_balance}`,
            keyMask: mask,
            currency: info.currency || 'CNY',
            lastUpdated: new Date().toLocaleString('zh-CN', {
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit'
            })
          })
        } else {
          updateBalance('1', { status: 'failed', amount: '查询失败' })
        }
      } catch (e) {
        updateBalance('1', { status: 'failed', amount: '网络错误' })
      }
    } else {
      updateBalance('1', { status: 'failed', amount: '未配置 API Key' })
    }

    // 其他模型保持模拟（暂无真实接口）
    setTimeout(() => {
      updateBalance('2', {
        status: 'ok',
        amount: '$12.45',
        lastUpdated: new Date().toLocaleString('zh-CN', {
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        })
      })
      updateBalance('3', { status: 'failed', amount: '--' })
      setRefreshing(false)
    }, 600)
  }

  const getStatusLabel = (status: BalanceInfo['status']) => {
    switch (status) {
      case 'ok':
        return { text: '正常', color: 'var(--green)', bg: 'var(--green-light)' }
      case 'failed':
        return { text: '查询失败', color: 'var(--red)', bg: 'var(--red-light)' }
      case 'loading':
        return { text: '查询中', color: 'var(--text-tertiary)', bg: 'var(--surface-hover)' }
    }
  }

  const getModelIcon = (balance: BalanceInfo) => {
    if (balance.provider === 'DeepSeek') {
      return (
        <img
          src={deepseekIcon}
          alt="DeepSeek"
          style={{ width: 36, height: 36, borderRadius: '50%' }}
          onError={(e) => {
            const el = e.target as HTMLImageElement
            el.style.display = 'none'
            const parent = el.parentElement
            if (parent) {
              parent.style.background = 'var(--blue-light)'
              parent.style.color = 'var(--blue)'
              parent.textContent = balance.modelName.charAt(0)
            }
          }}
        />
      )
    }
    const colors: Record<string, string> = {
      OpenAI: '#10a37f',
      Anthropic: '#d97757',
      Google: '#4285f4',
      Mistral: '#f59e0b'
    }
    return (
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: colors[balance.provider] || 'var(--blue)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 16,
          fontWeight: 700
        }}
      >
        {balance.modelName.charAt(0)}
      </div>
    )
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Refresh button */}
      <div style={{ padding: '12px 16px', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          style={{
            padding: '6px 14px',
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            color: 'var(--text)',
            fontWeight: 500,
            fontSize: 13,
            cursor: refreshing ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            opacity: refreshing ? 0.6 : 1
          }}
        >
          <ReloadOutlined style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          刷新
        </button>
      </div>

      {/* Balance cards */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 12px' }}>
        {balances.map((balance) => {
          const status = getStatusLabel(balance.status)
          return (
            <div
              key={balance.id}
              style={{
                padding: '12px 14px',
                borderRadius: 10,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                marginBottom: 8,
                boxShadow: 'var(--shadow)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {getModelIcon(balance)}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                    {balance.modelName}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                    {balance.provider} · {balance.keyMask} · {balance.lastUpdated}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      color:
                        balance.status === 'ok'
                          ? 'var(--green)'
                          : balance.status === 'failed'
                            ? 'var(--red)'
                            : 'var(--text-tertiary)'
                    }}
                  >
                    {balance.amount}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      padding: '2px 7px',
                      borderRadius: 4,
                      background: status.bg,
                      color: status.color,
                      fontWeight: 600,
                      display: 'inline-block',
                      marginTop: 2
                    }}
                  >
                    {status.text}
                  </div>
                </div>
              </div>


            </div>
          )
        })}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
