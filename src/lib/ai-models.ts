export type AIModel = 'claude-opus' | 'claude-sonnet' | 'gemini-flash' | 'gemini-pro'

export const AI_MODELS: { id: AIModel; name: string; provider: string; description: string }[] = [
  { id: 'claude-opus', name: 'Claude Opus', provider: 'Anthropic', description: '최고 성능, 심층 분석' },
  { id: 'claude-sonnet', name: 'Claude Sonnet', provider: 'Anthropic', description: '균형 잡힌 성능' },
  { id: 'gemini-flash', name: 'Gemini 2.5 Flash', provider: 'Google', description: '빠른 응답, 효율적' },
  { id: 'gemini-pro', name: 'Gemini 2.5 Pro', provider: 'Google', description: '고성능 분석' },
]
