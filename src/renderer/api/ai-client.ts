import { useAppStore } from '../stores/app-store'

export class AIError extends Error {
  constructor(public code: number, message: string) {
    super(message)
    this.name = 'AIError'
  }
}

function getEnabledModel() {
  const state = useAppStore.getState()
  return state.models.find((m) => m.enabled)
}

function buildHistory(userContent: string) {
  const state = useAppStore.getState()
  const history = state.messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role, content: m.content }))
  history.push({ role: 'user', content: userContent })
  return history
}

/* ── SSE 通用解析 ───────────────────────────────────────── */

function parseSSEChunk(line: string): string | null {
  if (!line.startsWith('data: ')) return null
  const data = line.slice(6)
  if (data === '[DONE]') return null

  try {
    const parsed = JSON.parse(data)
    // OpenAI 格式
    const openai = parsed.choices?.[0]?.delta?.content
    if (openai) return openai
    // Anthropic 格式
    const anthropic = parsed.delta?.text ?? parsed.delta?.partial_json
    if (anthropic) return anthropic
  } catch {
    // 忽略解析错误
  }
  return null
}

/* ── OpenAI 兼容流 ─────────────────────────────────────── */

async function* streamOpenAI(
  baseUrl: string,
  apiKey: string | undefined,
  model: string,
  messages: { role: string; content: string }[]
): AsyncGenerator<string, void, unknown> {
  const url = baseUrl.replace(/\/+$/, '') + '/chat/completions'

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey || ''}`
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      temperature: 0.7
    })
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new AIError(response.status, `API ${response.status}: ${text}`)
  }

  const reader = response.body?.getReader()
  if (!reader) throw new AIError(0, '无法读取响应流')

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      const chunk = parseSSEChunk(line.trim())
      if (chunk) yield chunk
    }
  }

  // 处理剩余 buffer
  if (buffer.trim()) {
    const chunk = parseSSEChunk(buffer.trim())
    if (chunk) yield chunk
  }
}

/* ── Anthropic 兼容流 ──────────────────────────────────── */

async function* streamAnthropic(
  baseUrl: string,
  apiKey: string | undefined,
  model: string,
  messages: { role: string; content: string }[]
): AsyncGenerator<string, void, unknown> {
  const url = baseUrl.replace(/\/+$/, '') + '/v1/messages'

  // Anthropic 格式：分离 system prompt
  const systemMsg = messages.find((m) => m.role === 'system')?.content
  const chatMessages = messages.filter((m) => m.role !== 'system')

  const body: Record<string, unknown> = {
    model,
    messages: chatMessages,
    max_tokens: 4096,
    stream: true
  }
  if (systemMsg) body.system = systemMsg

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey || '',
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new AIError(response.status, `API ${response.status}: ${text}`)
  }

  const reader = response.body?.getReader()
  if (!reader) throw new AIError(0, '无法读取响应流')

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      const chunk = parseSSEChunk(line.trim())
      if (chunk) yield chunk
    }
  }

  if (buffer.trim()) {
    const chunk = parseSSEChunk(buffer.trim())
    if (chunk) yield chunk
  }
}

/* ── 公共入口 ───────────────────────────────────────────── */

export async function* streamChat(userContent: string): AsyncGenerator<string, void, unknown> {
  const model = getEnabledModel()
  if (!model) {
    throw new AIError(0, '没有启用的模型，请先前往「模型配置」启用一个模型并填写 API Key')
  }
  if (!model.apiKey) {
    throw new AIError(0, `模型「${model.name}」未配置 API Key`)
  }

  const messages = buildHistory(userContent)
  const isAnthropic = model.baseUrl?.includes('/anthropic')

  if (isAnthropic) {
    yield* streamAnthropic(model.baseUrl || '', model.apiKey, model.name, messages)
  } else {
    yield* streamOpenAI(model.baseUrl || '', model.apiKey, model.name, messages)
  }
}
