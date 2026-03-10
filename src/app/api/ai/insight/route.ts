import { streamClaude } from '@/lib/claude'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { period, productionData, equipmentData, productData, shipmentData, safetyStockData, utilizationData } = await request.json()

    if (!period || !productionData) {
      return NextResponse.json(
        { error: '필수 데이터가 없습니다' },
        { status: 400 }
      )
    }

    const hasShipment = shipmentData && (shipmentData.dailyShipments?.length > 0 || Object.keys(shipmentData.customerSummary || {}).length > 0)
    const hasSafetyStock = safetyStockData && safetyStockData.length > 0
    const hasUtilization = utilizationData && utilizationData.equipmentUtilization?.length > 0

    let shipmentSection = ''
    if (hasShipment) {
      shipmentSection = `

## 5. 출하량 분석
- 기간 내 총 출하량, 일평균 출하량, 출하 건수를 정리
- 고객사별 출하 비중을 테이블로 정리 (상위 고객사 집중도 분석)
- 제품별 출하량 상위 10개를 테이블로 정리
- 출하 추세 판단 (증가/감소/정체)
- 주요 고객사 의존도 리스크 분석`
    }

    let safetyStockSection = ''
    if (hasSafetyStock) {
      safetyStockSection = `

## ${hasShipment ? '6' : '5'}. 안전 재고 현황 분석
- 긴급(critical) 및 우선(high) 제품은 반드시 테이블로 명시하고 구체적 대응 방안 제시
- 재고 부족 위험 제품의 잔여일수와 일평균 출하량을 함께 표시
- 악성 재고(재고율 300% 이상) 제품 지적 및 처리 방안 제안
- 판매중단 제품(최근 30일 출하 없음) 재고 처리 권고`
    }

    let sectionCount = 4 + (hasShipment ? 1 : 0) + (hasSafetyStock ? 1 : 0)

    let utilizationSection = ''
    if (hasUtilization) {
      sectionCount++
      utilizationSection = `

## ${sectionCount}. 설비 가동률 심층 분석 (실제 가동일 기준)
- 아래 가동률 데이터는 실제 가동일(working day) 기준으로 계산된 것입니다
- 설비별 가동률을 테이블로 정리 (가동률, 실제생산량, 일일최대능력, 가동일수)
- 가동률 70% 미만 설비는 원인 분석 및 개선 방안 제시
- 가동률 95% 이상 설비는 과부하 위험 및 증설 필요성 검토
- 설비 간 가동률 편차 분석 및 생산 라인 밸런싱 제안`
    }

    // strategicSection already includes 종합 진단 + AI 전략 인사이트

    const strategicSectionNum = sectionCount + 2
    const strategicSection = `

## ${sectionCount + 1}. 종합 진단 및 개선 권고
- 현재 상태에 대한 솔직한 평가
- 생산, 품질${hasShipment ? ', 출하' : ''}${hasSafetyStock ? ', 재고' : ''}${hasUtilization ? ', 가동률' : ''} 전반에 걸친 종합 진단
- 구체적이고 실행 가능한 개선 방안 3~5개
- 우선순위와 예상 효과 명시

## ${strategicSectionNum}. AI 활용 전략 인사이트
이 섹션에서는 위 데이터 분석 결과를 바탕으로, SEIL의 사업 특성에 맞는 AI 활용 전략을 제안합니다.
아래 5개 영역에서 데이터에서 드러난 문제/기회와 연결하여 구체적 제안을 하세요:

### ${strategicSectionNum}-1. 수요예측과 재고 최적화
- 출하 데이터의 계절성, 고객사별 편차, 제품별 출하 패턴을 분석하여 수요예측 모델 구축 가능성 평가
- 안전재고 기준이 적절한지 데이터 기반으로 평가하고, AI 기반 동적 안전재고 조정 제안
- 마켓플레이스별(쿠팡, 네이버 등) 주문 패턴 분석을 통한 재고 최적화 방안

### ${strategicSectionNum}-2. 생산 스케줄링 최적화
- 가동률 데이터와 출하 데이터를 연계하여 생산 우선순위 자동 결정 가능성 평가
- 설비 간 부하 불균형 해소를 위한 AI 기반 생산 스케줄링 제안
- 금형 교체 최소화를 위한 제품 군집(배치) 최적화 방안

### ${strategicSectionNum}-3. 품질 예측 및 불량 방지
- 불량률 데이터 패턴에서 설비 노후화, 소재 변화, 작업 환경 등의 요인 분석
- 설비 센서 데이터 + 생산 기록 결합을 통한 불량 사전 예측 모델 가능성
- 비전 AI를 활용한 일회용 용기 외관 검사 자동화 효과 예측

### ${strategicSectionNum}-4. 소재 전환 및 원가 최적화
- 현재 생산 제품의 소재(PP, PS, PET) 구성 분석
- 친환경 소재(PLA, 사탕수수 바가스, rPET) 전환 시 생산성/원가 영향 시뮬레이션 제안
- 원자재 가격 변동 대응을 위한 대체 소재 추천 시스템 구축 방안

### ${strategicSectionNum}-5. 해외 시장 확장 기회
- 출하 데이터에서 아마존 등 해외 채널 비중 분석
- 해외 일회용품 규제(EU SUP Directive, 미국 주별 규제) 대응 제품 포트폴리오 제안
- AI 기반 해외 시장 수요 분석 및 최적 진입 전략`

    const systemPrompt = `당신은 한국 제조공장의 생산 데이터를 분석하는 전문가이자, 일회용품 제조 산업의 AI 혁신 전략 컨설턴트입니다.

## 분석 대상 회사 정보
- 회사명: (주)에스이아이엘 (SEIL)
- 소재지: 경기도 광주시
- 주요 사업: 일회용 식품 용기, 컵, 수저, 빨대 등 제조
- 소재: PP(폴리프로필렌), PS(폴리스타이렌), PET(폴리에틸렌테레프탈레이트)
- 생산 방식: 사출 성형(성형부), 지기(종이 용기) 생산(지기생산부)
- 판매 채널: 쿠팡, 네이버스토어, 11번가, SSG.COM, 옥션, 지마켓, 아마존 등 온라인 마켓플레이스
- 특징: 다품종 소량생산 체계, 금형 기반 제조, B2C 온라인 판매 중심

이 회사의 특성을 잘 이해한 상태에서 데이터를 분석하고, 일회용품 제조업체에 맞는 실질적 인사이트를 제공하세요.

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
- 재고 부족 위험 제품은 긴급도에 따라 강조하세요.

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

## 4. 생산-출하 연계 분석
- 생산량 대비 출하량 비교 (과잉생산/부족생산 판단)
- 재고 축적 또는 소진 추세 분석${shipmentSection}${safetyStockSection}${utilizationSection}${strategicSection}`

    let userMessage = `분석 기간: ${period}

생산 데이터:
${JSON.stringify(productionData, null, 2)}

설비 데이터:
${JSON.stringify(equipmentData, null, 2)}

제품 데이터:
${JSON.stringify(productData, null, 2)}`

    if (hasShipment) {
      userMessage += `

출하 데이터 (일별):
${JSON.stringify(shipmentData.dailyShipments, null, 2)}

고객사별 출하 요약:
${JSON.stringify(shipmentData.customerSummary, null, 2)}

제품별 출하 요약:
${JSON.stringify(shipmentData.productShipmentSummary, null, 2)}`
    }

    if (hasSafetyStock) {
      userMessage += `

안전 재고 현황:
${JSON.stringify(safetyStockData, null, 2)}`
    }

    if (hasUtilization) {
      userMessage += `

설비 가동률 데이터 (실제 가동일 기준):
- 분석 기간 내 실제 가동일수: ${utilizationData.workingDayCount}일
${JSON.stringify(utilizationData.equipmentUtilization, null, 2)}`
    }

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
