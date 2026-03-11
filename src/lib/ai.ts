import { callClaude, streamClaude } from './claude'
import { callGemini, streamGemini } from './gemini'
import { type AIModel } from './ai-models'

export { type AIModel } from './ai-models'
export { AI_MODELS } from './ai-models'

export async function callAI(model: AIModel, systemPrompt: string, userMessage: string): Promise<string> {
  switch (model) {
    case 'claude-opus':
    case 'claude-sonnet':
      return callClaude(systemPrompt, userMessage, model)
    case 'gemini-flash':
    case 'gemini-pro':
      return callGemini(systemPrompt, userMessage, model)
    default:
      return callClaude(systemPrompt, userMessage, 'claude-opus')
  }
}

export async function streamAI(model: AIModel, systemPrompt: string, userMessage: string) {
  switch (model) {
    case 'claude-opus':
    case 'claude-sonnet':
      return streamClaude(systemPrompt, userMessage, model)
    case 'gemini-flash':
    case 'gemini-pro':
      return streamGemini(systemPrompt, userMessage, model)
    default:
      return streamClaude(systemPrompt, userMessage, 'claude-opus')
  }
}
