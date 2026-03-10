'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
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
  X,
  ChevronDown,
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
  ComposedChart,
  Line,
} from 'recharts'

// ── Types ──────────────────────────────────────────────────────────────
interface ShipmentRaw {
  shipment_date: string
  product_code: string
  product_name: string
  shipped_qty: number
  customer_name: string
}

interface PriceMap {
  [itemCode: string]: number
}

type DetailType = 'totalQty' | 'totalOrders' | 'avgDaily' | 'customers' | 'products' | 'customerBar'

interface DetailPopupState {
  open: boolean
  type?: DetailType
  customerName?: string
}

// ── Constants ──────────────────────────────────────────────────────────
const CUSTOMER_COLORS = [
  '#3b82f6', '#f97316', '#10b981', '#8b5cf6', '#ef4444',
  '#06b6d4', '#f59e0b', '#ec4899', '#6366f1', '#14b8a6',
]

// ── Multi-Select Dropdown Component ────────────────────────────────────
function MultiSelect({
  label,
  options,
  selected,
  onChange,
}: {
  label: string
  options: string[]
  selected: string[]
  onChange: (v: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const toggle = (v: string) => {
    onChange(selected.includes(v) ? selected.filter(s => s !== v) : [...selected, v])
  }

  return (
    <div ref={ref} className="relative flex-1 min-w-[200px]">
      <label className="block text-sm font-medium mb-1">{label}</label>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full px-3 py-2 border rounded-md text-sm text-left flex items-center justify-between bg-white"
      >
        <span className="truncate">
          {selected.length === 0 ? '전체' : `${selected.length}개 선택`}
        </span>
        <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
      </button>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {selected.map(s => (
            <span key={s} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs">
              {s}
              <X className="h-3 w-3 cursor-pointer" onClick={() => toggle(s)} />
            </span>
          ))}
        </div>
      )}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border rounded-md shadow-lg max-h-60 overflow-auto">
          <button
            type="button"
            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 text-gray-500"
            onClick={() => { onChange([]); setOpen(false) }}
          >
            전체 (선택 해제)
          </button>
          {options.map(opt => (
            <label key={opt} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer">
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={() => toggle(opt)}
                className="rounded border-gray-300"
              />
              <span className="text-sm">{opt}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Helpers ─────────────────────────────────────────────────────────────
const dateFormatISO = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

// ── Main Page Component ────────────────────────────────────────────────
export default function ShipmentDashboardPage() {
  const { factory } = useFactory()

  // Data states
  const [shipments, setShipments] = useState<ShipmentRaw[]>([])
  const [priceMap, setPriceMap] = useState<PriceMap>({})
  const [loading, setLoading] = useState(true)

  // Filter states
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([])
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])

  // Popup state
  const [detailPopup, setDetailPopup] = useState<DetailPopupState>({ open: false })

  // ── Data Fetching ──────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      // Get latest shipment date for initial range
      const { data: latest } = await supabase
        .from('fact_shipment')
        .select('shipment_date')
        .eq('factory', factory)
        .order('shipment_date', { ascending: false })
        .limit(1)

      if (latest && latest.length > 0) {
        const latestDate = new Date(latest[0].shipment_date)
        setEndDate(dateFormatISO(latestDate))
        const oneMonthAgo = new Date(latestDate)
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)
        setStartDate(dateFormatISO(oneMonthAgo))
      }

      // Fetch all shipment data (use range to bypass 1000 row default limit)
      const { data: allData } = await supabase
        .from('fact_shipment')
        .select('shipment_date, product_code, product_name, shipped_qty, customer_name')
        .eq('factory', factory)
        .order('shipment_date')
        .range(0, 9999)

      setShipments(allData || [])

      // Fetch price map from dim_erp_item (use range to bypass 1000 row default limit)
      const { data: priceData } = await supabase
        .from('dim_erp_item')
        .select('item_code, sales_price')
        .range(0, 9999)

      const pm: PriceMap = {}
      for (const p of priceData || []) {
        pm[p.item_code] = Number(p.sales_price) || 0
      }
      setPriceMap(pm)
    } catch (err) {
      console.error('Failed to fetch shipment data:', err)
    } finally {
      setLoading(false)
    }
  }, [factory])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Filtering ──────────────────────────────────────────────────────
  const filteredShipments = useMemo(() => {
    return shipments.filter(s => {
      const dateOk = (!startDate || s.shipment_date >= startDate) && (!endDate || s.shipment_date <= endDate)
      const customerOk = selectedCustomers.length === 0 || selectedCustomers.includes(s.customer_name)
      const productOk = selectedProducts.length === 0 || selectedProducts.includes(s.product_code)
      return dateOk && customerOk && productOk
    })
  }, [shipments, startDate, endDate, selectedCustomers, selectedProducts])

  // Dropdown options (from date-filtered data only)
  const availableCustomers = useMemo(() => {
    const dateFiltered = shipments.filter(s =>
      (!startDate || s.shipment_date >= startDate) && (!endDate || s.shipment_date <= endDate)
    )
    return Array.from(new Set(dateFiltered.map(s => s.customer_name))).sort()
  }, [shipments, startDate, endDate])

  const availableProducts = useMemo(() => {
    const dateFiltered = shipments.filter(s =>
      (!startDate || s.shipment_date >= startDate) && (!endDate || s.shipment_date <= endDate)
    )
    return Array.from(new Set(dateFiltered.map(s => s.product_code))).sort()
  }, [shipments, startDate, endDate])

  // ── KPI Stats ──────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const totalQty = filteredShipments.reduce((s, r) => s + (r.shipped_qty || 0), 0)
    const totalOrders = filteredShipments.length
    const customers = new Set(filteredShipments.map(r => r.customer_name))
    const products = new Set(filteredShipments.map(r => r.product_code))

    let avgDaily = 0
    if (startDate && endDate) {
      const days = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1
      avgDaily = Math.round(totalQty / Math.max(days, 1))
    }

    return { totalQty, totalOrders, customerCount: customers.size, productCount: products.size, avgDaily }
  }, [filteredShipments, startDate, endDate])

  // ── Chart Data: Customer breakdown (qty) ───────────────────────────
  const customerData = useMemo(() => {
    const map: Record<string, number> = {}
    for (const s of filteredShipments) {
      map[s.customer_name] = (map[s.customer_name] || 0) + (s.shipped_qty || 0)
    }
    return Object.entries(map)
      .map(([name, qty]) => ({ name, qty }))
      .sort((a, b) => b.qty - a.qty)
  }, [filteredShipments])

  // ── Chart Data: Customer revenue breakdown (매출액) ────────────────
  const customerRevenueData = useMemo(() => {
    const map: Record<string, number> = {}
    for (const s of filteredShipments) {
      const price = priceMap[s.product_code] || 0
      const revenue = (s.shipped_qty || 0) * price
      map[s.customer_name] = (map[s.customer_name] || 0) + revenue
    }
    return Object.entries(map)
      .map(([name, revenue]) => ({ name, revenue }))
      .sort((a, b) => b.revenue - a.revenue)
  }, [filteredShipments, priceMap])

  // ── Chart Data: Daily trend (stacked by customer) ──────────────────
  const dailyTrendData = useMemo(() => {
    const dateMap: Record<string, Record<string, number>> = {}
    const custSet = new Set<string>()

    for (const s of filteredShipments) {
      if (!dateMap[s.shipment_date]) dateMap[s.shipment_date] = {}
      dateMap[s.shipment_date][s.customer_name] =
        (dateMap[s.shipment_date][s.customer_name] || 0) + (s.shipped_qty || 0)
      custSet.add(s.customer_name)
    }

    const allDates: any[] = []
    if (startDate && endDate) {
      const current = new Date(startDate)
      const end = new Date(endDate)
      while (current <= end) {
        const ds = dateFormatISO(current)
        const entry: any = { date: ds.slice(5), fullDate: ds, total: 0 }
        for (const c of custSet) {
          entry[c] = dateMap[ds]?.[c] || 0
          entry.total += entry[c]
        }
        allDates.push(entry)
        current.setDate(current.getDate() + 1)
      }
    }
    return { data: allDates, customers: Array.from(custSet) }
  }, [filteredShipments, startDate, endDate])

  // ── Chart Data: Top 10 products ────────────────────────────────────
  const topProducts = useMemo(() => {
    const map: Record<string, { name: string; qty: number }> = {}
    for (const s of filteredShipments) {
      if (!map[s.product_code]) map[s.product_code] = { name: s.product_name, qty: 0 }
      map[s.product_code].qty += (s.shipped_qty || 0)
    }
    return Object.values(map).sort((a, b) => b.qty - a.qty).slice(0, 10)
  }, [filteredShipments])

  // ── Chart Data: Customer × Product matrix ──────────────────────────
  const customerProductData = useMemo(() => {
    const map: Record<string, Record<string, number>> = {}
    for (const s of filteredShipments) {
      if (!map[s.customer_name]) map[s.customer_name] = {}
      map[s.customer_name][s.product_name] =
        (map[s.customer_name][s.product_name] || 0) + (s.shipped_qty || 0)
    }
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

  // ── Detail Popup Data ──────────────────────────────────────────────
  const getDetailData = (type?: DetailType, customerName?: string): Record<string, string>[] => {
    switch (type) {
      case 'totalQty': {
        const m: Record<string, number> = {}
        for (const s of filteredShipments) m[s.product_name] = (m[s.product_name] || 0) + (s.shipped_qty || 0)
        return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([name, qty]) => ({ '제품': name, '출하량': formatNumber(qty) }))
      }
      case 'totalOrders': {
        const m: Record<string, number> = {}
        for (const s of filteredShipments) m[s.shipment_date] = (m[s.shipment_date] || 0) + 1
        return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([date, cnt]) => ({ '날짜': date, '건수': formatNumber(cnt) }))
      }
      case 'avgDaily': {
        const m: Record<string, number> = {}
        for (const s of filteredShipments) m[s.shipment_date] = (m[s.shipment_date] || 0) + (s.shipped_qty || 0)
        return Object.entries(m).sort((a, b) => a[0].localeCompare(b[0])).map(([date, qty]) => ({ '날짜': date, '출하량': formatNumber(qty) }))
      }
      case 'customers': {
        const m: Record<string, number> = {}
        for (const s of filteredShipments) m[s.customer_name] = (m[s.customer_name] || 0) + (s.shipped_qty || 0)
        return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([name, qty]) => ({ '고객사': name, '출하량': formatNumber(qty) }))
      }
      case 'products': {
        const m: Record<string, number> = {}
        for (const s of filteredShipments) m[s.product_name] = (m[s.product_name] || 0) + (s.shipped_qty || 0)
        return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([name, qty]) => ({ '제품': name, '출하량': formatNumber(qty) }))
      }
      case 'customerBar': {
        if (!customerName) return []
        const m: Record<string, { qty: number; revenue: number }> = {}
        for (const s of filteredShipments) {
          if (s.customer_name !== customerName) continue
          if (!m[s.product_name]) m[s.product_name] = { qty: 0, revenue: 0 }
          m[s.product_name].qty += (s.shipped_qty || 0)
          m[s.product_name].revenue += (s.shipped_qty || 0) * (priceMap[s.product_code] || 0)
        }
        return Object.entries(m)
          .sort((a, b) => b[1].qty - a[1].qty)
          .map(([name, v]) => ({
            '제품': name,
            '출하량': formatNumber(v.qty),
            '매출액': formatNumber(Math.round(v.revenue)),
          }))
      }
      default:
        return []
    }
  }

  const getDetailColumns = (type?: DetailType) => {
    const m: Record<string, { key: string; label: string }[]> = {
      totalQty: [{ key: '제품', label: '제품' }, { key: '출하량', label: '출하량' }],
      totalOrders: [{ key: '날짜', label: '날짜' }, { key: '건수', label: '건수' }],
      avgDaily: [{ key: '날짜', label: '날짜' }, { key: '출하량', label: '출하량' }],
      customers: [{ key: '고객사', label: '고객사' }, { key: '출하량', label: '출하량' }],
      products: [{ key: '제품', label: '제품' }, { key: '출하량', label: '출하량' }],
      customerBar: [{ key: '제품', label: '제품' }, { key: '출하량', label: '출하량' }, { key: '매출액', label: '매출액' }],
    }
    return m[type || ''] || []
  }

  // ── Period quick-set helper ────────────────────────────────────────
  const setPeriod = (months: number) => {
    // Use latest shipment date as end reference
    const latestShipment = shipments.length > 0
      ? shipments[shipments.length - 1].shipment_date
      : dateFormatISO(new Date())
    const end = new Date(latestShipment)
    const start = new Date(end)
    start.setMonth(start.getMonth() - months)
    setStartDate(dateFormatISO(start))
    setEndDate(dateFormatISO(end))
  }

  const currentPeriodMonths = useMemo(() => {
    if (!startDate || !endDate) return 0
    const days = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000)
    if (days >= 28 && days <= 32) return 1
    if (days >= 88 && days <= 93) return 3
    if (days >= 178 && days <= 185) return 6
    return 0
  }, [startDate, endDate])

  // ── Render ─────────────────────────────────────────────────────────
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
            : detailPopup.type === 'customerBar' ? `${detailPopup.customerName} 출하 상세`
            : '상세'
        }
        columns={getDetailColumns(detailPopup.type)}
        data={getDetailData(detailPopup.type, detailPopup.customerName)}
      />

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">출하량 대시보드</h1>
        <p className="text-gray-600 mt-2">고객사별 출하 현황 및 추세를 분석합니다.</p>
      </div>

      {/* Filters (period + customer/product) — separated from cards */}
      <div className="bg-white border rounded-lg p-4 space-y-4">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <Calendar className="h-4 w-4" />
          기간 선택
        </div>
        <div className="flex gap-2 flex-wrap">
          {[1, 3, 6].map(m => (
            <Button
              key={m}
              variant={currentPeriodMonths === m ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPeriod(m)}
            >
              {m}개월
            </Button>
          ))}
        </div>
        <div className="flex gap-4 items-end flex-wrap">
          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-medium mb-1">시작일</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-sm"
            />
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-medium mb-1">종료일</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border rounded-md text-sm"
            />
          </div>
        </div>
        <div className="flex gap-4 flex-wrap">
          <MultiSelect
            label="고객사"
            options={availableCustomers}
            selected={selectedCustomers}
            onChange={setSelectedCustomers}
          />
          <MultiSelect
            label="제품"
            options={availableProducts}
            selected={selectedProducts}
            onChange={setSelectedProducts}
          />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setDetailPopup({ open: true, type: 'totalQty' })}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg"><Truck className="h-5 w-5 text-blue-600" /></div>
              <div>
                <p className="text-sm text-gray-500">총 출하량</p>
                <p className="text-2xl font-bold">{formatNumber(stats.totalQty)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setDetailPopup({ open: true, type: 'totalOrders' })}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg"><BarChart3 className="h-5 w-5 text-green-600" /></div>
              <div>
                <p className="text-sm text-gray-500">출하 건수</p>
                <p className="text-2xl font-bold">{formatNumber(stats.totalOrders)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setDetailPopup({ open: true, type: 'avgDaily' })}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg"><TrendingUp className="h-5 w-5 text-purple-600" /></div>
              <div>
                <p className="text-sm text-gray-500">일평균 출하</p>
                <p className="text-2xl font-bold">{formatNumber(stats.avgDaily)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setDetailPopup({ open: true, type: 'customers' })}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg"><Users className="h-5 w-5 text-orange-600" /></div>
              <div>
                <p className="text-sm text-gray-500">고객사</p>
                <p className="text-2xl font-bold">{stats.customerCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => setDetailPopup({ open: true, type: 'products' })}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-100 rounded-lg"><Package className="h-5 w-5 text-cyan-600" /></div>
              <div>
                <p className="text-sm text-gray-500">출하 제품</p>
                <p className="text-2xl font-bold">{stats.productCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Daily Trend Chart */}
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

      {/* Customer Qty Bar + Revenue Pie (2 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Customer Bar Chart (clickable) */}
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
                <BarChart
                  data={customerData}
                  layout="vertical"
                  margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
                  onClick={(e) => {
                    if (e && e.activeLabel) {
                      setDetailPopup({ open: true, type: 'customerBar', customerName: e.activeLabel })
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => formatNumber(v)} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                  <Tooltip formatter={(value: number) => [formatNumber(value), '출하량']} />
                  <Bar dataKey="qty" fill="#3b82f6" radius={[0, 4, 4, 0]} name="출하량" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-gray-400 mt-2 text-center">클릭하면 해당 고객사의 제품별 상세를 볼 수 있습니다</p>
          </CardContent>
        </Card>

        {/* Customer Revenue Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              고객사별 출하 비중 (매출액)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={customerRevenueData}
                    dataKey="revenue"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={true}
                  >
                    {customerRevenueData.map((_, i) => (
                      <Cell key={i} fill={CUSTOMER_COLORS[i % CUSTOMER_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [formatNumber(Math.round(value as number)), '매출액']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Products + Customer-Product matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} />
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
                            <span className={cn(val > 0 ? 'font-medium' : 'text-gray-300')}>
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
