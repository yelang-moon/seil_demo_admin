'use client'

import { useState, useRef, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'
import { Production } from '@/types/database'
import { useFactory } from '@/contexts/factory-context'

type PresetType = '1month' | '3months' | '6months' | 'custom'

interface CacheRecord {
  id: number
  cache_key: string
  insight_text: string
  updated_at: string
}

const PRESET_LABELS: Record<string, string> = {
  '1month': '1개월',
  '3months': '3개월',
  '6months': '6개월',
}

const PRESET_DAYS: Record<string, number> = {
  '1month': 30,
  '3months': 90,
  '6months': 180,
}

export default function AIInsightPage() {
  const { factory } = useFactory()
  const [activePreset, setActivePreset] = useState<PresetType>('1month')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [latestDate, setLatestDate] = useState('')
  const [markdown, setMarkdown] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingCache, setCheckingCache] = useState(false)
  const [cachedAt, setCachedAt] = useState<string | null>(null)
  const [reportHistory, setReportHistory] = useState<CacheRecord[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  const applyPreset = (preset: PresetType, baseDate: string) => {
    if (preset === 'custom') return
    const days = PRESET_DAYS[preset] || 30
    const end = new Date(baseDate + 'T00:00:00')
    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000)
    setStartDate(start.toISOString().split('T')[0])
    setEndDate(baseDate)
    setActivePreset(preset)
  }

  const handlePresetClick = (preset: PresetType) => {
    if (latestDate) applyPreset(preset, latestDate)
  }

  const handleCustomDateChange = (type: 'start' | 'end', value: string) => {
    if (type === 'start') setStartDate(value)
    else setEndDate(value)
    setActivePreset('custom')
  }

  const getCacheKey = () => `ai-insight-${factory}-${startDate}-${endDate}`

  // Fetch latest date on mount
  useEffect(() => {
    const fetchLatestDate = async () => {
      try {
        const { data } = await supabase
          .from('fact_production')
          .select('production_date')
          .eq('factory', factory)
          .order('production_date', { ascending: false })
          .limit(1)
        if (data && data.length > 0) {
          const latest = data[0].production_date
          setLatestDate(latest)
          applyPreset('1month', latest)
        }
      } catch (error) {
        console.error('Error fetching latest date:', error)
      }
    }
    fetchLatestDate()
  }, [factory])

  // Fetch report history
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const { data } = await supabase
          .from('ai_insight_cache')
          .select('id, cache_key, insight_text, updated_at')
          .like('cache_key', `ai-insight-${factory}-%`)
          .order('updated_at', { ascending: false })
          .limit(20)
        if (data) setReportHistory(data as CacheRecord[])
      } catch (error) {
        console.error('Error fetching history:', error)
      }
    }
    fetchHistory()
  }, [factory, cachedAt])

  // Check cache on dates change
  useEffect(() => {
    if (!startDate || !endDate) return
    const checkCache = async () => {
      setCheckingCache(true)
      try {
        const { data } = await supabase
          .from('ai_insight_cache')
          .select('insight_text, updated_at')
          .eq('cache_key', getCacheKey())
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
  }, [startDate, endDate, factory])

  const fetchProductionData = async () => {
    try {
      if (!startDate || !endDate) return []

      const { data, error } = await supabase
        .from('fact_production')
        .select('*')
        .eq('factory', factory)
        .gte('production_date', startDate)
        .lte('production_date', endDate)
        .order('production_date', { ascending: false })

      if (error) throw error
      return (data as Production[]) || []
    } catch (error) {
      console.error('Failed to fetch production data:', error)
      return []
    }
  }

  const fetchShipmentData = async () => {
    try {
      if (!startDate || !endDate) return null

      const { data, error } = await supabase
        .from('fact_shipment')
        .select('*')
        .eq('factory', factory)
        .gte('shipment_date', startDate)
        .lte('shipment_date', endDate)
        .order('shipment_date', { ascending: false })

      if (error) throw error
      if (!data || data.length === 0) return null

      // Aggregate daily shipments
      const dailyMap: Record<string, number> = {}
      const customerMap: Record<string, { totalQty: number; count: number }> = {}
      const productMap: Record<string, { totalQty: number; count: number }> = {}

      data.forEach((s: { shipment_date: string; shipped_qty: number; customer_name: string; product_name: string }) => {
        const date = s.shipment_date || ''
        const qty = s.shipped_qty || 0
        const customer = s.customer_name || '미지정'
        const product = s.product_name || '미지정'

        dailyMap[date] = (dailyMap[date] || 0) + qty

        if (!customerMap[customer]) customerMap[customer] = { totalQty: 0, count: 0 }
        customerMap[customer].totalQty += qty
        customerMap[customer].count += 1

        if (!productMap[product]) productMap[product] = { totalQty: 0, count: 0 }
        productMap[product].totalQty += qty
        productMap[product].count += 1
      })

      return {
        dailyShipments: Object.entries(dailyMap)
          .map(([date, qty]) => ({ date, quantity: qty }))
          .sort((a, b) => a.date.localeCompare(b.date)),
        customerSummary: customerMap,
        productShipmentSummary: productMap,
      }
    } catch (error) {
      console.error('Failed to fetch shipment data:', error)
      return null
    }
  }

  const fetchSafetyStockData = async () => {
    try {
      const { data, error } = await supabase
        .from('dim_product')
        .select('product_code, product_name, safety_stock_qty, current_stock_qty, daily_max_qty')
        .eq('factory', factory)
        .gt('safety_stock_qty', 0)

      if (error) throw error
      if (!data || data.length === 0) return null

      // Get recent 7-day shipment data per product
      const { data: recentShipments } = await supabase
        .from('fact_shipment')
        .select('product_name, shipped_qty')
        .eq('factory', factory)
        .gte('shipment_date', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])

      const shipmentByProduct: Record<string, number> = {}
      if (recentShipments) {
        recentShipments.forEach((s: { product_name: string; shipped_qty: number }) => {
          const key = s.product_name || ''
          shipmentByProduct[key] = (shipmentByProduct[key] || 0) + (s.shipped_qty || 0)
        })
      }

      return data.map((p: { product_code: string; product_name: string; safety_stock_qty: number; current_stock_qty: number; daily_max_qty: number }) => {
        const safetyStock = p.safety_stock_qty || 0
        const currentStock = p.current_stock_qty || 0
        const stockRatio = safetyStock > 0 ? Math.round((currentStock / safetyStock) * 100) : 0
        const avgDaily7d = (shipmentByProduct[p.product_name] || 0) / 7
        const daysRemaining = avgDaily7d > 0 ? Math.round((currentStock / avgDaily7d) * 10) / 10 : null

        let urgency = '양호'
        if (avgDaily7d > 0) {
          if (daysRemaining !== null && daysRemaining < 3) urgency = '긴급'
          else if (daysRemaining !== null && daysRemaining < 7) urgency = '우선'
          else if (stockRatio < 100 || (daysRemaining !== null && daysRemaining < 14)) urgency = '주의'
        } else {
          if (stockRatio < 50) urgency = '주의'
        }

        return {
          제품명: p.product_name,
          안전재고: safetyStock,
          현재재고: currentStock,
          재고율: `${stockRatio}%`,
          일평균출하량_7d: Math.round(avgDaily7d * 10) / 10,
          잔여일수: daysRemaining,
          긴급도: urgency,
        }
      }).sort((a: { 긴급도: string }, b: { 긴급도: string }) => {
        const order: Record<string, number> = { '긴급': 0, '우선': 1, '주의': 2, '양호': 3 }
        return (order[a.긴급도] ?? 4) - (order[b.긴급도] ?? 4)
      })
    } catch (error) {
      console.error('Failed to fetch safety stock data:', error)
      return null
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

  const periodLabel = startDate && endDate ? `${startDate} ~ ${endDate}` : ''

  const handleAnalyze = async () => {
    setLoading(true)
    setMarkdown('')
    setCachedAt(null)
    setShowHistory(false)

    try {
      const [productions, shipmentData, safetyStockData] = await Promise.all([
        fetchProductionData(),
        fetchShipmentData(),
        fetchSafetyStockData(),
      ])

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
          period: periodLabel,
          productionData: aggregated.dailyTotals,
          equipmentData: aggregated.equipmentSummary,
          productData: aggregated.productSummary,
          shipmentData,
          safetyStockData,
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
            { cache_key: getCacheKey(), insight_text: result, updated_at: new Date().toISOString() },
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

  const loadHistoryReport = (record: CacheRecord) => {
    setMarkdown(record.insight_text)
    setCachedAt(new Date(record.updated_at).toLocaleString('ko-KR'))
    // Parse dates from cache_key: ai-insight-factory-startDate-endDate
    const parts = record.cache_key.split('-')
    if (parts.length >= 5) {
      // cache_key format: ai-insight-{factory}-{YYYY-MM-DD}-{YYYY-MM-DD}
      const keyWithoutPrefix = record.cache_key.replace(`ai-insight-${factory}-`, '')
      const dateParts = keyWithoutPrefix.split('-')
      if (dateParts.length >= 6) {
        const s = `${dateParts[0]}-${dateParts[1]}-${dateParts[2]}`
        const e = `${dateParts[3]}-${dateParts[4]}-${dateParts[5]}`
        setStartDate(s)
        setEndDate(e)
        setActivePreset('custom')
      }
    }
    setShowHistory(false)
  }

  const parsePeriodFromKey = (cacheKey: string) => {
    const keyWithoutPrefix = cacheKey.replace(`ai-insight-${factory}-`, '')
    const dateParts = keyWithoutPrefix.split('-')
    if (dateParts.length >= 6) {
      return `${dateParts[0]}-${dateParts[1]}-${dateParts[2]} ~ ${dateParts[3]}-${dateParts[4]}-${dateParts[5]}`
    }
    return cacheKey
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="flex-shrink-0 space-y-4 pb-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">AI 인사이트</h1>
          <p className="text-gray-600 mt-2">Claude AI를 활용한 종합 생산·출하·재고 분석 리포트</p>
        </div>

        <Card className="p-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-gray-700">분석 기간:</span>
              {Object.entries(PRESET_LABELS).map(([key, label]) => (
                <Button
                  key={key}
                  size="sm"
                  variant={activePreset === key ? 'default' : 'outline'}
                  onClick={() => handlePresetClick(key as PresetType)}
                  className="h-7 px-2.5 text-xs"
                >
                  {label}
                </Button>
              ))}
              <div className="flex items-center gap-1 ml-1">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => handleCustomDateChange('start', e.target.value)}
                  className="px-2 py-1 border border-gray-300 rounded text-xs h-7 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <span className="text-gray-400 text-xs">~</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => handleCustomDateChange('end', e.target.value)}
                  className="px-2 py-1 border border-gray-300 rounded text-xs h-7 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Button onClick={handleAnalyze} disabled={loading} size="sm">
                {loading ? '분석 중...' : markdown ? '재분석' : 'AI 분석 시작'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowHistory(!showHistory)}
                className="h-7 px-2.5 text-xs"
              >
                {showHistory ? '리포트 목록 닫기' : `이전 리포트 (${reportHistory.length})`}
              </Button>
              {cachedAt && (
                <p className="text-xs text-gray-400">
                  마지막 분석: {cachedAt}
                </p>
              )}
            </div>
          </div>
        </Card>

        {showHistory && reportHistory.length > 0 && (
          <Card className="p-3">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">이전 분석 리포트</h3>
            <div className="max-h-48 overflow-y-auto space-y-1">
              {reportHistory.map((record) => {
                const isActive = record.cache_key === getCacheKey()
                return (
                  <button
                    key={record.id}
                    onClick={() => loadHistoryReport(record)}
                    className={`w-full text-left px-3 py-2 rounded text-xs transition-colors ${
                      isActive
                        ? 'bg-blue-50 border border-blue-200 text-blue-700'
                        : 'hover:bg-gray-50 border border-transparent text-gray-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{parsePeriodFromKey(record.cache_key)}</span>
                      <span className="text-gray-400 ml-2">
                        {new Date(record.updated_at).toLocaleString('ko-KR', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="text-gray-400 mt-0.5 truncate">
                      {record.insight_text.substring(0, 80)}...
                    </p>
                  </button>
                )
              })}
            </div>
          </Card>
        )}
      </div>

      {checkingCache && (
        <div className="text-center py-8 text-gray-500">캐시 확인 중...</div>
      )}

      {markdown && (
        <Card className="overflow-hidden flex-1 min-h-0">
          <div
            ref={contentRef}
            className="overflow-y-auto p-6 md:p-8 h-full"
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

      {!markdown && !checkingCache && !loading && !showHistory && (
        <Card className="p-12 text-center text-gray-500 flex-1 flex items-center justify-center">
          <div>
            <p className="text-lg mb-2">아직 분석 결과가 없습니다</p>
            <p className="text-sm">위 &quot;AI 분석 시작&quot; 버튼을 눌러 생산·출하·재고 종합 분석을 실행하세요.</p>
          </div>
        </Card>
      )}
    </div>
  )
}
