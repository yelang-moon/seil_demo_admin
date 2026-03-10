'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useFactory } from '@/contexts/factory-context'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatNumber } from '@/lib/utils'
import { cn } from '@/lib/utils'
import {
  ShieldAlert,
  AlertTriangle,
  PackageX,
  Package,
  TrendingDown,
  TrendingUp,
  Search,
  ChevronUp,
  ChevronDown,
  Filter,
} from 'lucide-react'
import {
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ComposedChart,
} from 'recharts'

// ====== Types ======
interface ProductStock {
  id: number
  product_code: string | null
  product_name: string | null
  equipment_name: string | null
  daily_max_qty: number
  safety_stock_qty: number
  current_stock_qty: number
  factory: string | null
}

interface ShipmentDay {
  date: string
  qty: number
}

interface ShipmentRecord {
  shipment_date: string
  shipped_qty: number
  customer_name: string
  order_number: string | null
}

interface ProductAnalysis {
  product: ProductStock
  stockRatio: number
  shipments7d: number
  shipments30d: number
  shipments180d: number
  avgDaily7d: number
  avgDaily30d: number
  daysRemaining: number
  urgency: 'critical' | 'high' | 'medium' | 'low'
  urgencyLabel: string
  trend: 'up' | 'down' | 'stable'
}

// ====== Urgency calculation ======
function calcUrgency(
  stockRatio: number,
  daysRemaining: number,
  hasRecentShipment: boolean,
  avgDaily7d: number,
  currentStock: number,
  safetyStock: number
): { urgency: ProductAnalysis['urgency']; label: string } {
  if (stockRatio > 250 && !hasRecentShipment) {
    return { urgency: 'medium', label: '악성재고 의심' }
  }
  if (hasRecentShipment && avgDaily7d > 0) {
    if (daysRemaining < 3) return { urgency: 'critical', label: '긴급 생산 필요' }
    if (daysRemaining < 7) return { urgency: 'high', label: '생산 우선' }
    if (daysRemaining < 14 || stockRatio < 100) return { urgency: 'medium', label: '주의' }
    return { urgency: 'low', label: '양호' }
  }
  if (stockRatio < 50) return { urgency: 'medium', label: '재고 부족' }
  if (stockRatio > 200) return { urgency: 'low', label: '과잉 재고' }
  return { urgency: 'low', label: '양호' }
}

const URGENCY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 }
const URGENCY_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 border-red-200',
  high: 'bg-orange-100 text-orange-800 border-orange-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  low: 'bg-green-100 text-green-800 border-green-200',
}
const URGENCY_DOT: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-green-500',
}

const URGENCY_FILTER_OPTIONS: { key: ProductAnalysis['urgency']; label: string; color: string }[] = [
  { key: 'critical', label: '긴급', color: 'bg-red-500' },
  { key: 'high', label: '우선', color: 'bg-orange-500' },
  { key: 'medium', label: '주의', color: 'bg-yellow-500' },
  { key: 'low', label: '양호', color: 'bg-green-500' },
]

const DAYS_FILTER_OPTIONS = [
  { label: '전체', min: 0, max: Infinity },
  { label: '3일 이내', min: 0, max: 3 },
  { label: '7일 이내', min: 0, max: 7 },
  { label: '14일 이내', min: 0, max: 14 },
  { label: '30일 이내', min: 0, max: 30 },
  { label: '30일 이상', min: 30, max: Infinity },
]

type SortKey = 'urgency' | 'stockRatio' | 'daysRemaining' | 'shipments7d' | 'shipments30d' | 'shipments180d' | 'product_name' | 'equipment_name'
type SortDir = 'asc' | 'desc'

export default function SafetyStockPage() {
  const { factory } = useFactory()
  const [products, setProducts] = useState<ProductStock[]>([])
  const [shipmentMap, setShipmentMap] = useState<Record<string, ShipmentDay[]>>({})
  const [shipment180Map, setShipment180Map] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('urgency')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [selectedProduct, setSelectedProduct] = useState<ProductAnalysis | null>(null)
  const [detailShipments, setDetailShipments] = useState<ShipmentDay[]>([])
  const [detailRecords, setDetailRecords] = useState<ShipmentRecord[]>([])
  const [detailOpen, setDetailOpen] = useState(false)

  // Filters
  const [urgencyFilter, setUrgencyFilter] = useState<Set<ProductAnalysis['urgency']>>(new Set())
  const [daysFilter, setDaysFilter] = useState(0) // index into DAYS_FILTER_OPTIONS
  const [showFilters, setShowFilters] = useState(false)

  const toggleUrgencyFilter = (u: ProductAnalysis['urgency']) => {
    setUrgencyFilter(prev => {
      const next = new Set(prev)
      if (next.has(u)) next.delete(u)
      else next.add(u)
      return next
    })
  }

  // Fetch all data
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const { data: prods, error: prodErr } = await supabase
        .from('dim_product')
        .select('id, product_code, product_name, equipment_name, daily_max_qty, safety_stock_qty, current_stock_qty, factory')
        .eq('factory', factory)
        .gt('safety_stock_qty', 0)
        .order('product_name')

      if (prodErr) throw prodErr

      const today = new Date()

      // 30-day shipments (for daily analysis)
      const d30ago = new Date(today)
      d30ago.setDate(d30ago.getDate() - 30)
      const d30str = `${d30ago.getFullYear()}-${String(d30ago.getMonth() + 1).padStart(2, '0')}-${String(d30ago.getDate()).padStart(2, '0')}`

      // 180-day shipments (for 6-month totals)
      const d180ago = new Date(today)
      d180ago.setDate(d180ago.getDate() - 180)
      const d180str = `${d180ago.getFullYear()}-${String(d180ago.getMonth() + 1).padStart(2, '0')}-${String(d180ago.getDate()).padStart(2, '0')}`

      const [shipsRes30, shipsRes180] = await Promise.all([
        supabase
          .from('fact_shipment')
          .select('product_code, shipment_date, shipped_qty')
          .eq('factory', factory)
          .gte('shipment_date', d30str)
          .order('shipment_date'),
        supabase
          .from('fact_shipment')
          .select('product_code, shipped_qty')
          .eq('factory', factory)
          .gte('shipment_date', d180str)
          .lt('shipment_date', d30str),
      ])

      if (shipsRes30.error) throw shipsRes30.error
      if (shipsRes180.error) throw shipsRes180.error

      // Build 30-day shipment map by product_code
      const sMap: Record<string, ShipmentDay[]> = {}
      for (const s of (shipsRes30.data || [])) {
        const code = s.product_code || ''
        if (!sMap[code]) sMap[code] = []
        const existing = sMap[code].find(d => d.date === s.shipment_date)
        if (existing) {
          existing.qty += (s.shipped_qty || 0)
        } else {
          sMap[code].push({ date: s.shipment_date, qty: s.shipped_qty || 0 })
        }
      }

      // Build 180-day totals (only the 150 days before the 30-day window)
      const s180Map: Record<string, number> = {}
      for (const s of (shipsRes180.data || [])) {
        const code = s.product_code || ''
        s180Map[code] = (s180Map[code] || 0) + (s.shipped_qty || 0)
      }
      // Add 30-day data to get full 180-day total
      for (const code of Object.keys(sMap)) {
        const total30 = sMap[code].reduce((sum, d) => sum + d.qty, 0)
        s180Map[code] = (s180Map[code] || 0) + total30
      }

      setProducts(prods || [])
      setShipmentMap(sMap)
      setShipment180Map(s180Map)
    } catch (err) {
      console.error('Failed to fetch data:', err)
    } finally {
      setLoading(false)
    }
  }, [factory])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Analyze products
  const analyses: ProductAnalysis[] = useMemo(() => {
    const today = new Date()
    const d7ago = new Date(today)
    d7ago.setDate(d7ago.getDate() - 7)
    const d7str = `${d7ago.getFullYear()}-${String(d7ago.getMonth() + 1).padStart(2, '0')}-${String(d7ago.getDate()).padStart(2, '0')}`

    return products.map((p) => {
      const code = p.product_code || ''
      const shipDays = shipmentMap[code] || []

      const total30d = shipDays.reduce((s, d) => s + d.qty, 0)
      const total7d = shipDays.filter(d => d.date >= d7str).reduce((s, d) => s + d.qty, 0)
      const total180d = shipment180Map[code] || 0

      const avgDaily30d = total30d / 30
      const avgDaily7d = total7d / 7

      const stockRatio = p.safety_stock_qty > 0 ? (p.current_stock_qty / p.safety_stock_qty) * 100 : 0
      const daysRemaining = avgDaily7d > 0 ? p.current_stock_qty / avgDaily7d : 999

      const hasRecentShipment = total7d > 0
      const { urgency, label } = calcUrgency(stockRatio, daysRemaining, hasRecentShipment, avgDaily7d, p.current_stock_qty, p.safety_stock_qty)

      let trend: 'up' | 'down' | 'stable' = 'stable'
      if (avgDaily30d > 0 && avgDaily7d > 0) {
        const ratio = avgDaily7d / avgDaily30d
        if (ratio > 1.2) trend = 'up'
        else if (ratio < 0.8) trend = 'down'
      }

      return {
        product: p,
        stockRatio,
        shipments7d: total7d,
        shipments30d: total30d,
        shipments180d: total180d,
        avgDaily7d,
        avgDaily30d,
        daysRemaining: Math.min(daysRemaining, 999),
        urgency,
        urgencyLabel: label,
        trend,
      }
    })
  }, [products, shipmentMap, shipment180Map])

  // Filter and sort
  const displayed = useMemo(() => {
    let filtered = analyses

    // Text search
    if (search) {
      const s = search.toLowerCase()
      filtered = filtered.filter(
        (a) =>
          (a.product.product_name || '').toLowerCase().includes(s) ||
          (a.product.product_code || '').toLowerCase().includes(s) ||
          (a.product.equipment_name || '').toLowerCase().includes(s)
      )
    }

    // Urgency filter
    if (urgencyFilter.size > 0) {
      filtered = filtered.filter(a => urgencyFilter.has(a.urgency))
    }

    // Days remaining filter
    const df = DAYS_FILTER_OPTIONS[daysFilter]
    if (df && (df.min > 0 || df.max < Infinity)) {
      filtered = filtered.filter(a => a.daysRemaining >= df.min && a.daysRemaining < df.max)
    }

    filtered.sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'urgency':
          cmp = URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency]
          break
        case 'stockRatio':
          cmp = a.stockRatio - b.stockRatio
          break
        case 'daysRemaining':
          cmp = a.daysRemaining - b.daysRemaining
          break
        case 'shipments7d':
          cmp = a.shipments7d - b.shipments7d
          break
        case 'shipments30d':
          cmp = a.shipments30d - b.shipments30d
          break
        case 'shipments180d':
          cmp = a.shipments180d - b.shipments180d
          break
        case 'product_name':
          cmp = (a.product.product_name || '').localeCompare(b.product.product_name || '', 'ko')
          break
        case 'equipment_name':
          cmp = (a.product.equipment_name || '').localeCompare(b.product.equipment_name || '', 'ko')
          break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })

    return filtered
  }, [analyses, search, sortKey, sortDir, urgencyFilter, daysFilter])

  // KPI stats
  const stats = useMemo(() => {
    const total = analyses.length
    const belowSafety = analyses.filter(a => a.stockRatio < 100).length
    const critical = analyses.filter(a => a.urgency === 'critical' || a.urgency === 'high').length
    const deadStock = analyses.filter(a => a.stockRatio > 250 && a.shipments30d === 0).length
    return { total, belowSafety, critical, deadStock }
  }, [analyses])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(key === 'urgency' || key === 'stockRatio' || key === 'daysRemaining' ? 'asc' : 'desc')
    }
  }

  // Open detail popup
  const openDetail = async (analysis: ProductAnalysis) => {
    setSelectedProduct(analysis)
    setDetailOpen(true)

    const today = new Date()
    const d90ago = new Date(today)
    d90ago.setDate(d90ago.getDate() - 90)
    const d90str = `${d90ago.getFullYear()}-${String(d90ago.getMonth() + 1).padStart(2, '0')}-${String(d90ago.getDate()).padStart(2, '0')}`

    // Fetch detail shipment data (with customer info for table)
    const { data } = await supabase
      .from('fact_shipment')
      .select('shipment_date, shipped_qty, customer_name, order_number')
      .eq('factory', factory)
      .eq('product_code', analysis.product.product_code)
      .gte('shipment_date', d90str)
      .order('shipment_date', { ascending: false })

    // Build chart data (aggregated by date, last 30 days)
    const byDate: Record<string, number> = {}
    for (const d of (data || [])) {
      byDate[d.shipment_date] = (byDate[d.shipment_date] || 0) + (d.shipped_qty || 0)
    }

    const days: ShipmentDay[] = []
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      days.push({ date: ds, qty: byDate[ds] || 0 })
    }

    setDetailShipments(days)
    setDetailRecords((data || []).map(d => ({
      shipment_date: d.shipment_date,
      shipped_qty: d.shipped_qty || 0,
      customer_name: d.customer_name || '',
      order_number: d.order_number || null,
    })))
  }

  // Build forecast chart data
  const forecastData = useMemo(() => {
    if (!selectedProduct || detailShipments.length === 0) return []

    const data = detailShipments.map(d => ({
      date: d.date.slice(5),
      fullDate: d.date,
      actual: d.qty,
      forecast: null as number | null,
      isForecast: false,
    }))

    const avgDaily = selectedProduct.avgDaily7d
    const today = new Date()
    for (let i = 1; i <= 7; i++) {
      const d = new Date(today)
      d.setDate(d.getDate() + i)
      const ds = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      data.push({
        date: ds,
        fullDate: `${d.getFullYear()}-${ds}`,
        actual: null as any,
        forecast: Math.round(avgDaily),
        isForecast: true,
      })
    }

    return data
  }, [selectedProduct, detailShipments])

  const depletionDays = selectedProduct
    ? selectedProduct.avgDaily7d > 0
      ? Math.round(selectedProduct.product.current_stock_qty / selectedProduct.avgDaily7d)
      : null
    : null

  const SortIcon = ({ field }: { field: SortKey }) => {
    if (sortKey !== field) return <ChevronDown className="h-3 w-3 opacity-30" />
    return sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
  }

  const activeFilterCount = urgencyFilter.size + (daysFilter > 0 ? 1 : 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">안전 재고 대시보드</h1>
        <p className="text-gray-600 mt-2">제품별 안전 재고 현황 및 생산 우선순위를 확인합니다.</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Package className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">관리 제품</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <ShieldAlert className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">안전재고 미달</p>
                <p className="text-2xl font-bold text-red-600">{stats.belowSafety}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">긴급 생산 필요</p>
                <p className="text-2xl font-bold text-orange-600">{stats.critical}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <PackageX className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">악성재고 의심</p>
                <p className="text-2xl font-bold text-gray-600">{stats.deadStock}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search + Filter Toggle */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="제품명, 제품코드, 설비명 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button
          variant={showFilters ? 'default' : 'outline'}
          onClick={() => setShowFilters(!showFilters)}
          className="gap-2"
        >
          <Filter className="h-4 w-4" />
          필터
          {activeFilterCount > 0 && (
            <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {activeFilterCount}
            </span>
          )}
        </Button>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-col md:flex-row gap-6">
              {/* Urgency filter */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">긴급도</p>
                <div className="flex flex-wrap gap-2">
                  {URGENCY_FILTER_OPTIONS.map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => toggleUrgencyFilter(opt.key)}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                        urgencyFilter.has(opt.key)
                          ? URGENCY_COLORS[opt.key]
                          : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                      )}
                    >
                      <span className={cn('w-2 h-2 rounded-full', opt.color)} />
                      {opt.label}
                    </button>
                  ))}
                  {urgencyFilter.size > 0 && (
                    <button
                      onClick={() => setUrgencyFilter(new Set())}
                      className="text-xs text-gray-500 hover:text-gray-700 underline ml-1"
                    >
                      초기화
                    </button>
                  )}
                </div>
              </div>

              {/* Days remaining filter */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">잔여 일수</p>
                <div className="flex flex-wrap gap-2">
                  {DAYS_FILTER_OPTIONS.map((opt, idx) => (
                    <button
                      key={idx}
                      onClick={() => setDaysFilter(idx)}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                        daysFilter === idx
                          ? 'bg-blue-100 text-blue-800 border-blue-200'
                          : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Product Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left p-3 font-medium">
                    <button onClick={() => toggleSort('urgency')} className="flex items-center gap-1 hover:text-blue-600">
                      긴급도 <SortIcon field="urgency" />
                    </button>
                  </th>
                  <th className="text-left p-3 font-medium">
                    <button onClick={() => toggleSort('product_name')} className="flex items-center gap-1 hover:text-blue-600">
                      제품명 <SortIcon field="product_name" />
                    </button>
                  </th>
                  <th className="text-left p-3 font-medium">
                    <button onClick={() => toggleSort('equipment_name')} className="flex items-center gap-1 hover:text-blue-600">
                      설비 <SortIcon field="equipment_name" />
                    </button>
                  </th>
                  <th className="text-right p-3 font-medium">안전재고</th>
                  <th className="text-right p-3 font-medium">현재재고</th>
                  <th className="text-right p-3 font-medium">
                    <button onClick={() => toggleSort('stockRatio')} className="flex items-center gap-1 justify-end hover:text-blue-600">
                      재고율 <SortIcon field="stockRatio" />
                    </button>
                  </th>
                  <th className="text-right p-3 font-medium">
                    <button onClick={() => toggleSort('shipments7d')} className="flex items-center gap-1 justify-end hover:text-blue-600">
                      7일 출하 <SortIcon field="shipments7d" />
                    </button>
                  </th>
                  <th className="text-right p-3 font-medium">
                    <button onClick={() => toggleSort('shipments30d')} className="flex items-center gap-1 justify-end hover:text-blue-600">
                      30일 출하 <SortIcon field="shipments30d" />
                    </button>
                  </th>
                  <th className="text-right p-3 font-medium">
                    <button onClick={() => toggleSort('shipments180d')} className="flex items-center gap-1 justify-end hover:text-blue-600">
                      6개월 출하 <SortIcon field="shipments180d" />
                    </button>
                  </th>
                  <th className="text-right p-3 font-medium">일평균 출하</th>
                  <th className="text-right p-3 font-medium">
                    <button onClick={() => toggleSort('daysRemaining')} className="flex items-center gap-1 justify-end hover:text-blue-600">
                      잔여일수 <SortIcon field="daysRemaining" />
                    </button>
                  </th>
                  <th className="text-center p-3 font-medium">추세</th>
                </tr>
              </thead>
              <tbody>
                {displayed.map((a) => (
                  <tr
                    key={a.product.id}
                    className="border-b hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => openDetail(a)}
                  >
                    <td className="p-3">
                      <span className={cn(
                        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border',
                        URGENCY_COLORS[a.urgency]
                      )}>
                        <span className={cn('w-1.5 h-1.5 rounded-full', URGENCY_DOT[a.urgency])} />
                        {a.urgencyLabel}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="font-medium">{a.product.product_name}</div>
                      <div className="text-xs text-gray-400">{a.product.product_code}</div>
                    </td>
                    <td className="p-3 text-sm text-gray-600">{a.product.equipment_name || '-'}</td>
                    <td className="p-3 text-right tabular-nums">{formatNumber(a.product.safety_stock_qty)}</td>
                    <td className="p-3 text-right tabular-nums">{formatNumber(a.product.current_stock_qty)}</td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={cn(
                              'h-full rounded-full',
                              a.stockRatio < 50 ? 'bg-red-500' :
                              a.stockRatio < 80 ? 'bg-orange-500' :
                              a.stockRatio < 100 ? 'bg-yellow-500' :
                              'bg-green-500'
                            )}
                            style={{ width: `${Math.min(a.stockRatio, 100)}%` }}
                          />
                        </div>
                        <span className={cn(
                          'text-xs font-medium tabular-nums',
                          a.stockRatio < 50 ? 'text-red-600' :
                          a.stockRatio < 80 ? 'text-orange-600' :
                          a.stockRatio < 100 ? 'text-yellow-600' :
                          'text-green-600'
                        )}>
                          {a.stockRatio.toFixed(0)}%
                        </span>
                      </div>
                    </td>
                    <td className="p-3 text-right tabular-nums">{formatNumber(a.shipments7d)}</td>
                    <td className="p-3 text-right tabular-nums">{formatNumber(a.shipments30d)}</td>
                    <td className="p-3 text-right tabular-nums">{formatNumber(a.shipments180d)}</td>
                    <td className="p-3 text-right tabular-nums">{a.avgDaily7d > 0 ? formatNumber(Math.round(a.avgDaily7d)) : '-'}</td>
                    <td className="p-3 text-right">
                      <span className={cn(
                        'tabular-nums font-medium',
                        a.daysRemaining < 3 ? 'text-red-600' :
                        a.daysRemaining < 7 ? 'text-orange-600' :
                        a.daysRemaining < 14 ? 'text-yellow-600' :
                        'text-gray-600'
                      )}>
                        {a.daysRemaining >= 999 ? '∞' : `${Math.round(a.daysRemaining)}일`}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      {a.trend === 'up' && <TrendingUp className="h-4 w-4 text-red-500 mx-auto" />}
                      {a.trend === 'down' && <TrendingDown className="h-4 w-4 text-green-500 mx-auto" />}
                      {a.trend === 'stable' && <span className="text-gray-400">-</span>}
                    </td>
                  </tr>
                ))}
                {displayed.length === 0 && (
                  <tr>
                    <td colSpan={12} className="p-8 text-center text-gray-500">
                      {search || urgencyFilter.size > 0 || daysFilter > 0 ? '검색 결과가 없습니다.' : '데이터가 없습니다.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="p-3 text-sm text-gray-500 border-t">
            총 {displayed.length}개 제품 (행을 클릭하면 상세 정보를 확인할 수 있습니다)
          </div>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {selectedProduct && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <span className={cn(
                    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border',
                    URGENCY_COLORS[selectedProduct.urgency]
                  )}>
                    <span className={cn('w-1.5 h-1.5 rounded-full', URGENCY_DOT[selectedProduct.urgency])} />
                    {selectedProduct.urgencyLabel}
                  </span>
                  <div>
                    <span>{selectedProduct.product.product_name}</span>
                    <span className="text-sm font-normal text-gray-500 ml-2">
                      ({selectedProduct.product.equipment_name || '설비 미지정'})
                    </span>
                  </div>
                </DialogTitle>
              </DialogHeader>

              {/* Detail KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">안전재고</p>
                  <p className="text-lg font-bold">{formatNumber(selectedProduct.product.safety_stock_qty)}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">현재재고</p>
                  <p className={cn('text-lg font-bold', selectedProduct.stockRatio < 100 ? 'text-red-600' : 'text-green-600')}>
                    {formatNumber(selectedProduct.product.current_stock_qty)}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">재고율</p>
                  <p className="text-lg font-bold">{selectedProduct.stockRatio.toFixed(1)}%</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">예상 소진일</p>
                  <p className={cn('text-lg font-bold', depletionDays !== null && depletionDays < 7 ? 'text-red-600' : '')}>
                    {depletionDays !== null ? `${depletionDays}일` : '출하 없음'}
                  </p>
                </div>
              </div>

              {/* Shipment stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs text-blue-600">7일 총 출하</p>
                  <p className="text-lg font-bold text-blue-700">{formatNumber(selectedProduct.shipments7d)}</p>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs text-blue-600">30일 총 출하</p>
                  <p className="text-lg font-bold text-blue-700">{formatNumber(selectedProduct.shipments30d)}</p>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs text-blue-600">일평균 출하(7일)</p>
                  <p className="text-lg font-bold text-blue-700">{formatNumber(Math.round(selectedProduct.avgDaily7d))}</p>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs text-blue-600">일평균 출하(30일)</p>
                  <p className="text-lg font-bold text-blue-700">{formatNumber(Math.round(selectedProduct.avgDaily30d))}</p>
                </div>
              </div>

              {/* Chart */}
              {forecastData.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">일별 출하량 추세 및 7일 예측</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={forecastData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 10 }}
                          interval={Math.floor(forecastData.length / 8)}
                        />
                        <YAxis tick={{ fontSize: 11 }} width={60} tickFormatter={(v) => formatNumber(v)} />
                        <Tooltip
                          formatter={(value: number, name: string) => [
                            formatNumber(value),
                            name === 'actual' ? '실제 출하' : '예측 출하',
                          ]}
                        />
                        <Bar dataKey="actual" fill="#3b82f6" radius={[2, 2, 0, 0]} name="actual" />
                        <Bar dataKey="forecast" fill="#f97316" opacity={0.6} radius={[2, 2, 0, 0]} name="forecast" />
                        {selectedProduct.avgDaily7d > 0 && (
                          <ReferenceLine
                            y={Math.round(selectedProduct.avgDaily7d)}
                            stroke="#ef4444"
                            strokeDasharray="5 5"
                            label={{ value: `일평균 ${formatNumber(Math.round(selectedProduct.avgDaily7d))}`, fontSize: 10, fill: '#ef4444', position: 'right' }}
                          />
                        )}
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex gap-4 mt-2 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><span className="w-3 h-3 bg-blue-500 rounded" /> 실제 출하</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 bg-orange-400 rounded" /> 예측 출하</span>
                    <span className="flex items-center gap-1"><span className="w-6 h-0 border-t-2 border-red-500 border-dashed" /> 일평균</span>
                  </div>
                </div>
              )}

              {/* Stock gauge */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">안전재고 대비 현재 재고</h3>
                <div className="relative h-8 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      selectedProduct.stockRatio < 50 ? 'bg-red-500' :
                      selectedProduct.stockRatio < 80 ? 'bg-orange-500' :
                      selectedProduct.stockRatio < 100 ? 'bg-yellow-500' :
                      selectedProduct.stockRatio > 200 ? 'bg-purple-400' :
                      'bg-green-500'
                    )}
                    style={{ width: `${Math.min(selectedProduct.stockRatio, 100)}%` }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center text-xs font-bold">
                    {formatNumber(selectedProduct.product.current_stock_qty)} / {formatNumber(selectedProduct.product.safety_stock_qty)} ({selectedProduct.stockRatio.toFixed(1)}%)
                  </div>
                </div>
              </div>

              {/* Detail Shipment Records Table */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">출하 상세 내역 (최근 90일)</h3>
                <div className="border rounded-lg overflow-hidden">
                  <div className="max-h-60 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr className="border-b">
                          <th className="text-left p-2 font-medium">출하일</th>
                          <th className="text-right p-2 font-medium">출하수량</th>
                          <th className="text-left p-2 font-medium">고객사</th>
                          <th className="text-left p-2 font-medium">주문번호</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailRecords.length > 0 ? (
                          detailRecords.map((r, i) => (
                            <tr key={i} className="border-b last:border-b-0 hover:bg-gray-50">
                              <td className="p-2 tabular-nums">{r.shipment_date}</td>
                              <td className="p-2 text-right tabular-nums font-medium">{formatNumber(r.shipped_qty)}</td>
                              <td className="p-2">{r.customer_name}</td>
                              <td className="p-2 text-gray-500 text-xs">{r.order_number || '-'}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={4} className="p-4 text-center text-gray-400">출하 내역이 없습니다.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  {detailRecords.length > 0 && (
                    <div className="p-2 text-xs text-gray-500 border-t bg-gray-50">
                      총 {detailRecords.length}건
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
