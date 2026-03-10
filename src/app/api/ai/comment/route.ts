import { callClaude } from '@/lib/claude'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { chartType, data } = await request.json()

    if (!chartType || !data) {
      return NextResponse.json({ error: '필수 데이터가 없습니다' }, { status: 400 })
    }

    const systemPrompt =
      '당신은 한국 제조공장의 생산관리 전문가입니다. 차트 데이터를 분석하여 2~3문장으로 핵심 인사이트를 한국어로 제공하세요. 전문적이지만 이해하기 쉽게 설명하세요.'

    const userMessage = `차트 타입: ${chartType}\n\n데이터:\n${JSON.stringify(data, null, 2)}`

    const comment = await callClaude(systemPrompt, userMessage)

    return NextResponse.json({ comment })
  } catch (error) {
    console.error('AI comment error:', error)
    return NextResponse.json({ error: 'AI 분석 중 오류가 발생했습니다' }, { status: 500 })
  }
}
