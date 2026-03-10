'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useFactory } from '@/contexts/factory-context'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import ReactMarkdown from 'react-markdown'

interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: Date
}

const QUICK_QUESTIONS = [
  '오늘 생산 현황 요약해줘',
  '불량률이 가장 높은 설비는?',
  '이번 달 출하 매출 TOP 5 알려줘',
  '안전재고 부족한 제품 있어?',
  '가동률이 가장 낮은 설비는?',
  '쿠팡 출하 추이 분석해줘',
]

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

  // Fetch context data on mount / factory change
  const fetchContext = useCallback(async () => {
    setContextLoading(true)
    try {
      // Get latest 30 days data summary
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

      // Parallel fetch
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

      // ERP prices
      const { data: erpItems } = await supabase.from('dim_erp_item').select('item_name, sales_price')
      const priceMap = new Map<string, number>()
      erpItems?.forEach(i => { if (i.sales_price) priceMap.set(i.item_name, i.sales_price) })

      // Summarize production
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

      // Summarize shipments by customer
      const custShip = new Map<string, { qty: number; revenue: number }>()
      ships.forEach(s => {
        const c = s.customer_name || '기타'
        if (!custShip.has(c)) custShip.set(c, { qty: 0, revenue: 0 })
        const cs = custShip.get(c)!
        cs.qty += s.shipped_qty || 0
        cs.revenue += (s.shipped_qty || 0) * (priceMap.get(s.product_name) || 0)
      })

      // Summarize product shipments
      const prodShip = new Map<string, { qty: number; revenue: number }>()
      ships.forEach(s => {
        const p = s.product_name || '기타'
        if (!prodShip.has(p)) prodShip.set(p, { qty: 0, revenue: 0 })
        const ps = prodShip.get(p)!
        ps.qty += s.shipped_qty || 0
        ps.revenue += (s.shipped_qty || 0) * (priceMap.get(s.product_name) || 0)
      })

      // Safety stock
      const stockAlerts = products.filter(p =>
        p.safety_stock_qty && p.current_stock_qty !== null && p.current_stock_qty !== undefined &&
        p.current_stock_qty < p.safety_stock_qty
      )

      // Build context string
      let ctx = `분석 기간: ${startStr} ~ ${latestDate} (${factory})\n\n`

      ctx += `### 생산 요약\n`
      ctx += `- 총 생산량: ${totalProd.toLocaleString()}, 총 불량: ${totalDefect.toLocaleString()}, 불량률: ${totalProd > 0 ? ((totalDefect / totalProd) * 100).toFixed(2) : 0}%\n`
      ctx += `- 설비별:\n`
      Array.from(equipProd.entries())
        .sort((a, b) => b[1].qty - a[1].qty)
        .forEach(([name, data]) => {
          const official = equipNameMap.get(name) || name
          const maxQty = products.find(p => p.equipment_name === name)?.daily_max_qty || 0
          const util = maxQty > 0 && data.days.size > 0 ? (data.qty / (maxQty * data.days.size)) * 100 : 0
          ctx += `  - ${official}: 생산 ${data.qty.toLocaleString()}, 불량 ${data.defect.toLocaleString()} (${data.qty > 0 ? ((data.defect / data.qty) * 100).toFixed(1) : 0}%), 가동일 ${data.days.size}일, 가동률 ${util.toFixed(1)}%\n`
        })

      ctx += `\n### 출하 요약\n`
      ctx += `- 총 출하: ${ships.reduce((s, r) => s + (r.shipped_qty || 0), 0).toLocaleString()}\n`
      ctx += `- 채널별 매출:\n`
      Array.from(custShip.entries())
        .sort((a, b) => b[1].revenue - a[1].revenue)
        .forEach(([name, data]) => {
          ctx += `  - ${name}: ${data.qty.toLocaleString()}개, ${Math.round(data.revenue).toLocaleString()}원\n`
        })

      ctx += `\n- 제품별 출하 TOP 10:\n`
      Array.from(prodShip.entries())
        .sort((a, b) => b[1].revenue - a[1].revenue)
        .slice(0, 10)
        .forEach(([name, data]) => {
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

    const userMsg: Message = { role: 'user', content: text.trim(), timestamp: new Date() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsLoading(true)

    const assistantMsg: Message = { role: 'assistant', content: '', timestamp: new Date() }
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
          생산 · 출하 · 재고 데이터에 대해 자유롭게 질문하세요 · {factory}
        </p>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto rounded-lg bg-gray-50 border p-4 space-y-4 mb-4">
        {contextLoading ? (
          <div className="flex items-center justify-center py-10 text-gray-400">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-3" />
            데이터 컨텍스트 로딩 중...
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-3 opacity-30">💬</div>
            <p className="text-gray-500 text-sm mb-6">무엇이든 물어보세요! 생산, 출하, 재고, 품질 데이터를 분석해드립니다.</p>

            {/* Quick Question Chips */}
            <div className="flex flex-wrap justify-center gap-2 max-w-lg mx-auto">
              {QUICK_QUESTIONS.map((q, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(q)}
                  className="text-xs bg-white border border-gray-200 rounded-full px-3 py-1.5 text-gray-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-all"
                >
                  {q}
                </button>
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
                'max-w-[85%] rounded-2xl px-4 py-3',
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-md'
                  : 'bg-white border shadow-sm rounded-bl-md'
              )}>
                {msg.role === 'user' ? (
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                ) : msg.content ? (
                  <div className="prose prose-sm max-w-none prose-table:text-xs prose-th:px-2 prose-td:px-2 prose-th:py-1 prose-td:py-1">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
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

      {/* Quick Suggestions (shown when there are messages) */}
      {messages.length > 0 && !isLoading && (
        <div className="flex-shrink-0 flex gap-1.5 mb-2 overflow-x-auto pb-1">
          {['후속 분석해줘', '테이블로 정리해줘', '개선 방안 제안해줘', '추이 분석해줘'].map((q, i) => (
            <button
              key={i}
              onClick={() => sendMessage(q)}
              className="text-[11px] bg-gray-100 rounded-full px-2.5 py-1 text-gray-500 hover:bg-blue-50 hover:text-blue-600 transition-all whitespace-nowrap flex-shrink-0"
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
