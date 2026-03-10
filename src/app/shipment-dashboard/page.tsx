'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useFactory } from '@/contexts/factory-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatNumber } from '@/lib/utils'
import { cn } from '@/lib/utils'
import {
  Truck,
  TrendingUp,
  BarChart3,
  Users,
  Package,
  Calendar,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  ComposedChart,
  Line,
  Area,
} from 'recharts'

interface ShipmentRaw {
  shipment_date: string
  product_code: string
  product_name: string
  shipped_qty: number
  customer_name: string
}

type PeriodKey = '7d' | '30d' | '90d'

const PERIOD_OPTIONS: { key: PeriodKey; label: string; days: number }[] = [
  { key: '7d', label: '7일', days: 7 },
  { key: '30d', label: '30일', days: 30 },
  { key: '90d', label: '90일', days: 90 },
]

const CUSTOMER_COLORS = [
  '#3b82f6', '#f97316', '#10b981', '#8b5cf6', '#ef4444',
  '#06b6d4', '#f59e0b', '#ec4899', '#6366f1', '#14b8a6',
]

export default function ShipmentDashboardPage() {
  const { factory } = useFactory()
  const [shipments, setShipments] = useState<ShipmentRaw[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<PeriodKey>('30d')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const today = new Date()
      const dAgo = new Date(today)
      dAgo.setDate(dAgo.getDate() - 90) // Always fetch 90 days, filter client-side
      const dStr = `${dAgo.getFullYear()}-${String(dAgo.getMonth() + 1).padStart(2, '0')}-${String(dAgo.getDate()).padStart(2, '0')}`

      const { data, error } = await supabase
        .from('fact_shipment')
        .select('shipment_date, product_code, product_name, shipped_qty, customer_name')
        .eq('factory', factory)
        .gte('shipment_date', dStr)
        .order('shipment_date')

      if (error) throw error
      setShipments(data || [])
    } catch (err) {
      console.error('Failed to fetch shipment data:', err)
    } finally {
      setLoading(false)
    }
  }, [factory])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Filter by period
  const filteredShipments = useMemo(() => {
    const days = PERIOD_OPTIONS.find(p => p.key === period)?.days || 30
    const today = new Date()
    const dAgo = new Date(today)
    dAgo.setDate(dAgo.getDate() - days)
    const dStr = `${dAgo.getFullYear()}-${String(dAgo.getMonth() + 1).padStart(2, '0')}-${String(dAgo.getDate()).padStart(2, '0')}`
    return shipments.filter(s => s.shipment_date >= dStr)
  }, [shipments, period])

  // KPI stats
  const stats = useMemo(() => {
    const totalQty = filteredShipments.reduce((s, r) => s + (r.shipped_qty || 0), 0)
    const totalOrders = filteredShipments.length
    const customers = new Set(filteredShipments.map(r => r.customer_name))
    const products = new Set(filteredShipments.map(r => r.product_code))
    const days = PERIOD_OPTIONS.find(p => p.key === period)?.days || 30
    const avgDaily = totalQty / days

    return {
      totalQty,
      totalOrders,
      customerCount: customers.size,
      productCount: products.size,
      avgDaily: Math.round(avgDaily),
    }
  }, [filteredShipments, period])

  // Customer breakdown
  const customerData = useMemo(() => {
    const map: Record<string, number> = {}
    for (const s of filteredShipments) {
      map[s.customer_name] = (map[s.customer_name] || 0) + (s.shipped_qty || 0)
    }
    return Object.entries(map)
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
  }, [filteredShipments])

  // Customer order count breakdown
  const customerOrderData = useMemo(() => {
    const map: Record<string, number> = {}
    for (const s of filteredShipments) {
      map[s.customer_name] = (map[s.customer_name] || 0) + 1
    }
    return Object.entries(map)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
  }, [filteredShipments])

  // Daily trend (by customer stacked)
  const dailyTrendData = useMemo(() => {
    const dateMap: Record<string, Record<string, number>> = {}
    const customers = new Set<string>()

    for (const s of filteredShipments) {
      if (!dateMap[s.shipment_date]) dateMap[s.shipment_date] = {}
      dateMap[s.shipment_date][s.customer_name] =
        (dateMap[s.shipment_date][s.customer_name] || 0) + (s.shipped_qty || 0)
      customers.add(s.customer_name)
    }

    // Fill all dates in range
    const days = PERIOD_OPTIONS.find(p => p.key === period)?.days || 30
    const today = new Date()
    const allDates: any[] = []

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const entry: any = {
        date: ds.slice(5), // MM-DD
        fullDate: ds,
        total: 0,
      }
      for (const c of customers) {
        entry[c] = dateMap[ds]?.[c] || 0
        entry.total += entry[c]
      }
      allDates.push(entry)
    }

    return { data: allDates, customers: Array.from(customers) }
  }, [filteredShipments, period])

  // Top products by shipment qty
  const topProducts = useMemo(() => {
    const map: Record<string, { name: string; qty: number }> = {}
    for (const s of filteredShipments) {
      if (!map[s.product_code]) map[s.product_code] = { name: s.product_name, qty: 0 }
      map[s.product_code].qty += (s.shipped_qty || 0)
    }
    return Object.values(map)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10)
  }, [filteredShipments])

  // Customer-product heatmap data
  const customerProductData = useMemo(() => {
    const map: Record<string, Record<string, number>> = {}
    for (const s of filteredShipments) {
      if (!map[s.customer_name]) map[s.customer_name] = {}
      map[s.customer_name][s.product_name] =
        (map[s.customer_name][s.product_name] || 0) + (s.shipped_qty || 0)
    }

    // Get top 5 customers and top 8 products
    const topCusts = customerData.slice(0, 5).map(c => c.name)
    const topProds = topProducts.slice(0, 8).map(p => p.name)

    return topProds.map(prod => {
      const row: any = { product: prod.length > 15 ? prod.slice(0, 15) + '...' : prod }
      for (const cust of topCusts) {
        row[cust] = map[cust]?.[prod] || 0
      }
      return row
    })
  }, [filteredShipments, customerData, topProducts])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">출하량 대시보드</h1>
          <p className="text-gray-600 mt-2">고객사별 출하 현황 및 추세를 분석합니다.</p>
        </div>
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {PERIOD_OPTIONS.map(opt => (
            <button
              key={opt.key}
              onClick={() => setPeriod(opt.key)}
              className={cn(
                'px-3 py-1.5 rounded-md text-sm font-medium transition-all',
                period === opt.key
                  ? 'bg-white shadow-sm text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Truck className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">총 출하량</p>
                <p className="text-2xl font-bold">{formatNumber(stats.totalQty)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <BarChart3 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">출하 건수</p>
                <p className="text-2xl font-bold">{formatNumber(stats.totalOrders)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <TrendingUp className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">일평균 출하</p>
                <p className="text-2xl font-bold">{formatNumber(stats.avgDaily)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Users className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">고객사</p>
                <p className="text-2xl font-bold">{stats.customerCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-100 rounded-lg">
                <Package className="h-5 w-5 text-cyan-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">출하 제품</p>
                <p className="text-2xl font-bold">{stats.productCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Daily Trend Chart (stacked by customer) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            일별 출하 추세 (고객사별)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={dailyTrendData.data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10 }}
                  interval={period === '7d' ? 0 : period === '30d' ? 2 : 6}
                />
                <YAxis tick={{ fontSize: 11 }} width={60} tickFormatter={(v) => formatNumber(v)} />
                <Tooltip
                  formatter={(value: number, name: string) => [formatNumber(value), name]}
                  labelFormatter={(label) => `날짜: ${label}`}
                />
                {dailyTrendData.customers.map((cust, i) => (
                  <Bar
                    key={cust}
                    dataKey={cust}
                    stackId="a"
                    fill={CUSTOMER_COLORS[i % CUSTOMER_COLORS.length]}
                    name={cust}
                  />
                ))}
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke="#1e293b"
                  strokeWidth={1.5}
                  dot={false}
                  name="합계"
                  strokeDasharray="3 3"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Two-column: Customer Qty + Customer Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Customer by Qty */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              고객사별 출하량
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={customerData} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => formatNumber(v)} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                  <Tooltip formatter={(value: number) => [formatNumber(value), '출하량']} />
                  <Bar dataKey="qty" fill="#3b82f6" radius={[0, 4, 4, 0]} name="출하량" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Customer Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              고객사별 출하 비중
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={customerData}
                    dataKey="qty"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={true}
                  >
                    {customerData.map((_, i) => (
                      <Cell key={i} fill={CUSTOMER_COLORS[i % CUSTOMER_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [formatNumber(value), '출하량']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Two-column: Top Products + Customer-Product matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4" />
              출하량 상위 제품 (Top 10)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topProducts.map((p, i) => {
                const maxQty = topProducts[0]?.qty || 1
                const pct = (p.qty / maxQty) * 100
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-gray-400 w-5">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{p.name}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs tabular-nums font-medium text-gray-600 w-16 text-right">
                          {formatNumber(p.qty)}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Customer-Product Grid */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              고객사 × 제품 출하 현황
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left p-2 font-medium sticky left-0 bg-gray-50">제품</th>
                    {customerData.slice(0, 5).map(c => (
                      <th key={c.name} className="text-right p-2 font-medium">{c.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {customerProductData.map((row, i) => (
                    <tr key={i} className="border-b last:border-b-0">
                      <td className="p-2 font-medium text-gray-700 sticky left-0 bg-white">{row.product}</td>
                      {customerData.slice(0, 5).map(c => {
                        const val = row[c.name] || 0
                        return (
                          <td key={c.name} className="p-2 text-right tabular-nums">
                            <span className={cn(
                              val > 0 ? 'font-medium' : 'text-gray-300'
                            )}>
                              {val > 0 ? formatNumber(val) : '-'}
                            </span>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
