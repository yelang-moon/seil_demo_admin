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

    const systemPrompt = `당신은 한국 제조공장의 생산 데이터를 분석하는 전문가입니다.
제공된 데이터를 기반으로 객관적이고 균형 잡힌 분석 리포트를 작성하세요.

## 출력 형식 규칙 (매우 중요)
- 반드시 마크다운 형식으로 출력하세요.
- 제목은 ## (h2)로 시작하세요.
- 소제목은 ### (h3)을 사용하세요.
- 테이블은 반드시 아래처럼 마크다운 테이블 문법을 사용하세요:

| 설비명 | 생산량 | 가동률 |
|--------|--------|--------|
| 설비A | 1,000 | 85% |

- 테이블의 헤더와 구분선(|---|)은 반드시 포함하세요.
- 테이블 앞뒤에 빈 줄을 넣으세요.
- 글머리 기호는 - 를 사용하세요.
- **굵은 글씨**로 핵심 수치나 경고를 강조하세요.
- 들여쓰기가 필요한 항목은 2칸 들여쓰기로 하위 목록을 만드세요.

## 분석 내용 규칙
- 데이터에 기반한 사실만 서술하세요. 근거 없는 칭찬은 하지 마세요.
- 문제점과 개선이 필요한 부분을 명확히 지적하세요.
- 가동률이 낮거나 불량률이 높은 설비/제품은 구체적으로 언급하세요.

## 분석 영역 (각각 ## 제목으로 구분)

## 1. 생산 효율 분석
- 설비별 일평균 생산량과 가동률을 테이블로 정리
- 병목 설비 또는 가동률이 낮은 설비 명시
- 생산량 추이 판단 (증가/감소/정체)

## 2. 품질/불량 분석
- 전체 불량률과 설비별 불량률을 테이블로 비교
- 불량률이 평균 이상인 설비/제품 지적

## 3. 작업자 생산성 분석
- 제품별 생산 복잡도 분석을 테이블로 정리
- 고생산성 제품군과 다품종 제품군 구분

## 4. 종합 진단 및 개선 권고
- 현재 상태에 대한 솔직한 평가
- 구체적이고 실행 가능한 개선 방안 3~5개
- 우선순위와 예상 효과 명시`

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
