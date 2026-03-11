const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY!

const MODEL_MAP: Record<string, string> = {
  'claude-opus': 'claude-opus-4-6',
  'claude-sonnet': 'claude-sonnet-4-6',
  'claude-haiku': 'claude-haiku-4-5-20251001',
}

export async function callClaude(systemPrompt: string, userMessage: string, model: string = 'claude-opus'): Promise<string> {
  const modelId = MODEL_MAP[model] || MODEL_MAP['claude-opus']

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: modelId,
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text().catch(() => 'no body')
    console.error(`Claude API error ${response.status}:`, errorBody)
    throw new Error(`Claude API error: ${response.status} - ${errorBody}`)
  }

  const data = await response.json()
  return data.content[0].text
}

export async function streamClaude(systemPrompt: string, userMessage: string, model: string = 'claude-opus') {
  const modelId = MODEL_MAP[model] || MODEL_MAP['claude-opus']

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: modelId,
      max_tokens: 4096,
      stream: true,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text().catch(() => 'no body')
    console.error(`Claude API error ${response.status}:`, errorBody)
    throw new Error(`Claude API error: ${response.status} - ${errorBody}`)
  }

  return response.body
}
