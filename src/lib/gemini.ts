const GEMINI_API_KEY = process.env.GEMINI_API_KEY!

const MODEL_MAP: Record<string, string> = {
  'gemini-flash': 'gemini-2.5-flash',
  'gemini-pro': 'gemini-2.5-pro',
}

export async function callGemini(systemPrompt: string, userMessage: string, model: string = 'gemini-flash'): Promise<string> {
  const modelId = MODEL_MAP[model] || MODEL_MAP['gemini-flash']

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userMessage }] }],
        generationConfig: {
          maxOutputTokens: 4096,
          temperature: 0.7,
        },
      }),
    }
  )

  if (!response.ok) {
    const errorBody = await response.text().catch(() => 'no body')
    console.error(`Gemini API error ${response.status}:`, errorBody)
    throw new Error(`Gemini API error: ${response.status} - ${errorBody}`)
  }

  const data = await response.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

export async function streamGemini(systemPrompt: string, userMessage: string, model: string = 'gemini-flash') {
  const modelId = MODEL_MAP[model] || MODEL_MAP['gemini-flash']

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userMessage }] }],
        generationConfig: {
          maxOutputTokens: 8192,
          temperature: 0.7,
        },
      }),
    }
  )

  if (!response.ok) {
    const errorBody = await response.text().catch(() => 'no body')
    console.error(`Gemini API error ${response.status}:`, errorBody)
    throw new Error(`Gemini API error: ${response.status} - ${errorBody}`)
  }

  return response.body
}
