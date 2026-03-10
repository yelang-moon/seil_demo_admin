'use client'

import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { supabase } from '@/lib/supabase'
import { Production } from '@/types/database'

type Period = '1month' | '3months' | '6months'

interface AggregatedData {
  dailyTotals: { date: string; quantity: number; defectRate: number }[]
  equipmentSummary: Record<string, { totalQty: number; defectQty: number }>
  productSummary: Record<string, { totalQty: number; count: number }>
  workerSummary: Record<string, { totalQty: number; count: number }>
  defectRates: { date: string; rate: number }[]
}

export default function AIInsightPage() {
  const [period, setPeriod] = useState<Period>('1month')
  const [markdown, setMarkdown] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('production-efficiency')
  const contentRef = useRef<HTMLDivElement>(null)

  const getPeriodDays = (p: Period): number => {
    switch (p) {
      case '1month':
        return 30
      case '3months':
        return 90
      case '6months':
        return 180
      default:
        return 30
    }
  }

  const fetchProductionData = async () => {
    try {
      const days = getPeriodDays(period)
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - days)
      const startDateStr = startDate.toISOString().split('T')[0]

      const { data, error } = await supabase
        .from('production')
        .select('*')
        .gte('production_date', startDateStr)
        .order('production_date', { ascending: false })

      if (error) throw error

      return (data as Production[]) || []
    } catch (error) {
      console.error('Failed to fetch production data:', error)
      return []
    }
  }

  const aggregateData = (productions: Production[]): AggregatedData => {
    const dailyTotals: Record<string, { quantity: number; defectQty: number }> = {}
    const equipmentSummary: Record<string, { totalQty: number; defectQty: number }> = {}
    const productSummary: Record<string, { totalQty: number; count: number }> = {}
    const workerSummary: Record<string, { totalQty: number; count: number }> = {}

    productions.forEach((prod) => {
      const date = prod.production_date || new Date().toISOString().split('T')[0]
      const qty = prod.finished_qty || 0
      const defectQty = prod.defect_qty || 0

      // Daily totals
      if (!dailyTotals[date]) {
        dailyTotals[date] = { quantity: 0, defectQty: 0 }
      }
      dailyTotals[date].quantity += qty
      dailyTotals[date].defectQty += defectQty

      // Equipment summary
      const equip = prod.equipment_name || '미지정'
      if (!equipmentSummary[equip]) {
        equipmentSummary[equip] = { totalQty: 0, defectQty: 0 }
      }
      equipmentSummary[equip].totalQty += qty
      equipmentSummary[equip].defectQty += defectQty

      // Product summary
      const productKey = prod.product_name || prod.product_code || '미지정'
      if (!productSummary[productKey]) {
        productSummary[productKey] = { totalQty: 0, count: 0 }
      }
      productSummary[productKey].totalQty += qty
      productSummary[productKey].count += 1

      // Worker summary
      const worker = prod.tech_worker || '미지정'
      if (!workerSummary[worker]) {
        workerSummary[worker] = { totalQty: 0, count: 0 }
      }
      workerSummary[worker].totalQty += qty
      workerSummary[worker].count += 1
    })

    const defectRates = Object.entries(dailyTotals)
      .map(([date, data]) => ({
        date,
        rate: data.quantity > 0 ? (data.defectQty / data.quantity) * 100 : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

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
      workerSummary,
      defectRates,
    }
  }

  const handleAnalyze = async () => {
    setLoading(true)
    setMarkdown('')

    try {
      const productions = await fetchProductionData()
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

      if (!response.ok) {
        throw new Error('AI 분석 요청 실패')
      }

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

        // Scroll to bottom as content streams in
        if (contentRef.current) {
          contentRef.current.scrollTop = contentRef.current.scrollHeight
        }
      }
    } catch (error) {
      console.error('Analysis error:', error)
      setMarkdown('분석 중 오류가 발생했습니다. 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  const periodLabels: Record<Period, string> = {
    '1month': '최근 1개월',
    '3months': '최근 3개월',
    '6months': '최근 6개월',
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
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="inline-flex">
                  <span className="animate-pulse">분석 중</span>
                  <span className="animate-pulse" style={{ animationDelay: '0.1s' }}>
                    .
                  </span>
                  <span className="animate-pulse" style={{ animationDelay: '0.2s' }}>
                    .
                  </span>
                </span>
              </span>
            ) : (
              <>🤖 AI 분석 시작</>
            )}
          </Button>
        </div>
      </Card>

      {markdown && (
        <Card className="overflow-hidden">
          <div className="border-b bg-gray-50 p-4">
            <Button variant="outline" onClick={handleAnalyze} disabled={loading}>
              다시 분석
            </Button>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full justify-start rounded-none border-b bg-white px-4">
              <TabsTrigger value="production-efficiency">생산 효율</TabsTrigger>
              <TabsTrigger value="quality-defect">품질/불량</TabsTrigger>
              <TabsTrigger value="worker-productivity">작업자 생산성</TabsTrigger>
            </TabsList>

            <div
              ref={contentRef}
              className="prose prose-sm max-w-none overflow-y-auto p-6 max-h-[600px]"
            >
              <TabsContent value="production-efficiency" className="mt-0">
                <ReactMarkdown>{markdown}</ReactMarkdown>
              </TabsContent>
              <TabsContent value="quality-defect" className="mt-0">
                <ReactMarkdown>{markdown}</ReactMarkdown>
              </TabsContent>
              <TabsContent value="worker-productivity" className="mt-0">
                <ReactMarkdown>{markdown}</ReactMarkdown>
              </TabsContent>
            </div>
          </Tabs>
        </Card>
      )}
    </div>
  )
}
