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

interface ChannelData {
  name: string
  revenue: number
  quantity: number
  orderCount: number
  avgOrderValue: number
  productCount: number
  topProducts: { name: string; qty: number; revenue: number }[]
}

interface MonthlyChannelData {
  month: string
  [channel: string]: string | number
}

interface ProductProfit {
  name: string
  code: string
  revenue: number
  quantity: number
  avgPrice: number
  channel: string
}

const CHANNEL_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#06B6D4', '#F97316', '#6366F1', '#14B8A6',
]

export default function ChannelAnalysisPage() {
  const { factory } = useFactory()
  const [channelData, setChannelData] = useState<ChannelData[]>([])
  const [monthlyData, setMonthlyData] = useState<MonthlyChannelData[]>([])
  const [productData, setProductData] = useState<ProductProfit[]>([])
  const [totalRevenue, setTotalRevenue] = useState(0)
  const [totalQty, setTotalQty] = useState(0)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('6m')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      // 1. Get date range
      const { data: latestRow } = await supabase
        .from('fact_shipment')
        .select('shipment_date')
        .eq('factory', factory)
        .order('shipment_date', { ascending: false })
        .limit(1)

      if (!latestRow || latestRow.length === 0) {
        setChannelData([])
        setLoading(false)
        return
      }

      const latestDate = latestRow[0].shipment_date
      const endDate = new Date(latestDate)
      const months = period === '3m' ? 3 : period === '6m' ? 6 : 12
      const startDate = new Date(endDate)
      startDate.setMonth(startDate.getMonth() - months)
      const startStr = startDate.toISOString().split('T')[0]

      // 2. Fetch shipment data
      const { data: shipments } = await supabase
        .from('fact_shipment')
        .select('shipment_date, product_name, product_code, shipped_qty, customer_name, order_number')
        .eq('factory', factory)
        .gte('shipment_date', startStr)
        .lte('shipment_date', latestDate)
        .range(0, 9999)

      // 3. Fetch ERP prices
      const { data: erpItems } = await supabase
        .from('dim_erp_item')
        .select('item_name, sales_price')

      const priceMap = new Map<string, number>()
      erpItems?.forEach(item => {
        if (item.sales_price) priceMap.set(item.item_name, item.sales_price)
      })

      if (!shipments || shipments.length === 0) {
        setChannelData([])
        setLoading(false)
        return
      }

      // 4. Aggregate by channel
      const channelMap = new Map<string, {
        revenue: number
        quantity: number
        orders: Set<string>
        products: Map<string, { qty: number; revenue: number }>
      }>()

      const monthlyMap = new Map<string, Map<string, number>>()
      const productMap: ProductProfit[] = []
      let totRev = 0
      let totQty = 0

      shipments.forEach(s => {
        const channel = s.customer_name || '기타'
        const price = priceMap.get(s.product_name) || 0
        const rev = (s.shipped_qty || 0) * price
        const qty = s.shipped_qty || 0
        totRev += rev
        totQty += qty

        // Channel aggregation
        if (!channelMap.has(channel)) {
          channelMap.set(channel, { revenue: 0, quantity: 0, orders: new Set(), products: new Map() })
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

        // Monthly aggregation
        const month = s.shipment_date?.substring(0, 7) || ''
        if (month) {
          if (!monthlyMap.has(month)) monthlyMap.set(month, new Map())
          const mm = monthlyMap.get(month)!
          mm.set(channel, (mm.get(channel) || 0) + rev)
        }
      })

      // Build channel data
      const channels: ChannelData[] = []
      channelMap.forEach((val, name) => {
        const topProds = Array.from(val.products.entries())
          .sort((a, b) => b[1].revenue - a[1].revenue)
          .slice(0, 5)
          .map(([pName, pData]) => ({ name: pName, qty: pData.qty, revenue: pData.revenue }))

        channels.push({
          name,
          revenue: val.revenue,
          quantity: val.quantity,
          orderCount: val.orders.size,
          avgOrderValue: val.orders.size > 0 ? val.revenue / val.orders.size : 0,
          productCount: val.products.size,
          topProducts: topProds,
        })
      })
      channels.sort((a, b) => b.revenue - a.revenue)

      // Build monthly trend
      const allChannelNames = channels.slice(0, 6).map(c => c.name)
      const monthly: MonthlyChannelData[] = []
      const sortedMonths = Array.from(monthlyMap.keys()).sort()
      sortedMonths.forEach(month => {
        const mm = monthlyMap.get(month)!
        const row: MonthlyChannelData = { month }
        allChannelNames.forEach(ch => {
          row[ch] = Math.round((mm.get(ch) || 0) / 10000) // 만원 단위
        })
        monthly.push(row)
      })

      // Build product profitability
      const allProducts = new Map<string, ProductProfit>()
      channelMap.forEach((val, channel) => {
        val.products.forEach((pData, pName) => {
          const price = priceMap.get(pName) || 0
          if (!allProducts.has(pName)) {
            allProducts.set(pName, {
              name: pName, code: '', revenue: 0, quantity: 0, avgPrice: price, channel,
            })
          }
          const prod = allProducts.get(pName)!
          prod.revenue += pData.revenue
          prod.quantity += pData.qty
          if (pData.revenue > allProducts.get(pName)!.revenue * 0.5) {
            prod.channel = channel // primary channel
          }
        })
      })

      setChannelData(channels)
      setMonthlyData(monthly)
      setProductData(Array.from(allProducts.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 20))
      setTotalRevenue(totRev)
      setTotalQty(totQty)
    } catch (err) {
      console.error('Channel analysis error:', err)
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

  const pieData = useMemo(() => {
    return channelData.map((c, i) => ({
      name: c.name,
      value: c.revenue,
      color: CHANNEL_COLORS[i % CHANNEL_COLORS.length],
    }))
  }, [channelData])

  const topChannels = useMemo(() => channelData.slice(0, 6), [channelData])

  // Channel concentration: HHI (Herfindahl-Hirschman Index)
  const hhi = useMemo(() => {
    if (totalRevenue === 0) return 0
    return channelData.reduce((sum, c) => {
      const share = (c.revenue / totalRevenue) * 100
      return sum + share * share
    }, 0)
  }, [channelData, totalRevenue])

  const concentrationLevel = hhi > 2500 ? '높음' : hhi > 1500 ? '보통' : '분산'
  const concentrationColor = hhi > 2500 ? 'text-red-600' : hhi > 1500 ? 'text-amber-600' : 'text-emerald-600'

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">채널 분석</h1>
          <p className="text-gray-500 text-sm mt-1">마켓플레이스별 매출 · 수익성 · 제품 포트폴리오 분석</p>
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

      {/* 가치 설명 */}
      <Card className="bg-gradient-to-r from-indigo-50 to-white border-indigo-100">
        <CardContent className="p-4">
          <p className="text-sm text-gray-700 leading-relaxed">
            <strong className="text-indigo-700">어디서 얼마나 팔리는지, 한눈에.</strong>{' '}
            쿠팡·네이버·11번가 등 마켓플레이스별 매출 비중과 추이를 분석하여
            채널 집중도 리스크(HHI)를 진단합니다. 특정 채널 의존도가 높으면 정책 변경 시 매출 급감 위험이 있으므로,
            채널 다각화 전략 수립에 활용할 수 있습니다.
          </p>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : channelData.length === 0 ? (
        <div className="text-center py-20 text-gray-400">출하 데이터가 없습니다</div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 stagger-children">
            <Card className="kpi-card">
              <CardContent className="p-4 text-center">
                <div className="text-xs text-gray-500 mb-1">총 매출</div>
                <div className="text-xl font-bold text-blue-600">{formatWon(totalRevenue)}원</div>
              </CardContent>
            </Card>
            <Card className="kpi-card">
              <CardContent className="p-4 text-center">
                <div className="text-xs text-gray-500 mb-1">총 출하량</div>
                <div className="text-xl font-bold text-gray-900">{formatNum(totalQty)}</div>
              </CardContent>
            </Card>
            <Card className="kpi-card">
              <CardContent className="p-4 text-center">
                <div className="text-xs text-gray-500 mb-1">활성 채널</div>
                <div className="text-xl font-bold text-emerald-600">{channelData.length}개</div>
              </CardContent>
            </Card>
            <Card className="kpi-card">
              <CardContent className="p-4 text-center">
                <div className="text-xs text-gray-500 mb-1">채널 집중도</div>
                <div className={cn('text-xl font-bold', concentrationColor)}>
                  {concentrationLevel}
                </div>
                <div className="text-[10px] text-gray-400">HHI: {Math.round(hhi)}</div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pie Chart: Channel Revenue Share */}
            <Card className="card-hover">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">채널별 매출 비중</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
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

            {/* Bar Chart: Channel Revenue */}
            <Card className="card-hover">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">채널별 매출 비교</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topChannels} layout="vertical" margin={{ left: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" tickFormatter={(v) => formatWon(v)} />
                      <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(val: number) => formatWon(val) + '원'} />
                      <Bar dataKey="revenue" name="매출" radius={[0, 4, 4, 0]}>
                        {topChannels.map((_, idx) => (
                          <Cell key={idx} fill={CHANNEL_COLORS[idx % CHANNEL_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Monthly Trend */}
          {monthlyData.length > 1 && (
            <Card className="card-hover animate-fade-in-up">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">월별 채널 매출 추이 (만원)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72 md:h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={(v) => v.toLocaleString()} />
                      <Tooltip formatter={(val: number) => formatNum(val) + '만원'} />
                      <Legend />
                      {topChannels.map((ch, idx) => (
                        <Line
                          key={ch.name}
                          type="monotone"
                          dataKey={ch.name}
                          stroke={CHANNEL_COLORS[idx % CHANNEL_COLORS.length]}
                          strokeWidth={2}
                          dot={{ r: 3 }}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Channel Detail Cards */}
          <div>
            <h2 className="text-lg font-bold mb-3">채널별 상세 분석</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 stagger-children">
              {channelData.map((ch, idx) => {
                const share = totalRevenue > 0 ? (ch.revenue / totalRevenue) * 100 : 0
                return (
                  <Card key={ch.name} className="card-hover">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: CHANNEL_COLORS[idx % CHANNEL_COLORS.length] }}
                        />
                        <h3 className="font-bold text-sm">{ch.name}</h3>
                        <span className="ml-auto text-xs text-gray-400">{share.toFixed(1)}%</span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 mb-3 text-center">
                        <div className="bg-blue-50 rounded p-2">
                          <div className="text-[10px] text-blue-500">매출</div>
                          <div className="text-sm font-bold text-blue-700">{formatWon(ch.revenue)}원</div>
                        </div>
                        <div className="bg-gray-50 rounded p-2">
                          <div className="text-[10px] text-gray-500">출하량</div>
                          <div className="text-sm font-bold text-gray-700">{formatNum(ch.quantity)}</div>
                        </div>
                        <div className="bg-gray-50 rounded p-2">
                          <div className="text-[10px] text-gray-500">주문건수</div>
                          <div className="text-sm font-bold text-gray-700">{formatNum(ch.orderCount)}</div>
                        </div>
                        <div className="bg-gray-50 rounded p-2">
                          <div className="text-[10px] text-gray-500">취급 제품</div>
                          <div className="text-sm font-bold text-gray-700">{ch.productCount}종</div>
                        </div>
                      </div>

                      {/* Top products */}
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
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>

          {/* Product Revenue Ranking */}
          {productData.length > 0 && (
            <Card className="animate-fade-in-up">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">제품별 매출 랭킹 (상위 20)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-gray-500">
                        <th className="pb-2 pr-2 w-8">#</th>
                        <th className="pb-2 pr-4">제품명</th>
                        <th className="pb-2 pr-4 text-right">매출</th>
                        <th className="pb-2 pr-4 text-right">수량</th>
                        <th className="pb-2 pr-4 text-right">단가</th>
                        <th className="pb-2">주요 채널</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productData.map((p, i) => (
                        <tr key={p.name} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-2 pr-2 text-gray-400 text-xs">{i + 1}</td>
                          <td className="py-2 pr-4 font-medium truncate max-w-[200px]" title={p.name}>{p.name}</td>
                          <td className="py-2 pr-4 text-right font-bold text-blue-600">{formatWon(p.revenue)}원</td>
                          <td className="py-2 pr-4 text-right">{formatNum(p.quantity)}</td>
                          <td className="py-2 pr-4 text-right text-gray-500">{formatNum(p.avgPrice)}원</td>
                          <td className="py-2 text-xs text-gray-500">{p.channel}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
