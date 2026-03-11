'use client'

import { AI_MODELS, type AIModel } from '@/lib/ai-models'

interface AIModelSelectorProps {
  value: AIModel
  onChange: (model: AIModel) => void
  disabled?: boolean
  compact?: boolean
}

const PROVIDER_COLORS: Record<string, string> = {
  Anthropic: 'bg-orange-100 text-orange-700 border-orange-200',
  Google: 'bg-blue-100 text-blue-700 border-blue-200',
}

export default function AIModelSelector({ value, onChange, disabled, compact }: AIModelSelectorProps) {
  if (compact) {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as AIModel)}
        disabled={disabled}
        className="h-7 px-2 text-xs border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
      >
        {AI_MODELS.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
    )
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {AI_MODELS.map((m) => {
        const isActive = value === m.id
        const providerColor = PROVIDER_COLORS[m.provider] || 'bg-gray-100 text-gray-700 border-gray-200'
        return (
          <button
            key={m.id}
            onClick={() => onChange(m.id)}
            disabled={disabled}
            className={`
              flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-all
              ${isActive
                ? 'border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500/30'
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
              }
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium border ${providerColor}`}>
              {m.provider}
            </span>
            <span className="font-medium">{m.name}</span>
            {!compact && (
              <span className="text-gray-400 hidden sm:inline">· {m.description}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
