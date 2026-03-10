'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useFactory } from '@/contexts/factory-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DetailPopup } from '@/components/common/detail-popup'
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

interface DetailPopupState {
  open: boolean
  type?: 'totalQty' | 'totalOrders' | 'avgDaily' | 'customers' | 'products'
}

const CUSTOMER_COLORS = [
  '#3b82f6', '#f97316', '#10b981', '#8b5cf6', '#ef4444',
  '#06b6d4', '#f59e0b', '#ec4899', '#6366f1', '#14b8a6',
]

export default function ShipmentDashboardPage() {
  const { factory } = useFactory()
  const [shipments, setShipments] = useState<ShipmentRaw[]>([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [selectedCustomer, setSelectedCustomer] = useState<string>('')
  const [selectedProduct, setSelectedProduct] = useState<string>('')
  const [detailPopup, setDetailPopup] = useState<DetailPopupState>({ open: false })

  const dateFormatISO = (date: Date): string => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  }

  const dateFormatDisplay = (date: Date): string => {
    return date.toISOString().split('T')[0]
  }

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('fact_shipment')
        .select('shipment_date, product_code, product_name, shipped_qty, customer_name')
        .eq('factory', factory)
        .order('shipment_date', { ascending: false })
        .limit(1)

      if (error) throw error

      if (data && data.length > 0) {
        const latestDate = new Date(data[0].shipment_date)
        setEndDate(dateFormatDisplay(latestDate))

        const oneMonthAgo = new Date(latestDate)
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)
        setStartDate(dateFormatDisplay(oneMonthAgo))
      }

      // Fetch all data for filtering
      const { data: allData, error: fetchError } = await supabase
        .from('fact_shipment')
        .select('shipment_date, product_code, product_name, shipped_qty, customer_name')
        .eq('factory', factory)
        .order('shipment_date')

      if (fetchError) throw fetchError
      setShipments(allData || [])
    } catch (err) {
      console.error('Failed to fetch shipment data:', err)
    } finally {
      setLoading(false)
    }
  }, [factory])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Filter by date range and dropdowns
  const filteredShipments = useMemo(() => {
    return shipments.filter(s => {
      const dateOk = (!startDate || s.shipment_date >= startDate) && (!endDate || s.shipment_date <= endDate)
      const customerOk = !selectedCustomer || s.customer_name === selectedCustomer
      const productOk = !selectedProduct || s.product_code === selectedProduct
      return dateOk && customerOk && productOk
    })
  }, [shipments, startDate, endDate, selectedCustomer, selectedProduct])

  // Get unique customers and products for dropdowns
  const availableCustomers = useMemo(() => {
    const set = new Set(shipments.map(s => s.customer_name))
    return Array.from(set).sort()
  }, [shipments])

  const availableProducts = useMemo(() => {
    const set = new Set(shipments.map(s => s.product_code))
    return Array.from(set).sort()
  }, [shipments])

  // KPI stats
  const stats = useMemo(() => {
    const totalQty = filteredShipments.reduce((s, r) => s + (r.shipped_qty || 0), 0)
    const totalOrders = filteredShipments.length
    const customers = new Set(filteredShipments.map(r => r.customer_name))
    const products = new Set(filteredShipments.map(r => r.product_code))

    let avgDaily = 0
    if (startDate && endDate) {
      const start = new Date(startDate)
      const end = new Date(endDate)
      const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
      avgDaily = Math.round(totalQty / Math.max(days, 1))
    }

    return {
      totalQty,
      totalOrders,
      customerCount: customers.size,
      productCount: products.size,
      avgDaily,
    }
  }, [filteredShipments, startDate, endDate])

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
    const allDates: any[] = []

    if (startDate && endDate) {
      const start = new Date(startDate)
      const end = new Date(endDate)
      const current = new Date(start)

      while (current <= end) {
        const ds = dateFormatISO(current)
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
        current.setDate(current.getDate() + 1)
      }
    }

    return { data: allDates, customers: Array.from(customers) }
  }, [filteredShipments, startDate, endDate])

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

  // Detail popup data generators
  const getDetailData = (type: DetailPopupState['type']): Array<Record<string, string>> => {
    switch (type) {
      case 'totalQty': {
        const productQty: Record<string, number> = {}
        for (const s of filteredShipments) {
          productQty[s.product_name] = (productQty[s.product_name] || 0) + (s.shipped_qty || 0)
        }
        return Object.entries(productQty)
          .sort((a, b) => b[1] - a[1])
          .map(([name, qty]) => ({ product: name, quantity: formatNumber(qty) }))
      }
      case 'totalOrders': {
        const dailyOrders: Record<string, number> = {}
        for (const s of filteredShipments) {
          dailyOrders[s.shipment_date] = (dailyOrders[s.shipment_date] || 0) + 1
        }
        return Object.entries(dailyOrders)
          .sort((a, b) => b[1] - a[1])
          .map(([date, count]) => ({ date, orders: formatNumber(count) }))
      }
      case 'avgDaily': {
        const dailyQty: Record<string, number> = {}
        for (const s of filteredShipments) {
          dailyQty[s.shipment_date] = (dailyQty[s.shipment_date] || 0) + (s.shipped_qty || 0)
        }
        return Object.entries(dailyQty)
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([date, qty]) => ({ date, quantity: formatNumber(qty) }))
      }
      case 'customers': {
        const customerQty: Record<string, number> = {}
        for (const s of filteredShipments) {
          customerQty[s.customer_name] = (customerQty[s.customer_name] || 0) + (s.shipped_qty || 0)
        }
        return Object.entries(customerQty)
          .sort((a, b) => b[1] - a[1])
          .map(([name, qty]) => ({ customer: name, quantity: formatNumber(qty) }))
      }
      case 'products': {
        const productQty: Record<string, number> = {}
        for (const s of filteredShipments) {
          productQty[s.product_name] = (productQty[s.product_name] || 0) + (s.shipped_qty || 0)
        }
        return Object.entries(productQty)
          .sort((a, b) => b[1] - a[1])
          .map(([name, qty]) => ({ product: name, quantity: formatNumber(qty) }))
      }
      default:
        return []
    }
  }

  const getDetailColumns = (type: DetailPopupState['type']) => {
    switch (type) {
      case 'totalQty':
        return [
          { key: 'product', label: '제품' },
          { key: 'quantity', label: '출하량' },
        ]
      case 'totalOrders':
        return [
          { key: 'date', label: '날짜' },
          { key: 'orders', label: '건수' },
        ]
      case 'avgDaily':
        return [
          { key: 'date', label: '날짜' },
          { key: 'quantity', label: '출하량' },
        ]
      case 'customers':
        return [
          { key: 'customer', label: '고객사' },
          { key: 'quantity', label: '출하량' },
        ]
      case 'products':
        return [
          { key: 'product', label: '제품' },
          { key: 'quantity', label: '출하량' },
        ]
      default:
        return []
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Detail Popup */}
      <DetailPopup
        open={detailPopup.open}
        onOpenChange={(open) => setDetailPopup({ ...detailPopup, open })}
        title={
          detailPopup.type === 'totalQty' ? '총 출하량 상세'
            : detailPopup.type === 'totalOrders' ? '출하 건수 상세'
            : detailPopup.type === 'avgDaily' ? '일별 출하량'
            : detailPopup.type === 'customers' ? '고객사별 출하'
            : detailPopup.type === 'products' ? '제품별 출하'
            : '상세'
        }
        columns={getDetailColumns(detailPopup.type)}
        data={getDetailData(detailPopup.type)}
      />

      <div>
        <h1 className="text-3xl font-bold">출하량 대시보드</h1>
        <p className="text-gray-600 mt-2">고객사별 출하 현황 및 추세를 분석합니다.</p>
      </div>

      {/* Date Range Filter */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            기간 선택
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={startDate && endDate && Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) === 30 ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                const end = new Date()
                const start = new Date(end)
                start.setMonth(start.getMonth() - 1)
                setStartDate(dateFormatDisplay(start))
                setEndDate(dateFormatDisplay(end))
              }}
            >
              1개월
            </Button>
            <Button
              variant={startDate && endDate && Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) === 90 ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                const end = new Date()
                const start = new Date(end)
                start.setMonth(start.getMonth() - 3)
                setStartDate(dateFormatDisplay(start))
                setEndDate(dateFormatDisplay(end))
              }}
            >
              3개월
            </Button>
            <Button
              variant={startDate && endDate && Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) === 180 ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                const end = new Date()
                const start = new Date(end)
                start.setMonth(start.getMonth() - 6)
                setStartDate(dateFormatDisplay(start))
                setEndDate(dateFormatDisplay(end))
              }}
            >
              6개월
            </Button>
          </div>

          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">시작일</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-md text-sm"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">종료일</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-md text-sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Customer and Product Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">필터</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">고객사</label>
            <select
              value={selectedCustomer}
              onChange={(e) => setSelectedCustomer(e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-sm"
            >
              <option value="">전체</option>
              {availableCustomers.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">제품</label>
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-sm"
            >
              <option value="">전체</option>
              {availableProducts.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card
          className="cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => setDetailPopup({ open: true, type: 'totalQty' })}
        >
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
        <Card
          className="cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => setDetailPopup({ open: true, type: 'totalOrders' })}
        >
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
        <Card
          className="cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => setDetailPopup({ open: true, type: 'avgDaily' })}
        >
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
        <Card
          className="cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => setDetailPopup({ open: true, type: 'customers' })}
        >
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
        <Card
          className="cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => setDetailPopup({ open: true, type: 'products' })}
        >
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
                  interval={dailyTrendData.data.length > 60 ? 6 : dailyTrendData.data.length > 30 ? 2 : 0}
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

      {/* Customer Qty + Customer Orders (Qty Pie + Order Count Pie) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customer by Qty Bar Chart */}
        <Card className="lg:col-span-1">
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

        {/* Customer Qty Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              고객사별 출하 비중(출하량)
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

        {/* Customer Order Count Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              고객사별 출하 비중(매출건수)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={customerOrderData}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={true}
                  >
                    {customerOrderData.map((_, i) => (
                      <Cell key={i} fill={CUSTOMER_COLORS[i % CUSTOMER_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [formatNumber(value), '건수']} />
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
