'use client'

import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { supabase } from '@/lib/supabase'
import { Production } from '@/types/database'
import { useFactory } from '@/contexts/factory-context'

type Period = '1month' | '3months' | '6months'

export default function AIInsightPage() {
  const { factory } = useFactory()
  const [period, setPeriod] = useState<Period>('1month')
  const [markdown, setMarkdown] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingCache, setCheckingCache] = useState(false)
  const [cachedAt, setCachedAt] = useState<string | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  const getPeriodDays = (p: Period): number => {
    switch (p) {
      case '1month': return 30
      case '3months': return 90
      case '6months': return 180
      default: return 30
    }
  }

  const getCacheKey = (p: Period) => `ai-insight-${factory}-${p}`

  // Check cache on mount and period change
  useEffect(() => {
    const checkCache = async () => {
      setCheckingCache(true)
      try {
        const { data } = await supabase
          .from('ai_insight_cache')
          .select('insight_text, updated_at')
          .eq('cache_key', getCacheKey(period))
          .single()

        if (data) {
          setMarkdown(data.insight_text)
          setCachedAt(new Date(data.updated_at).toLocaleString('ko-KR'))
        } else {
          setMarkdown('')
          setCachedAt(null)
        }
      } catch {
        setMarkdown('')
        setCachedAt(null)
      } finally {
        setCheckingCache(false)
      }
    }
    checkCache()
  }, [period, factory])

  const fetchProductionData = async () => {
    try {
      const { data: latestRow } = await supabase
        .from('fact_production')
        .select('production_date')
        .eq('factory', factory)
        .order('production_date', { ascending: false })
        .limit(1)

      if (!latestRow || latestRow.length === 0) return []

      const latestDate = latestRow[0].production_date
      const days = getPeriodDays(period)
      const endDate = new Date(latestDate + 'T00:00:00')
      const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000)
      const startDateStr = startDate.toISOString().split('T')[0]

      const { data, error } = await supabase
        .from('fact_production')
        .select('*')
        .eq('factory', factory)
        .gte('production_date', startDateStr)
        .lte('production_date', latestDate)
        .order('production_date', { ascending: false })

      if (error) throw error
      return (data as Production[]) || []
    } catch (error) {
      console.error('Failed to fetch production data:', error)
      return []
    }
  }

  const aggregateData = (productions: Production[]) => {
    const dailyTotals: Record<string, { quantity: number; defectQty: number }> = {}
    const equipmentSummary: Record<string, { totalQty: number; defectQty: number }> = {}
    const productSummary: Record<string, { totalQty: number; count: number }> = {}

    productions.forEach((prod) => {
      const date = prod.production_date || ''
      const qty = prod.finished_qty || 0
      const defectQty = prod.defect_qty || 0

      if (!dailyTotals[date]) dailyTotals[date] = { quantity: 0, defectQty: 0 }
      dailyTotals[date].quantity += qty
      dailyTotals[date].defectQty += defectQty

      const equip = prod.equipment_name || '미지정'
      if (!equipmentSummary[equip]) equipmentSummary[equip] = { totalQty: 0, defectQty: 0 }
      equipmentSummary[equip].totalQty += qty
      equipmentSummary[equip].defectQty += defectQty

      const productKey = prod.product_name || prod.product_code || '미지정'
      if (!productSummary[productKey]) productSummary[productKey] = { totalQty: 0, count: 0 }
      productSummary[productKey].totalQty += qty
      productSummary[productKey].count += 1
    })

    return {
      dailyTotals: Object.entries(dailyTotals)
        .map(([date, data]) => ({
          date,
          quantity: data.quantity,
          defectRate: data.quantity > 0 ? (data.defectQty / data.quantity) * 100 : 0,
        }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      equipmentSummary,
      productSummary,
    }
  }

  const handleAnalyze = async () => {
    setLoading(true)
    setMarkdown('')
    setCachedAt(null)

    try {
      const productions = await fetchProductionData()
      if (productions.length === 0) {
        setMarkdown('분석할 생산 데이터가 없습니다.')
        setLoading(false)
        return
      }

      const aggregated = aggregateData(productions)

      const response = await fetch('/api/ai/insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          period,
          productionData: aggregated.dailyTotals,
          equipmentData: aggregated.equipmentSummary,
          productData: aggregated.productSummary,
        }),
      })

      if (!response.ok) throw new Error('AI 분석 요청 실패')

      const reader = response.body?.getReader()
      if (!reader) throw new Error('Stream reader not available')

      const decoder = new TextDecoder()
      let result = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        result += chunk
        setMarkdown(result)
        if (contentRef.current) {
          contentRef.current.scrollTop = contentRef.current.scrollHeight
        }
      }

      // Save to cache
      if (result) {
        await supabase
          .from('ai_insight_cache')
          .upsert(
            { cache_key: getCacheKey(period), insight_text: result, updated_at: new Date().toISOString() },
            { onConflict: 'cache_key' }
          )
        setCachedAt(new Date().toLocaleString('ko-KR'))
      }
    } catch (error) {
      console.error('Analysis error:', error)
      setMarkdown('분석 중 오류가 발생했습니다. 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">AI 생산분석</h1>
        <p className="text-gray-600 mt-2">Claude AI를 활용한 종합 생산분석 리포트</p>
      </div>

      <Card className="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">분석 기간</label>
            <Select value={period} onValueChange={(value) => setPeriod(value as Period)}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1month">최근 1개월</SelectItem>
                <SelectItem value="3months">최근 3개월</SelectItem>
                <SelectItem value="6months">최근 6개월</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleAnalyze} disabled={loading} size="lg">
            {loading ? '분석 중...' : markdown ? '재분석' : 'AI 분석 시작'}
          </Button>

          {cachedAt && (
            <p className="text-xs text-gray-400 self-center">
              마지막 분석: {cachedAt}
            </p>
          )}
        </div>
      </Card>

      {checkingCache && (
        <div className="text-center py-8 text-gray-500">캐시 확인 중...</div>
      )}

      {markdown && (
        <Card className="overflow-hidden">
          <div
            ref={contentRef}
            className="overflow-y-auto p-6 md:p-8 max-h-[700px]"
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children, ...props }) => (
                  <h1 className="text-2xl font-bold text-gray-900 mt-6 mb-3 pb-2 border-b border-gray-200" {...props}>{children}</h1>
                ),
                h2: ({ children, ...props }) => (
                  <h2 className="text-xl font-bold text-gray-900 mt-8 mb-3 pb-2 border-b border-gray-200" {...props}>{children}</h2>
                ),
                h3: ({ children, ...props }) => (
                  <h3 className="text-lg font-semibold text-gray-800 mt-5 mb-2" {...props}>{children}</h3>
                ),
                h4: ({ children, ...props }) => (
                  <h4 className="text-base font-semibold text-gray-700 mt-4 mb-2" {...props}>{children}</h4>
                ),
                p: ({ children, ...props }) => (
                  <p className="text-sm text-gray-700 leading-relaxed mb-3" {...props}>{children}</p>
                ),
                ul: ({ children, ...props }) => (
                  <ul className="list-disc pl-6 mb-3 space-y-1 text-sm text-gray-700" {...props}>{children}</ul>
                ),
                ol: ({ children, ...props }) => (
                  <ol className="list-decimal pl-6 mb-3 space-y-1 text-sm text-gray-700" {...props}>{children}</ol>
                ),
                li: ({ children, ...props }) => (
                  <li className="leading-relaxed" {...props}>{children}</li>
                ),
                strong: ({ children, ...props }) => (
                  <strong className="font-bold text-gray-900" {...props}>{children}</strong>
                ),
                blockquote: ({ children, ...props }) => (
                  <blockquote className="border-l-4 border-blue-400 bg-blue-50 pl-4 py-2 my-3 text-sm text-gray-700 italic" {...props}>{children}</blockquote>
                ),
                table: ({ children, ...props }) => (
                  <div className="overflow-x-auto my-4 rounded-lg border border-gray-200">
                    <table className="min-w-full text-sm" {...props}>
                      {children}
                    </table>
                  </div>
                ),
                thead: ({ children, ...props }) => (
                  <thead className="bg-gray-100 border-b border-gray-200" {...props}>{children}</thead>
                ),
                th: ({ children, ...props }) => (
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider" {...props}>{children}</th>
                ),
                td: ({ children, ...props }) => (
                  <td className="px-4 py-2 text-gray-700 border-t border-gray-100" {...props}>{children}</td>
                ),
                tr: ({ children, ...props }) => (
                  <tr className="even:bg-gray-50 hover:bg-gray-100 transition-colors" {...props}>{children}</tr>
                ),
                hr: ({ ...props }) => (
                  <hr className="my-6 border-gray-200" {...props} />
                ),
                code: ({ children, className, ...props }) => {
                  const isBlock = className?.includes('language-')
                  if (isBlock) {
                    return <code className={`block bg-gray-900 text-green-400 p-4 rounded-lg text-xs overflow-x-auto my-3 ${className || ''}`} {...props}>{children}</code>
                  }
                  return <code className="bg-gray-100 text-red-600 px-1.5 py-0.5 rounded text-xs font-mono" {...props}>{children}</code>
                },
              }}
            >{markdown}</ReactMarkdown>
          </div>
        </Card>
      )}

      {!markdown && !checkingCache && !loading && (
        <Card className="p-12 text-center text-gray-500">
          <p className="text-lg mb-2">아직 분석 결과가 없습니다</p>
          <p className="text-sm">위 &quot;AI 분석 시작&quot; 버튼을 눌러 분석을 실행하세요.</p>
        </Card>
      )}
    </div>
  )
}
