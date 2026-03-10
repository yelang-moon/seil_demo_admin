import { streamClaude } from '@/lib/claude'
import { NextRequest, NextResponse } from 'next/server'
import { fetchContextualNews } from '@/lib/external-context'
import { getRelevantKnowledge } from '@/data/knowledge-base'

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

    const systemPrompt = `당신은 (주)에스이아이엘(SEIL) 생산관리 시스템의 AI 어시스턴트이자 전략 컨설턴트입니다.
생산, 출하, 재고, 설비, 품질에 대한 질문뿐 아니라, 시장 동향, 경쟁사, 규제, 해외 진출, 소재 전략 등 비즈니스 전략 질문에도 전문적으로 답변합니다.

## 회사 정보
- 회사명: (주)에스이아이엘 (SEIL)
- 주요 사업: 일회용 식품 용기, 컵, 수저, 빨대 등 제조
- 소재: PP(폴리프로필렌), PS(폴리스타이렌), PET(폴리에틸렌테레프탈레이트), PLA(생분해), 종이
- 생산 방식: 열성형(성형부 - VFK TSAV/SV 시리즈), 지기(종이 용기) 생산(지기생산부 - TMC/즈신/윈샤인/다치오)
- 판매 채널: 쿠팡, 네이버, 11번가, SSG, 옥션, 지마켓 (온라인) | CJ제일제당, 대상, 오뚜기 등 (B2B) | 아마존 (해외)
- 인증: ISO 9001, ISO 14001, FSSC 22000, HACCP, SGS, UL
- 핵심 경쟁력: PP+PET+PLA+종이 멀티소재 생산 가능 (한국 중소기업 중 드문 역량)
- 사업 방향: 멀티소재(플라스틱+종이+친환경), 멀티채널, 해외 진출(아마존→일본/동남아 확장)

## 현재 선택 공장: ${factory}

## 답변 규칙
1. 데이터에 근거하여 정확한 수치와 함께 답변하세요.
2. 마크다운 테이블을 적극 활용하세요.
3. 핵심 수치는 **굵게** 표시하세요.
4. 답변은 간결하되 충분한 정보를 포함하세요 (200~500자).
5. 데이터에 없는 내용은 지식 베이스를 활용하여 답하세요. 지식 베이스에도 없으면 솔직히 안내하세요.
6. 수치 비교, 추이 분석, 이상치 탐지 등 분석적 관점을 제공하세요.
7. 개선 제안이나 주의사항이 있으면 함께 언급하세요.
8. **외부 환경 요인도 반영하세요**: 업계 뉴스, 원자재 동향, 규제 변화 등이 제공되면 내부 데이터와 연계하여 복합적 판단을 하세요.
9. 관련 뉴스나 외부 정보가 있으면 적절히 언급하고, 출처가 있으면 포함하세요.
10. 시장 동향, 경쟁사, 규제, 해외 전략 질문에는 지식 베이스의 글로벌 업계 데이터를 적극 활용하여 SEIL의 관점에서 실질적 인사이트를 제공하세요.
11. 해외 진출 관련 질문에는 각국 규제(EU SUP, 일본 포지티브 리스트, 동남아 규제)를 구체적으로 안내하세요.
12. 소재 전환 질문에는 원자재 가격 동향과 규제를 연계하여 의사결정을 지원하세요.`

    // 질문에 맞는 지식 베이스 로드
    const relevantKnowledge = getRelevantKnowledge(question)

    let userMessage = `## 내부 데이터 컨텍스트
${context}

## 글로벌 업계 지식 베이스
${relevantKnowledge}`

    if (externalNews) {
      userMessage += `

## 실시간 관련 뉴스
${externalNews}`
    }

    userMessage += `

## 사용자 질문
${question}

(내부 데이터 + 지식 베이스 + 외부 뉴스를 종합하여 SEIL의 관점에서 실질적 인사이트를 제공하세요)`

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
