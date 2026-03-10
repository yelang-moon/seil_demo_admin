'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useFactory } from '@/contexts/factory-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

// ---------- Channel Classification ----------
// B2B 식품사: CJ제일제당, 대상, 동원F&B, 매일유업, 빙그레, 오뚜기, 풀무원
// 온라인 마켓: 11번가, SSG.COM, 네이버스토어, 옥션, 지마켓, 쿠팡
// 해외: 아마존

type ChannelType = '해외' | '온라인 마켓플레이스' | 'B2B 식품사' | '기타'

const CHANNEL_TYPE_MAP: Record<string, ChannelType> = {
  '아마존': '해외',
  '11번가': '온라인 마켓플레이스',
  'SSG.COM': '온라인 마켓플레이스',
  '네이버스토어': '온라인 마켓플레이스',
  '옥션': '온라인 마켓플레이스',
  '지마켓': '온라인 마켓플레이스',
  '쿠팡': '온라인 마켓플레이스',
  'CJ제일제당': 'B2B 식품사',
  '대상': 'B2B 식품사',
  '동원F&B': 'B2B 식품사',
  '매일유업': 'B2B 식품사',
  '빙그레': 'B2B 식품사',
  '오뚜기': 'B2B 식품사',
  '풀무원': 'B2B 식품사',
}

function getChannelType(name: string): ChannelType {
  return CHANNEL_TYPE_MAP[name] || '기타'
}

const TYPE_COLORS: Record<ChannelType, string> = {
  '해외': '#EF4444',
  '온라인 마켓플레이스': '#3B82F6',
  'B2B 식품사': '#10B981',
  '기타': '#9CA3AF',
}

const TYPE_BG: Record<ChannelType, string> = {
  '해외': 'bg-red-50 border-red-200',
  '온라인 마켓플레이스': 'bg-blue-50 border-blue-200',
  'B2B 식품사': 'bg-emerald-50 border-emerald-200',
  '기타': 'bg-gray-50 border-gray-200',
}

const TYPE_TEXT: Record<ChannelType, string> = {
  '해외': 'text-red-700',
  '온라인 마켓플레이스': 'text-blue-700',
  'B2B 식품사': 'text-emerald-700',
  '기타': 'text-gray-700',
}

const INDIVIDUAL_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#06B6D4', '#F97316', '#6366F1', '#14B8A6',
]

interface ChannelDetail {
  name: string
  type: ChannelType
  revenue: number
  quantity: number
  orderCount: number
  productCount: number
  topProducts: { name: string; qty: number; revenue: number }[]
}

interface TypeSummary {
  type: ChannelType
  revenue: number
  quantity: number
  channelCount: number
  channels: string[]
  monthlyRevenue: Map<string, number>
}

interface MonthlyTypeData {
  month: string
  해외: number
  '온라인 마켓플레이스': number
  'B2B 식품사': number
  기타: number
}

export default function ChannelStrategyPage() {
  const { factory } = useFactory()
  const [channelDetails, setChannelDetails] = useState<ChannelDetail[]>([])
  const [typeSummaries, setTypeSummaries] = useState<TypeSummary[]>([])
  const [monthlyTypeData, setMonthlyTypeData] = useState<MonthlyTypeData[]>([])
  const [totalRevenue, setTotalRevenue] = useState(0)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('6m')
  const [selectedType, setSelectedType] = useState<ChannelType | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: latestRow } = await supabase
        .from('fact_shipment')
        .select('shipment_date')
        .eq('factory', factory)
        .order('shipment_date', { ascending: false })
        .limit(1)

      if (!latestRow?.length) {
        setChannelDetails([])
        setTypeSummaries([])
        setLoading(false)
        return
      }

      const latestDate = latestRow[0].shipment_date
      const endDate = new Date(latestDate)
      const months = period === '3m' ? 3 : period === '6m' ? 6 : 12
      const startDate = new Date(endDate)
      startDate.setMonth(startDate.getMonth() - months)
      const startStr = startDate.toISOString().split('T')[0]

      const { data: shipments } = await supabase
        .from('fact_shipment')
        .select('shipment_date, product_name, shipped_qty, customer_name, order_number')
        .eq('factory', factory)
        .gte('shipment_date', startStr)
        .lte('shipment_date', latestDate)
        .range(0, 9999)

      const { data: erpItems } = await supabase
        .from('dim_erp_item')
        .select('item_name, sales_price')

      const priceMap = new Map<string, number>()
      erpItems?.forEach(item => {
        if (item.sales_price) priceMap.set(item.item_name, item.sales_price)
      })

      if (!shipments?.length) {
        setChannelDetails([])
        setTypeSummaries([])
        setLoading(false)
        return
      }

      // Aggregate by individual channel
      const channelMap = new Map<string, {
        type: ChannelType
        revenue: number
        quantity: number
        orders: Set<string>
        products: Map<string, { qty: number; revenue: number }>
      }>()

      // Aggregate by type + month
      const typeMonthMap = new Map<string, Map<string, number>>()  // type -> month -> revenue
      let totRev = 0

      shipments.forEach(s => {
        const channel = s.customer_name || '기타'
        const type = getChannelType(channel)
        const price = priceMap.get(s.product_name) || 0
        const rev = (s.shipped_qty || 0) * price
        const qty = s.shipped_qty || 0
        totRev += rev

        // Channel detail
        if (!channelMap.has(channel)) {
          channelMap.set(channel, { type, revenue: 0, quantity: 0, orders: new Set(), products: new Map() })
        }
        const ch = channelMap.get(channel)!
        ch.revenue += rev
        ch.quantity += qty
        if (s.order_number) ch.orders.add(s.order_number)

        const prodKey = s.product_name || '-'
        if (!ch.products.has(prodKey)) ch.products.set(prodKey, { qty: 0, revenue: 0 })
        const p = ch.products.get(prodKey)!
        p.qty += qty
        p.revenue += rev

        // Type + month
        const month = s.shipment_date?.substring(0, 7) || ''
        if (month) {
          if (!typeMonthMap.has(type)) typeMonthMap.set(type, new Map())
          const mm = typeMonthMap.get(type)!
          mm.set(month, (mm.get(month) || 0) + rev)
        }
      })

      // Build channel details
      const details: ChannelDetail[] = []
      channelMap.forEach((val, name) => {
        const topProds = Array.from(val.products.entries())
          .sort((a, b) => b[1].revenue - a[1].revenue)
          .slice(0, 5)
          .map(([pName, pData]) => ({ name: pName, qty: pData.qty, revenue: pData.revenue }))
        details.push({
          name,
          type: val.type,
          revenue: val.revenue,
          quantity: val.quantity,
          orderCount: val.orders.size,
          productCount: val.products.size,
          topProducts: topProds,
        })
      })
      details.sort((a, b) => b.revenue - a.revenue)

      // Build type summaries
      const typeMap = new Map<ChannelType, TypeSummary>()
      details.forEach(d => {
        if (!typeMap.has(d.type)) {
          typeMap.set(d.type, {
            type: d.type,
            revenue: 0,
            quantity: 0,
            channelCount: 0,
            channels: [],
            monthlyRevenue: typeMonthMap.get(d.type) || new Map(),
          })
        }
        const ts = typeMap.get(d.type)!
        ts.revenue += d.revenue
        ts.quantity += d.quantity
        ts.channelCount += 1
        ts.channels.push(d.name)
      })

      const typeOrder: ChannelType[] = ['해외', '온라인 마켓플레이스', 'B2B 식품사', '기타']
      const summaries = typeOrder
        .filter(t => typeMap.has(t))
        .map(t => typeMap.get(t)!)

      // Build monthly type trend
      const allMonths = new Set<string>()
      typeMonthMap.forEach(mm => mm.forEach((_, m) => allMonths.add(m)))
      const sortedMonths = Array.from(allMonths).sort()

      const monthlyType: MonthlyTypeData[] = sortedMonths.map(month => ({
        month,
        '해외': Math.round((typeMonthMap.get('해외')?.get(month) || 0) / 10000),
        '온라인 마켓플레이스': Math.round((typeMonthMap.get('온라인 마켓플레이스')?.get(month) || 0) / 10000),
        'B2B 식품사': Math.round((typeMonthMap.get('B2B 식품사')?.get(month) || 0) / 10000),
        '기타': Math.round((typeMonthMap.get('기타')?.get(month) || 0) / 10000),
      }))

      setChannelDetails(details)
      setTypeSummaries(summaries)
      setMonthlyTypeData(monthlyType)
      setTotalRevenue(totRev)
    } catch (err) {
      console.error('Channel strategy error:', err)
    } finally {
      setLoading(false)
    }
  }, [factory, period])

  useEffect(() => { fetchData() }, [fetchData])

  const formatWon = (n: number) => {
    if (n >= 100000000) return (n / 100000000).toFixed(1) + '억'
    if (n >= 10000) return Math.round(n / 10000).toLocaleString() + '만'
    return n.toLocaleString()
  }
  const formatNum = (n: number) => n.toLocaleString('ko-KR')

  const pieData = useMemo(() =>
    typeSummaries.map(ts => ({
      name: ts.type,
      value: ts.revenue,
      color: TYPE_COLORS[ts.type],
    })),
    [typeSummaries]
  )

  // Export (해외) channel growth rate
  const exportGrowth = useMemo(() => {
    if (monthlyTypeData.length < 3) return null
    const recent = monthlyTypeData.slice(-3)
    const older = monthlyTypeData.slice(0, 3)
    const recentAvg = recent.reduce((s, d) => s + d['해외'], 0) / recent.length
    const olderAvg = older.reduce((s, d) => s + d['해외'], 0) / older.length
    if (olderAvg === 0) return recentAvg > 0 ? 100 : 0
    return ((recentAvg - olderAvg) / olderAvg) * 100
  }, [monthlyTypeData])

  const filteredChannels = useMemo(() => {
    if (!selectedType) return channelDetails
    return channelDetails.filter(c => c.type === selectedType)
  }, [channelDetails, selectedType])

  // HHI per channel type (within that type)
  const typeHHI = useMemo(() => {
    const result: Record<string, number> = {}
    typeSummaries.forEach(ts => {
      const channels = channelDetails.filter(c => c.type === ts.type)
      if (ts.revenue === 0) { result[ts.type] = 0; return }
      result[ts.type] = channels.reduce((sum, c) => {
        const share = (c.revenue / ts.revenue) * 100
        return sum + share * share
      }, 0)
    })
    return result
  }, [typeSummaries, channelDetails])

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">판매 채널 전략</h1>
          <p className="text-gray-500 text-sm mt-1">B2B · 온라인 마켓 · 해외 채널 포트폴리오 분석</p>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {[
            { label: '3개월', value: '3m' },
            { label: '6개월', value: '6m' },
            { label: '12개월', value: '12m' },
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setPeriod(opt.value)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                period === opt.value ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Strategic Context Card */}
      <Card className="bg-gradient-to-r from-slate-900 to-slate-800 text-white border-0">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-lg">🌏</span>
            </div>
            <div>
              <h3 className="font-bold text-sm mb-1">멀티 채널 전략 분석</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                SEIL의 판매 채널을 <strong className="text-blue-300">온라인 마켓플레이스</strong>,{' '}
                <strong className="text-emerald-300">B2B 식품사 납품</strong>,{' '}
                <strong className="text-red-300">해외(아마존)</strong>로 분류하여 채널 포트폴리오를 진단합니다.
                해외 진출 확대와 멀티채널 다각화 전략 수립에 활용하세요.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : channelDetails.length === 0 ? (
        <div className="text-center py-20 text-gray-400">출하 데이터가 없습니다</div>
      ) : (
        <>
          {/* Channel Type Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {typeSummaries.map(ts => {
              const share = totalRevenue > 0 ? (ts.revenue / totalRevenue) * 100 : 0
              const isSelected = selectedType === ts.type
              const hhi = typeHHI[ts.type] || 0
              return (
                <Card
                  key={ts.type}
                  className={cn(
                    'cursor-pointer transition-all border-2',
                    TYPE_BG[ts.type],
                    isSelected ? 'ring-2 ring-offset-1 ring-blue-400 scale-[1.02]' : 'hover:shadow-md'
                  )}
                  onClick={() => setSelectedType(isSelected ? null : ts.type)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className={cn('text-xs font-bold uppercase tracking-wider', TYPE_TEXT[ts.type])}>
                        {ts.type}
                      </span>
                      <span className="text-lg font-black text-gray-900">{share.toFixed(1)}%</span>
                    </div>
                    <div className="text-xl font-bold text-gray-900 mb-1">{formatWon(ts.revenue)}원</div>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>{ts.channelCount}개 채널</span>
                      <span>·</span>
                      <span>{formatNum(ts.quantity)}개 출하</span>
                    </div>
                    {ts.type === '해외' && exportGrowth !== null && (
                      <div className={cn(
                        'mt-2 text-xs font-bold px-2 py-0.5 rounded-full inline-block',
                        exportGrowth > 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                      )}>
                        {exportGrowth > 0 ? '↑' : exportGrowth < 0 ? '↓' : '→'} 최근 3개월 {Math.abs(Math.round(exportGrowth))}% {exportGrowth >= 0 ? '성장' : '감소'}
                      </div>
                    )}
                    {ts.channelCount > 1 && (
                      <div className="mt-2 text-[10px] text-gray-400">
                        내부 집중도: HHI {Math.round(hhi)} ({hhi > 2500 ? '높음' : hhi > 1500 ? '보통' : '분산'})
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}

            {/* Total card */}
            <Card className="bg-white border-2 border-gray-200">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-500">전체</span>
                  <span className="text-lg font-black text-gray-900">100%</span>
                </div>
                <div className="text-xl font-bold text-gray-900 mb-1">{formatWon(totalRevenue)}원</div>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span>{channelDetails.length}개 채널</span>
                  <span>·</span>
                  <span>{typeSummaries.length}개 유형</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pie Chart: Revenue by Type */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">채널 유형별 매출 비중</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={95}
                        paddingAngle={3}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
                      >
                        {pieData.map((entry, idx) => (
                          <Cell key={idx} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(val: number) => formatWon(val) + '원'} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Line Chart: Monthly Type Trend */}
            {monthlyTypeData.length > 1 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">채널 유형별 월별 매출 추이 (만원)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={monthlyTypeData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                        <YAxis tickFormatter={(v) => v.toLocaleString()} />
                        <Tooltip formatter={(val: number) => formatNum(val) + '만원'} />
                        <Legend />
                        {typeSummaries.map(ts => (
                          <Line
                            key={ts.type}
                            type="monotone"
                            dataKey={ts.type}
                            stroke={TYPE_COLORS[ts.type]}
                            strokeWidth={ts.type === '해외' ? 3 : 2}
                            dot={{ r: ts.type === '해외' ? 4 : 3 }}
                            strokeDasharray={ts.type === '해외' ? undefined : undefined}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Channel Detail by Type */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold">
                {selectedType ? `${selectedType} 채널 상세` : '전체 채널 상세'}
              </h2>
              {selectedType && (
                <button
                  onClick={() => setSelectedType(null)}
                  className="text-xs text-blue-600 hover:underline"
                >
                  전체 보기
                </button>
              )}
            </div>

            {/* Horizontal bar chart for filtered channels */}
            <Card className="mb-4">
              <CardContent className="pt-4">
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={filteredChannels.slice(0, 10)}
                      layout="vertical"
                      margin={{ left: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tickFormatter={(v) => formatWon(v)} />
                      <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(val: number) => formatWon(val) + '원'} />
                      <Bar dataKey="revenue" name="매출" radius={[0, 4, 4, 0]}>
                        {filteredChannels.slice(0, 10).map((c, idx) => (
                          <Cell key={idx} fill={TYPE_COLORS[c.type] || INDIVIDUAL_COLORS[idx % INDIVIDUAL_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Individual channel cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredChannels.map((ch, idx) => {
                const share = totalRevenue > 0 ? (ch.revenue / totalRevenue) * 100 : 0
                return (
                  <Card key={ch.name} className={cn('border-l-4', `border-l-[${TYPE_COLORS[ch.type]}]`)}>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: TYPE_COLORS[ch.type] }}
                        />
                        <h3 className="font-bold text-sm">{ch.name}</h3>
                        <span className={cn('ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded', TYPE_BG[ch.type], TYPE_TEXT[ch.type])}>
                          {ch.type}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 mb-3 text-center">
                        <div className="bg-blue-50 rounded p-2">
                          <div className="text-[10px] text-blue-500">매출</div>
                          <div className="text-sm font-bold text-blue-700">{formatWon(ch.revenue)}원</div>
                        </div>
                        <div className="bg-gray-50 rounded p-2">
                          <div className="text-[10px] text-gray-500">점유율</div>
                          <div className="text-sm font-bold text-gray-700">{share.toFixed(1)}%</div>
                        </div>
                        <div className="bg-gray-50 rounded p-2">
                          <div className="text-[10px] text-gray-500">출하량</div>
                          <div className="text-sm font-bold text-gray-700">{formatNum(ch.quantity)}</div>
                        </div>
                        <div className="bg-gray-50 rounded p-2">
                          <div className="text-[10px] text-gray-500">취급 제품</div>
                          <div className="text-sm font-bold text-gray-700">{ch.productCount}종</div>
                        </div>
                      </div>

                      {ch.topProducts.length > 0 && (
                        <>
                          <div className="text-xs text-gray-500 mb-1.5">매출 상위 제품</div>
                          <div className="space-y-1">
                            {ch.topProducts.slice(0, 3).map((p, i) => (
                              <div key={i} className="flex items-center gap-2 text-xs">
                                <span className="text-gray-400 w-3">{i + 1}</span>
                                <span className="truncate flex-1" title={p.name}>{p.name}</span>
                                <span className="text-gray-500 flex-shrink-0">{formatWon(p.revenue)}원</span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>

          {/* Export Opportunity Section */}
          {typeSummaries.find(ts => ts.type === '해외') && (
            <Card className="border-red-200 bg-gradient-to-r from-red-50 to-orange-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-red-800 flex items-center gap-2">
                  <span>🚀</span> 해외 진출 현황 & 기회
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <div className="text-xs text-gray-600 mb-1">현재 해외 채널</div>
                    <div className="text-lg font-bold text-red-700">
                      {typeSummaries.find(ts => ts.type === '해외')?.channels.join(', ')}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 mb-1">해외 매출 비중</div>
                    <div className="text-lg font-bold text-red-700">
                      {totalRevenue > 0 ? ((typeSummaries.find(ts => ts.type === '해외')?.revenue || 0) / totalRevenue * 100).toFixed(1) : 0}%
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-600 mb-1">해외향 출하 제품 수</div>
                    <div className="text-lg font-bold text-red-700">
                      {channelDetails.filter(c => c.type === '해외').reduce((s, c) => s + c.productCount, 0)}종
                    </div>
                  </div>
                </div>

                {/* Export products */}
                {(() => {
                  const exportChannels = channelDetails.filter(c => c.type === '해외')
                  const exportProducts = exportChannels.flatMap(c => c.topProducts)
                  if (exportProducts.length === 0) return null
                  return (
                    <div className="mt-4 pt-4 border-t border-red-200">
                      <div className="text-xs text-gray-600 mb-2">해외 채널 인기 제품</div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {exportProducts.slice(0, 6).map((p, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm bg-white rounded-lg px-3 py-2">
                            <span className="text-red-400 font-bold">{i + 1}</span>
                            <span className="truncate flex-1">{p.name}</span>
                            <span className="text-xs text-gray-500 flex-shrink-0">{formatNum(p.qty)}개</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })()}

                <div className="mt-4 p-3 bg-white/60 rounded-lg">
                  <p className="text-xs text-gray-600 leading-relaxed">
                    <strong>전략 포인트:</strong> 현재 해외 채널은 아마존에 집중되어 있습니다.
                    해외 매출 비중을 높이려면 아마존 내 제품 라인업 확대,
                    일본·동남아 마켓플레이스(라쿠텐, 쇼피, 라자다) 진출,
                    OEM/ODM 수출 채널 개척을 검토할 수 있습니다.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
