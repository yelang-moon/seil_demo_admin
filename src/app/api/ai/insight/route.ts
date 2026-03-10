import { streamClaude } from '@/lib/claude'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { period, productionData, equipmentData, productData } = await request.json()

    if (!period || !productionData) {
      return NextResponse.json(
        { error: '필수 데이터가 없습니다' },
        { status: 400 }
      )
    }

    const systemPrompt =
      '당신은 한국 제조공장의 생산관리 컨설턴트입니다. 제공된 생산 데이터를 종합 분석하여 다음 3가지 영역에 대해 한국어로 상세한 리포트를 작성하세요: 1) 생산 효율 분석 (설비별 가동률, 병목 설비, 최적 스케줄) 2) 품질/불량 분석 (불량률 패턴, 개선 포인트) 3) 작업자 생산성 (기술자별 생산량, 최적 조합). 마크다운 형식으로 작성하세요.'

    const userMessage = `분석 기간: ${period}

생산 데이터:
${JSON.stringify(productionData, null, 2)}

설비 데이터:
${JSON.stringify(equipmentData, null, 2)}

제품 데이터:
${JSON.stringify(productData, null, 2)}`

    const streamBody = await streamClaude(systemPrompt, userMessage)

    if (!streamBody) {
      return NextResponse.json(
        { error: '스트림을 생성할 수 없습니다' },
        { status: 500 }
      )
    }

    const reader = streamBody.getReader()
    const decoder = new TextDecoder()

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const chunk = decoder.decode(value, { stream: true })
            const lines = chunk.split('\n')

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const jsonStr = line.slice(6)
                  const json = JSON.parse(jsonStr)

                  if (json.type === 'content_block_delta' && json.delta?.type === 'text_delta') {
                    const text = json.delta.text
                    controller.enqueue(text)
                  } else if (json.type === 'message_stop') {
                    controller.close()
                    return
                  }
                } catch {
                  // Ignore JSON parse errors for non-data lines
                }
              }
            }
          }
          controller.close()
        } catch (error) {
          controller.error(error)
        }
      },
    })

    return new NextResponse(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    console.error('AI insight error:', error)
    return NextResponse.json(
      { error: 'AI 분석 중 오류가 발생했습니다' },
      { status: 500 }
    )
  }
}
