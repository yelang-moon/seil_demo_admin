export type AIModel = 'claude-opus' | 'claude-sonnet' | 'claude-haiku' | 'gemini-flash' | 'gemini-pro' | 'gemini-3-flash' | 'gemini-3-pro'

export const AI_MODELS: { id: AIModel; name: string; provider: string; description: string }[] = [
  { id: 'claude-opus', name: 'Claude Opus 4.6', provider: 'Anthropic', description: '최고 성능, 심층 분석' },
  { id: 'claude-sonnet', name: 'Claude Sonnet 4.6', provider: 'Anthropic', description: '균형 잡힌 성능' },
  { id: 'claude-haiku', name: 'Claude Haiku 4.5', provider: 'Anthropic', description: '빠른 응답, 경제적' },
  { id: 'gemini-flash', name: 'Gemini 2.5 Flash', provider: 'Google', description: '빠른 응답, 효율적' },
  { id: 'gemini-pro', name: 'Gemini 2.5 Pro', provider: 'Google', description: '고성능 분석' },
  { id: 'gemini-3-flash', name: 'Gemini 3 Flash', provider: 'Google', description: '최신 Flash, 빠른 추론' },
  { id: 'gemini-3-pro', name: 'Gemini 3.1 Pro', provider: 'Google', description: '최신 Pro, 최고 성능' },
]
