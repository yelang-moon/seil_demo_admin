import { streamClaude } from '@/lib/claude'
import { NextRequest, NextResponse } from 'next/server'
import { fetchContextualNews } from '@/lib/external-context'

export async function POST(request: NextRequest) {
  try {
    const { question, factory, context } = await request.json()

    if (!question) {
      return NextResponse.json({ error: '질문이 없습니다' }, { status: 400 })
    }

    // 질문 내용에 따라 관련 외부 뉴스 검색
    let externalNews = ''
    try {
      externalNews = await fetchContextualNews(question)
    } catch {
      // 외부 뉴스 실패 시 무시
    }

    const systemPrompt = `당신은 (주)에스이아이엘(SEIL) 생산관리 시스템의 AI 어시스턴트입니다.
사용자가 생산, 출하, 재고, 설비, 품질 등에 대해 질문하면 아래 데이터를 기반으로 정확하고 간결하게 답변합니다.

## 회사 정보
- 회사명: (주)에스이아이엘 (SEIL)
- 주요 사업: 일회용 식품 용기, 컵, 수저, 빨대 등 제조
- 소재: PP(폴리프로필렌), PS(폴리스타이렌), PET(폴리에틸렌테레프탈레이트), PLA(생분해), 종이
- 생산 방식: 사출 성형(성형부), 지기(종이 용기) 생산(지기생산부)
- 판매 채널: 쿠팡, 네이버, 11번가, SSG, 옥션, 지마켓, 아마존 등
- 사업 방향: 멀티소재(플라스틱+종이+친환경), 멀티채널, 해외 진출(아마존 등)

## 현재 선택 공장: ${factory}

## 답변 규칙
1. 데이터에 근거하여 정확한 수치와 함께 답변하세요.
2. 마크다운 테이블을 적극 활용하세요.
3. 핵심 수치는 **굵게** 표시하세요.
4. 답변은 간결하되 충분한 정보를 포함하세요 (200~500자).
5. 데이터에 없는 내용을 묻는 경우 솔직히 "현재 데이터에는 없습니다"라고 답하세요.
6. 수치 비교, 추이 분석, 이상치 탐지 등 분석적 관점을 제공하세요.
7. 개선 제안이나 주의사항이 있으면 함께 언급하세요.
8. **외부 환경 요인도 반영하세요**: 업계 뉴스, 원자재 동향, 규제 변화 등이 제공되면 내부 데이터와 연계하여 복합적 판단을 하세요.
9. 관련 뉴스나 외부 정보가 있으면 적절히 언급하고, 출처(링크)가 있으면 포함하세요.
10. 내부 데이터만으로는 답할 수 없는 시장 동향, 경쟁사, 규제 질문에 대해서도 제공된 외부 정보를 활용하여 유용한 답변을 하세요.`

    let userMessage = `## 내부 데이터 컨텍스트
${context}`

    if (externalNews) {
      userMessage += `

## 관련 외부 뉴스/시장 정보
${externalNews}
(위 외부 정보를 내부 데이터와 연계하여 복합적 인사이트를 제공하세요)`
    }

    userMessage += `

## 사용자 질문
${question}`

    const streamBody = await streamClaude(systemPrompt, userMessage)

    if (!streamBody) {
      return NextResponse.json({ error: '스트림을 생성할 수 없습니다' }, { status: 500 })
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
                  const json = JSON.parse(line.slice(6))
                  if (json.type === 'content_block_delta' && json.delta?.type === 'text_delta') {
                    controller.enqueue(json.delta.text)
                  } else if (json.type === 'message_stop') {
                    controller.close()
                    return
                  }
                } catch {
                  // ignore parse errors
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
    console.error('AI chat error:', error)
    return NextResponse.json({ error: 'AI 응답 중 오류가 발생했습니다' }, { status: 500 })
  }
}
