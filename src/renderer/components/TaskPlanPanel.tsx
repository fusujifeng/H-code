import { useState, useRef, useCallback, useEffect } from 'react'
import { useAppStore, type PlanStep } from '../stores/app-store'
import {
  CheckCircleOutlined,
  LoadingOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  CaretRightOutlined,
  PauseOutlined,
  ExpandOutlined,
  CompressOutlined,
  AuditOutlined
} from '@ant-design/icons'

const statusIcon: Record<PlanStep['status'], typeof CheckCircleOutlined> = {
  pending: ClockCircleOutlined,
  in_progress: LoadingOutlined,
  completed: CheckCircleOutlined,
  failed: CloseCircleOutlined
}

const statusColor: Record<PlanStep['status'], string> = {
  pending: 'var(--text-tertiary)',
  in_progress: 'var(--blue)',
  completed: 'var(--green)',
  failed: 'var(--red)'
}

const statusBg: Record<PlanStep['status'], string> = {
  pending: 'var(--bg)',
  in_progress: 'var(--blue-light)',
  completed: 'var(--green-light)',
  failed: 'var(--red-light)'
}

const statusLabel: Record<PlanStep['status'], string> = {
  pending: '待执行',
  in_progress: '执行中',
  completed: '已完成',
  failed: '失败'
}

export default function TaskPlanPanel() {
  const planSteps = useAppStore((s) => s.planSteps)
  const setPlanSteps = useAppStore((s) => s.setPlanSteps)
  const updatePlanStep = useAppStore((s) => s.updatePlanStep)
  const activeSessionId = useAppStore((s) => s.activeSessionId)
  const planContext = useAppStore((s) => s.planContext)
  const planningPhase = useAppStore((s) => s.planningPhase)
  const setPlanningPhase = useAppStore((s) => s.setPlanningPhase)
  const setPlanContext = useAppStore((s) => s.setPlanContext)

  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set())
  const runningStepRef = useRef<string | null>(null)
  const outputRefs = useRef<Map<string, string>>(new Map())
  const [outputVersions, setOutputVersions] = useState<Record<string, number>>({})

  const completedCount = planSteps.filter((s) => s.status === 'completed').length
  const failedCount = planSteps.filter((s) => s.status === 'failed').length
  const totalCount = planSteps.length
  const allDone = totalCount > 0 && (completedCount + failedCount) === totalCount
  const hasRunning = planSteps.some((s) => s.status === 'in_progress')

  /* ── 监听子 Agent 输出 ──────────────────────────────────── */
  const bumpOutput = useCallback((stepId: string) => {
    setOutputVersions((prev) => ({ ...prev, [stepId]: (prev[stepId] || 0) + 1 }))
  }, [])

  useEffect(() => {
    const unsubOutput = window.electronAPI?.onPlanStepOutput((stepId, data) => {
      const current = outputRefs.current.get(stepId) || ''
      outputRefs.current.set(stepId, current + data)
      bumpOutput(stepId)
      // 自动展开正在执行的 step
      setExpandedSteps((prev) => new Set(prev).add(stepId))
    })

    const unsubComplete = window.electronAPI?.onPlanStepComplete((stepId, exitCode, result) => {
      if (stepId === 'review-agent') {
        setPlanningPhase('done')
        updatePlanStep('review-agent', {
          status: exitCode === 0 ? 'completed' : 'failed',
          result: result.slice(-2000)
        })
        return
      }

      const success = exitCode === 0
      updatePlanStep(stepId, {
        status: success ? 'completed' : 'failed',
        result: success ? result.slice(-2000) : result.slice(-2000),
        error: success ? undefined : `退出码: ${exitCode}`
      })
      runningStepRef.current = null

      // 检查是否所有步骤完成
      const steps = useAppStore.getState().planSteps
      const done = steps.every((s) => s.status === 'completed' || s.status === 'failed')
      if (done && steps.length > 0) {
        setPlanningPhase('ready') // 可触发审查
      }
    })

    return () => { unsubOutput?.(); unsubComplete?.() }
  }, [])

  /* ── 执行单个步骤 ──────────────────────────────────────── */
  const executeStep = useCallback(async (step: PlanStep) => {
    if (runningStepRef.current) return
    runningStepRef.current = step.id

    updatePlanStep(step.id, { status: 'in_progress', result: undefined, error: undefined })
    outputRefs.current.set(step.id, '')
    setPlanningPhase('executing')

    await window.electronAPI?.executePlanStep(
      step.id,
      step.content,
      planContext || '执行以下任务步骤'
    )
  }, [planContext, updatePlanStep, setPlanningPhase])

  /* ── 取消执行 ──────────────────────────────────────────── */
  const cancelStep = useCallback(async (stepId: string) => {
    await window.electronAPI?.cancelPlanStep(stepId)
    updatePlanStep(stepId, { status: 'pending' })
    runningStepRef.current = null
  }, [updatePlanStep])

  /* ── 全部执行 ──────────────────────────────────────────── */
  const executeAll = useCallback(async () => {
    const pending = planSteps.filter((s) => s.status === 'pending')
    setPlanningPhase('executing')
    for (const step of pending) {
      if (step.status === 'completed') continue
      await new Promise<void>((resolve) => {
        // 监听完成事件继续下一步
        const unsub = window.electronAPI?.onPlanStepComplete((completedId) => {
          if (completedId === step.id) {
            unsub?.()
            resolve()
          }
        })
        executeStep(step)
      })
    }
  }, [planSteps, executeStep, setPlanningPhase])

  /* ── 主 Agent 审查 ──────────────────────────────────────── */
  const reviewAll = useCallback(async () => {
    setPlanningPhase('reviewing')
    const stepsJson = JSON.stringify(planSteps.map((s) => ({
      content: s.content,
      result: s.result,
      status: s.status
    })))
    updatePlanStep('review-agent', {
      id: 'review-agent',
      content: '主 Agent 审查',
      status: 'in_progress'
    })
    outputRefs.current.set('review-agent', '')
    await window.electronAPI?.reviewPlanSteps(stepsJson, planContext)
  }, [planSteps, planContext, updatePlanStep, setPlanningPhase])

  /* ── 刷新计划检测 ──────────────────────────────────────── */
  const handleRefresh = async () => {
    const sessionId = activeSessionId || 'legacy'
    try {
      const steps = await window.electronAPI?.detectPlanFromOutput?.(sessionId)
      if (steps && Array.isArray(steps)) {
        setPlanSteps(steps as PlanStep[])
        if (steps.length > 0) setPlanningPhase('ready')
      }
    } catch { /* ignore */ }
  }

  /* ── 空状态 ────────────────────────────────────────────── */
  if (planSteps.length === 0 && planningPhase === 'idle') {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          color: 'var(--text-tertiary)',
          fontSize: 13,
          gap: 12
        }}
      >
        <ClockCircleOutlined style={{ fontSize: 28, opacity: 0.3 }} />
        <div style={{ textAlign: 'center', lineHeight: 1.6 }}>
          暂无任务规划
          <br />
          <span style={{ fontSize: 11 }}>
            运行 Claude Code CLI 时将自动检测计划步骤
          </span>
        </div>
        <button
          onClick={handleRefresh}
          style={{
            marginTop: 4,
            padding: '4px 12px',
            borderRadius: 6,
            border: '1px solid var(--border)',
            background: 'var(--bg)',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: 11,
            display: 'flex',
            alignItems: 'center',
            gap: 4
          }}
        >
          <ReloadOutlined style={{ fontSize: 11 }} />
          手动检测
        </button>
      </div>
    )
  }

  /* ── 正常渲染 ──────────────────────────────────────────── */
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* 进度 + 操作栏 */}
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: totalCount > 0 ? 4 : 0, fontSize: 11, color: 'var(--text-secondary)' }}>
          <span>
            {planningPhase === 'planning' ? '规划中...' :
             planningPhase === 'executing' ? '执行中...' :
             planningPhase === 'reviewing' ? '审查中...' :
             planningPhase === 'done' ? '全部完成' :
             allDone ? '待审查' : '就绪'}
          </span>
          {totalCount > 0 && (
            <span>{completedCount}/{totalCount} 完成{ failedCount > 0 ? `, ${failedCount} 失败` : ''}</span>
          )}
        </div>
        {totalCount > 0 && (
          <div style={{ height: 3, borderRadius: 2, background: 'var(--border)', overflow: 'hidden', marginBottom: 6 }}>
            <div style={{
              height: '100%',
              width: `${(completedCount / totalCount) * 100}%`,
              background: failedCount > 0 ? 'var(--orange)' : 'var(--blue)',
              borderRadius: 2,
              transition: 'width 0.3s'
            }} />
          </div>
        )}
        {/* 操作按钮 */}
        <div style={{ display: 'flex', gap: 6 }}>
          {totalCount > 0 && !hasRunning && !allDone && (
            <button onClick={executeAll} style={actionBtnStyle('var(--blue)')}>
              <CaretRightOutlined style={{ fontSize: 10 }} />
              全部执行
            </button>
          )}
          {allDone && planningPhase !== 'reviewing' && planningPhase !== 'done' && (
            <button onClick={reviewAll} style={actionBtnStyle('var(--green)')}>
              <AuditOutlined style={{ fontSize: 10 }} />
              主 Agent 检查
            </button>
          )}
          {planningPhase === 'done' && (
            <span style={{ fontSize: 11, color: 'var(--green)' }}>审查通过</span>
          )}
        </div>
      </div>

      {/* 步骤列表 */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 12px' }}>
        {planSteps.map((step, idx) => {
          const Icon = statusIcon[step.status]
          const isExpanded = expandedSteps.has(step.id)
          const isRunning = step.status === 'in_progress'
          const output = outputRefs.current.get(step.id) || step.result || ''
          // 触发 outputVersions 更新重渲染
          void outputVersions[step.id]

          return (
            <div
              key={step.id}
              style={{
                padding: '6px 0',
                borderBottom: idx < planSteps.length - 1 ? '1px solid var(--border)' : 'none',
                fontSize: 12,
                lineHeight: 1.5
              }}
            >
              {/* 步骤行 */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{
                  flexShrink: 0, marginTop: 1,
                  color: statusColor[step.status],
                  display: 'flex', alignItems: 'center'
                }}>
                  <Icon style={{ fontSize: 13 }} spin={isRunning} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    color: step.status === 'completed' ? 'var(--text-tertiary)' :
                           step.status === 'failed' ? 'var(--red)' : 'var(--text)',
                    textDecoration: step.status === 'completed' ? 'line-through' : 'none',
                    wordBreak: 'break-word'
                  }}>
                    {step.content}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <span style={{
                      fontSize: 10, color: statusColor[step.status],
                      background: statusBg[step.status],
                      padding: '0 5px', borderRadius: 3
                    }}>
                      {statusLabel[step.status]}
                    </span>
                    {/* 操作按钮 */}
                    {step.status === 'pending' && !hasRunning && (
                      <button
                        onClick={() => executeStep(step)}
                        style={miniBtnStyle('var(--blue)')}
                        title="执行此步骤"
                      >
                        <CaretRightOutlined style={{ fontSize: 10 }} /> 执行
                      </button>
                    )}
                    {isRunning && (
                      <button
                        onClick={() => cancelStep(step.id)}
                        style={miniBtnStyle('var(--red)')}
                        title="取消执行"
                      >
                        <PauseOutlined style={{ fontSize: 10 }} /> 取消
                      </button>
                    )}
                    {(output || isRunning) && (
                      <button
                        onClick={() => {
                          setExpandedSteps((prev) => {
                            const next = new Set(prev)
                            if (next.has(step.id)) next.delete(step.id)
                            else next.add(step.id)
                            return next
                          })
                        }}
                        style={miniBtnStyle('var(--text-tertiary)')}
                        title={isExpanded ? '收起输出' : '查看输出'}
                      >
                        {isExpanded ? <CompressOutlined style={{ fontSize: 10 }} /> : <ExpandOutlined style={{ fontSize: 10 }} />}
                        {isExpanded ? '收起' : '输出'}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* 展开的输出区域 */}
              {isExpanded && (output || isRunning) && (
                <div style={{
                  marginTop: 6,
                  marginLeft: 21,
                  padding: '6px 8px',
                  background: 'var(--bg)',
                  borderRadius: 6,
                  border: '1px solid var(--border)',
                  maxHeight: 180,
                  overflowY: 'auto',
                  fontFamily: 'monospace',
                  fontSize: 10,
                  color: 'var(--text-secondary)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  lineHeight: 1.5
                }}>
                  {output || (isRunning && <LoadingOutlined spin style={{ fontSize: 11 }} />)}
                </div>
              )}
            </div>
          )
        })}

        {/* 审查 Agent 输出 */}
        {planSteps.length === 0 && planningPhase !== 'idle' && (
          <div style={{ padding: 12, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
            {planningPhase === 'planning' ? '正在生成任务规划...' :
             planningPhase === 'reviewing' ? '主 Agent 正在审查...' :
             planningPhase === 'done' ? '全部任务完成！' :
             '等待指令'}
          </div>
        )}
      </div>

      {/* 底部刷新 + 审查输出 */}
      <div style={{ flexShrink: 0 }}>

        {/* 审查 Agent 输出 */}
        {(planningPhase === 'reviewing' || planningPhase === 'done') && (
          <div style={{
            margin: '0 12px 6px',
            padding: '8px 10px',
            background: 'var(--bg)',
            borderRadius: 6,
            border: `1px solid ${planningPhase === 'done' ? 'var(--green)' : 'var(--blue)'}`,
            maxHeight: 160,
            overflowY: 'auto',
            fontFamily: 'monospace',
            fontSize: 10,
            color: 'var(--text-secondary)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            lineHeight: 1.5
          }}>
            <div style={{
              fontSize: 11,
              fontWeight: 600,
              color: planningPhase === 'done' ? 'var(--green)' : 'var(--blue)',
              marginBottom: 4
            }}>
              <AuditOutlined style={{ marginRight: 4 }} />
              {planningPhase === 'done' ? '审查完成' : '主 Agent 审查中...'}
            </div>
            {outputRefs.current.get('review-agent') || (planningPhase === 'reviewing' && <LoadingOutlined spin style={{ fontSize: 11 }} />)}
          </div>
        )}

        <div style={{
          padding: '6px 12px', borderTop: '1px solid var(--border)',
          display: 'flex', justifyContent: 'flex-end'
        }}>
        <button onClick={handleRefresh} style={{
          padding: '2px 8px', borderRadius: 4, border: 'none',
          background: 'transparent', color: 'var(--text-tertiary)',
          cursor: 'pointer', fontSize: 11, display: 'flex',
          alignItems: 'center', gap: 4
        }}>
          <ReloadOutlined style={{ fontSize: 10 }} /> 刷新
        </button>
        </div>
      </div>
    </div>
  )
}

const actionBtnStyle = (color: string): React.CSSProperties => ({
  padding: '3px 10px',
  borderRadius: 5,
  border: 'none',
  background: color,
  color: '#fff',
  cursor: 'pointer',
  fontSize: 11,
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  fontWeight: 500
})

const miniBtnStyle = (color: string): React.CSSProperties => ({
  padding: '1px 6px',
  borderRadius: 3,
  border: `1px solid ${color}`,
  background: 'transparent',
  color,
  cursor: 'pointer',
  fontSize: 10,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 2
})
