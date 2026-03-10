'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useFactory } from '@/contexts/factory-context'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

// 초기 프리셋 질문 — 카테고리별로 구분
const INITIAL_PRESETS: { category: string; questions: string[] }[] = [
  {
    category: '생산',
    questions: [
      '최근 생산 현황을 요약해줘',
      '불량률이 가장 높은 설비와 원인 분석해줘',
      '설비별 가동률 비교 테이블 보여줘',
    ],
  },
  {
    category: '출하·매출',
    questions: [
      '채널별 매출 비중 분석해줘',
      '매출 TOP 10 제품 테이블로 보여줘',
      '쿠팡 vs 네이버 출하 비교해줘',
    ],
  },
  {
    category: '재고·품질',
    questions: [
      '안전재고 부족 제품 긴급도별로 정리해줘',
      '불량률 추이가 악화되는 설비 있어?',
      '재고 과잉인 제품은?',
    ],
  },
]

// 마지막 질문 키워드에 따른 후속 질문 생성
function getFollowUpPresets(lastUserQ: string, lastAssistantA: string): string[] {
  const q = lastUserQ.toLowerCase()
  const a = lastAssistantA.toLowerCase()
  const suggestions: string[] = []

  // 생산/가동률 관련
  if (q.includes('생산') || q.includes('가동률') || q.includes('설비')) {
    suggestions.push('설비별 불량률도 함께 분석해줘')
    suggestions.push('가동률이 낮은 설비의 원인이 뭘까?')
    suggestions.push('생산량 추이를 주간 단위로 보여줘')
  }
  // 불량 관련
  if (q.includes('불량') || q.includes('품질')) {
    suggestions.push('불량률 개선을 위한 방안 제안해줘')
    suggestions.push('불량이 많은 제품군은 어떤 것들이야?')
    suggestions.push('불량률과 작업시간의 상관관계 분석해줘')
  }
  // 출하/매출 관련
  if (q.includes('출하') || q.includes('매출') || q.includes('채널') || q.includes('쿠팡') || q.includes('네이버')) {
    suggestions.push('월별 매출 추이 분석해줘')
    suggestions.push('채널별 주력 제품이 다른가?')
    suggestions.push('매출 성장률이 높은 제품은?')
  }
  // 재고 관련
  if (q.includes('재고') || q.includes('안전재고') || q.includes('부족')) {
    suggestions.push('재고 부족 제품의 최근 출하 추이 보여줘')
    suggestions.push('안전재고 기준이 적절한지 평가해줘')
    suggestions.push('재고 과잉 제품 처리 방안 제안해줘')
  }
  // TOP/랭킹 관련
  if (q.includes('top') || q.includes('랭킹') || q.includes('순위') || q.includes('비교')) {
    suggestions.push('하위 제품은 어떤 것들이야?')
    suggestions.push('이 데이터의 개선 포인트를 알려줘')
  }
  // 응답에 테이블이 포함된 경우
  if (a.includes('|---') || a.includes('| ---')) {
    suggestions.push('이 데이터를 차트로 시각화하면 어떤 인사이트가 보여?')
    suggestions.push('이 중 이상치(outlier)가 있어?')
  }

  // 공통 후속 질문 추가
  if (suggestions.length < 4) {
    suggestions.push('더 자세히 분석해줘')
  }
  if (suggestions.length < 4) {
    suggestions.push('개선 방안을 제안해줘')
  }

  return suggestions.slice(0, 4)
}

// 마크다운 커스텀 컴포넌트 (AI 인사이트와 동일)
const markdownComponents = {
  h1: ({ children, ...props }: React.ComponentProps<'h1'>) => (
    <h1 className="text-lg font-bold text-gray-900 mt-4 mb-2 pb-1 border-b border-gray-200" {...props}>{children}</h1>
  ),
  h2: ({ children, ...props }: React.ComponentProps<'h2'>) => (
    <h2 className="text-base font-bold text-gray-900 mt-4 mb-2 pb-1 border-b border-gray-200" {...props}>{children}</h2>
  ),
  h3: ({ children, ...props }: React.ComponentProps<'h3'>) => (
    <h3 className="text-sm font-semibold text-gray-800 mt-3 mb-1.5" {...props}>{children}</h3>
  ),
  p: ({ children, ...props }: React.ComponentProps<'p'>) => (
    <p className="text-sm text-gray-700 leading-relaxed mb-2" {...props}>{children}</p>
  ),
  ul: ({ children, ...props }: React.ComponentProps<'ul'>) => (
    <ul className="list-disc pl-5 mb-2 space-y-0.5 text-sm text-gray-700" {...props}>{children}</ul>
  ),
  ol: ({ children, ...props }: React.ComponentProps<'ol'>) => (
    <ol className="list-decimal pl-5 mb-2 space-y-0.5 text-sm text-gray-700" {...props}>{children}</ol>
  ),
  li: ({ children, ...props }: React.ComponentProps<'li'>) => (
    <li className="leading-relaxed" {...props}>{children}</li>
  ),
  strong: ({ children, ...props }: React.ComponentProps<'strong'>) => (
    <strong className="font-bold text-gray-900" {...props}>{children}</strong>
  ),
  blockquote: ({ children, ...props }: React.ComponentProps<'blockquote'>) => (
    <blockquote className="border-l-4 border-blue-400 bg-blue-50 pl-3 py-1.5 my-2 text-sm text-gray-700 italic" {...props}>{children}</blockquote>
  ),
  table: ({ children, ...props }: React.ComponentProps<'table'>) => (
    <div className="overflow-x-auto my-3 rounded-lg border border-gray-200">
      <table className="min-w-full text-sm" {...props}>{children}</table>
    </div>
  ),
  thead: ({ children, ...props }: React.ComponentProps<'thead'>) => (
    <thead className="bg-gray-100 border-b border-gray-200" {...props}>{children}</thead>
  ),
  th: ({ children, ...props }: React.ComponentProps<'th'>) => (
    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap" {...props}>{children}</th>
  ),
  td: ({ children, ...props }: React.ComponentProps<'td'>) => (
    <td className="px-3 py-1.5 text-gray-700 border-t border-gray-100 whitespace-nowrap" {...props}>{children}</td>
  ),
  tr: ({ children, ...props }: React.ComponentProps<'tr'>) => (
    <tr className="even:bg-gray-50" {...props}>{children}</tr>
  ),
  hr: ({ ...props }: React.ComponentProps<'hr'>) => (
    <hr className="my-4 border-gray-200" {...props} />
  ),
  code: ({ children, className, ...props }: React.ComponentProps<'code'> & { className?: string }) => {
    const isBlock = className?.includes('language-')
    if (isBlock) {
      return <code className={`block bg-gray-900 text-green-400 p-3 rounded-lg text-xs overflow-x-auto my-2 ${className || ''}`} {...props}>{children}</code>
    }
    return <code className="bg-gray-100 text-red-600 px-1 py-0.5 rounded text-xs font-mono" {...props}>{children}</code>
  },
}

export default function AIChatPage() {
  const { factory } = useFactory()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [dataContext, setDataContext] = useState('')
  const [contextLoading, setContextLoading] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => { scrollToBottom() }, [messages])

  // 동적 프리셋 질문 계산
  const dynamicPresets = useMemo(() => {
    if (messages.length < 2) return null
    // 마지막 user-assistant 쌍 찾기
    const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant')
    const lastUser = [...messages].reverse().find(m => m.role === 'user')
    if (!lastUser || !lastAssistant || !lastAssistant.content) return null
    return getFollowUpPresets(lastUser.content, lastAssistant.content)
  }, [messages])

  // Fetch context data
  const fetchContext = useCallback(async () => {
    setContextLoading(true)
    try {
      const { data: latestRow } = await supabase
        .from('fact_production')
        .select('production_date')
        .eq('factory', factory)
        .order('production_date', { ascending: false })
        .limit(1)

      if (!latestRow || latestRow.length === 0) {
        setDataContext('데이터 없음')
        setContextLoading(false)
        return
      }

      const latestDate = latestRow[0].production_date
      const endDate = new Date(latestDate)
      const startDate = new Date(endDate)
      startDate.setDate(startDate.getDate() - 30)
      const startStr = startDate.toISOString().split('T')[0]

      const [prodRes, shipRes, equipRes, productRes] = await Promise.all([
        supabase.from('fact_production')
          .select('production_date, equipment_name, product_name, produced_qty, finished_qty, defect_qty, worker_count, work_minutes')
          .eq('factory', factory)
          .gte('production_date', startStr)
          .lte('production_date', latestDate)
          .range(0, 9999),
        supabase.from('fact_shipment')
          .select('shipment_date, customer_name, product_name, shipped_qty')
          .eq('factory', factory)
          .gte('shipment_date', startStr)
          .lte('shipment_date', latestDate)
          .range(0, 9999),
        supabase.from('dim_equipment')
          .select('name_legacy, name_official, factory')
          .eq('factory', factory),
        supabase.from('dim_product')
          .select('product_name, equipment_name, daily_max_qty, safety_stock_qty, current_stock_qty, raw_material')
          .eq('factory', factory),
      ])

      const prods = prodRes.data || []
      const ships = shipRes.data || []
      const equips = equipRes.data || []
      const products = productRes.data || []

      const { data: erpItems } = await supabase.from('dim_erp_item').select('item_name, sales_price')
      const priceMap = new Map<string, number>()
      erpItems?.forEach(i => { if (i.sales_price) priceMap.set(i.item_name, i.sales_price) })

      const totalProd = prods.reduce((s, r) => s + (r.produced_qty || r.finished_qty || 0), 0)
      const totalDefect = prods.reduce((s, r) => s + (r.defect_qty || 0), 0)
      const equipProd = new Map<string, { qty: number; defect: number; days: Set<string> }>()
      prods.forEach(r => {
        if (!equipProd.has(r.equipment_name)) equipProd.set(r.equipment_name, { qty: 0, defect: 0, days: new Set() })
        const e = equipProd.get(r.equipment_name)!
        e.qty += r.produced_qty || r.finished_qty || 0
        e.defect += r.defect_qty || 0
        e.days.add(r.production_date)
      })

      const equipNameMap = new Map<string, string>()
      equips.forEach(e => equipNameMap.set(e.name_legacy, e.name_official || e.name_legacy))

      const custShip = new Map<string, { qty: number; revenue: number }>()
      ships.forEach(s => {
        const c = s.customer_name || '기타'
        if (!custShip.has(c)) custShip.set(c, { qty: 0, revenue: 0 })
        const cs = custShip.get(c)!
        cs.qty += s.shipped_qty || 0
        cs.revenue += (s.shipped_qty || 0) * (priceMap.get(s.product_name) || 0)
      })

      const prodShip = new Map<string, { qty: number; revenue: number }>()
      ships.forEach(s => {
        const p = s.product_name || '기타'
        if (!prodShip.has(p)) prodShip.set(p, { qty: 0, revenue: 0 })
        const ps = prodShip.get(p)!
        ps.qty += s.shipped_qty || 0
        ps.revenue += (s.shipped_qty || 0) * (priceMap.get(s.product_name) || 0)
      })

      const stockAlerts = products.filter(p =>
        p.safety_stock_qty && p.current_stock_qty !== null && p.current_stock_qty !== undefined &&
        p.current_stock_qty < p.safety_stock_qty
      )

      let ctx = `분석 기간: ${startStr} ~ ${latestDate} (${factory})\n\n`
      ctx += `### 생산 요약\n`
      ctx += `- 총 생산량: ${totalProd.toLocaleString()}, 총 불량: ${totalDefect.toLocaleString()}, 불량률: ${totalProd > 0 ? ((totalDefect / totalProd) * 100).toFixed(2) : 0}%\n`
      ctx += `- 설비별:\n`
      Array.from(equipProd.entries()).sort((a, b) => b[1].qty - a[1].qty).forEach(([name, data]) => {
        const official = equipNameMap.get(name) || name
        const maxQty = products.find(p => p.equipment_name === name)?.daily_max_qty || 0
        const util = maxQty > 0 && data.days.size > 0 ? (data.qty / (maxQty * data.days.size)) * 100 : 0
        ctx += `  - ${official}: 생산 ${data.qty.toLocaleString()}, 불량 ${data.defect.toLocaleString()} (${data.qty > 0 ? ((data.defect / data.qty) * 100).toFixed(1) : 0}%), 가동일 ${data.days.size}일, 가동률 ${util.toFixed(1)}%\n`
      })

      ctx += `\n### 출하 요약\n`
      ctx += `- 총 출하: ${ships.reduce((s, r) => s + (r.shipped_qty || 0), 0).toLocaleString()}\n`
      ctx += `- 채널별 매출:\n`
      Array.from(custShip.entries()).sort((a, b) => b[1].revenue - a[1].revenue).forEach(([name, data]) => {
        ctx += `  - ${name}: ${data.qty.toLocaleString()}개, ${Math.round(data.revenue).toLocaleString()}원\n`
      })

      ctx += `\n- 제품별 출하 TOP 10:\n`
      Array.from(prodShip.entries()).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 10).forEach(([name, data]) => {
        ctx += `  - ${name}: ${data.qty.toLocaleString()}개, ${Math.round(data.revenue).toLocaleString()}원\n`
      })

      if (stockAlerts.length > 0) {
        ctx += `\n### 안전재고 부족 제품 (${stockAlerts.length}개)\n`
        stockAlerts.forEach(p => {
          ctx += `- ${p.product_name}: 현재 ${p.current_stock_qty?.toLocaleString()}, 안전재고 ${p.safety_stock_qty?.toLocaleString()}\n`
        })
      }

      ctx += `\n### 제품 마스터 (${products.length}개 제품)\n`
      products.slice(0, 30).forEach(p => {
        ctx += `- ${p.product_name} (${p.equipment_name}): 일최대 ${p.daily_max_qty?.toLocaleString() || '-'}, 소재 ${p.raw_material || '-'}, 안전재고 ${p.safety_stock_qty?.toLocaleString() || '-'}, 현재고 ${p.current_stock_qty?.toLocaleString() || '-'}\n`
      })

      setDataContext(ctx)
    } catch (err) {
      console.error('Context fetch error:', err)
      setDataContext('데이터 로딩 실패')
    } finally {
      setContextLoading(false)
    }
  }, [factory])

  useEffect(() => {
    fetchContext()
    setMessages([])
  }, [fetchContext])

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading || contextLoading) return

    const userMsg: Message = { role: 'user', content: text.trim() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsLoading(true)

    const assistantMsg: Message = { role: 'assistant', content: '' }
    setMessages(prev => [...prev, assistantMsg])

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text.trim(), factory, context: dataContext }),
      })

      if (!response.ok) throw new Error('API error')

      const reader = response.body?.getReader()
      if (!reader) throw new Error('No reader')

      const decoder = new TextDecoder()
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = { ...updated[updated.length - 1], content: accumulated }
          return updated
        })
      }
    } catch (err) {
      console.error('Chat error:', err)
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          content: '죄송합니다. 응답 중 오류가 발생했습니다. 다시 시도해주세요.',
        }
        return updated
      })
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] animate-fade-in-up">
      {/* Header */}
      <div className="flex-shrink-0 mb-4">
        <h1 className="text-2xl font-bold">AI 데이터 챗봇</h1>
        <p className="text-gray-500 text-sm mt-1">
          {factory} · 최근 30일 생산·출하·재고 데이터 기반 실시간 질의응답
        </p>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto rounded-lg bg-gray-50 border p-4 space-y-4 mb-3">
        {contextLoading ? (
          <div className="flex items-center justify-center py-10 text-gray-400">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-3" />
            데이터 로딩 중...
          </div>
        ) : messages.length === 0 ? (
          <div className="py-6">
            {/* Value Proposition */}
            <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-100 mb-6 p-4">
              <p className="text-sm text-gray-700 leading-relaxed">
                <strong className="text-blue-700">대시보드로는 답할 수 없는 질문</strong>에 AI가 답합니다.
                &quot;왜 불량률이 올랐지?&quot;, &quot;어떤 채널에 집중해야 하지?&quot; 같은 맥락적 질문을 자연어로 하면
                데이터를 분석해서 근거와 함께 답변합니다.
              </p>
            </Card>

            {/* Categorized Preset Questions */}
            <div className="space-y-4">
              {INITIAL_PRESETS.map((cat) => (
                <div key={cat.category}>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">
                    {cat.category}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {cat.questions.map((q, i) => (
                      <button
                        key={i}
                        onClick={() => sendMessage(q)}
                        className="text-xs bg-white border border-gray-200 rounded-full px-3 py-1.5 text-gray-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-all text-left"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div
              key={idx}
              className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}
            >
              <div className={cn(
                'rounded-2xl px-4 py-3',
                msg.role === 'user'
                  ? 'max-w-[80%] bg-blue-600 text-white rounded-br-md'
                  : 'max-w-[90%] bg-white border shadow-sm rounded-bl-md'
              )}>
                {msg.role === 'user' ? (
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                ) : msg.content ? (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={markdownComponents}
                  >
                    {msg.content}
                  </ReactMarkdown>
                ) : (
                  <div className="flex items-center gap-1.5 py-1">
                    <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Dynamic Preset Questions — 대화 후에도 항상 표시 */}
      {!isLoading && !contextLoading && (
        <div className="flex-shrink-0 flex gap-1.5 mb-2 overflow-x-auto pb-1">
          {(dynamicPresets || INITIAL_PRESETS.flatMap(c => c.questions).slice(0, 4)).map((q, i) => (
            <button
              key={`${q}-${i}`}
              onClick={() => sendMessage(q)}
              className="text-[11px] bg-white border border-gray-200 rounded-full px-2.5 py-1 text-gray-500 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-all whitespace-nowrap flex-shrink-0"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex-shrink-0 flex gap-2">
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={contextLoading ? '데이터 로딩 중...' : '생산 데이터에 대해 질문하세요...'}
          disabled={isLoading || contextLoading}
          className="flex-1"
          autoFocus
        />
        <Button type="submit" disabled={!input.trim() || isLoading || contextLoading}>
          {isLoading ? '답변 중...' : '전송'}
        </Button>
      </form>
    </div>
  )
}
