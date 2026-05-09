import { useState } from 'react'
import { useAppStore, type BalanceInfo } from '../stores/app-store'
import { ReloadOutlined } from '@ant-design/icons'

export default function BalanceQuery() {
  const balances = useAppStore((s) => s.balances)
  const updateBalance = useAppStore((s) => s.updateBalance)
  const [refreshing, setRefreshing] = useState(false)
  const deepseekIcon = '../assets/moymelr2-image.png'

  const handleRefresh = () => {
    setRefreshing(true)
    balances.forEach((b) => {
      updateBalance(b.id, { status: 'loading', amount: '...' })
    })

    setTimeout(() => {
      balances.forEach((b) => {
        if (b.id === '3') {
          updateBalance(b.id, { status: 'failed', amount: '--' })
        } else {
          const randomAmount = (Math.random() * 15 + 2).toFixed(2)
          const symbol = b.currency === 'EUR' ? '€' : b.currency === 'CNY' ? '¥' : '$'
          updateBalance(b.id, {
            status: 'ok',
            amount: `${symbol}${randomAmount}`,
            lastUpdated: new Date().toLocaleString('zh-CN', {
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit'
            })
          })
        }
      })
      setRefreshing(false)
    }, 1200)
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
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                boxShadow: 'var(--shadow)'
              }}
            >
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
          )
        })}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
