'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useFactory } from '@/contexts/factory-context'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface EquipmentStatus {
  equipmentName: string
  officialName: string
  status: 'running' | 'idle'
  productName: string
  productCode: string
  producedQty: number
  defectQty: number
  dailyMaxQty: number
  utilization: number
  workMinutes: number
  workerCount: number
  defectRate: number
  lastUpdate: string
}

interface FactoryKPI {
  totalProduction: number
  totalDefect: number
  runningCount: number
  idleCount: number
  avgUtilization: number
  defectRate: number
  latestDate: string
}

export default function FactoryMonitorPage() {
  const { factory } = useFactory()
  const [equipmentList, setEquipmentList] = useState<EquipmentStatus[]>([])
  const [kpi, setKpi] = useState<FactoryKPI | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      // 1. Get latest production date
      const { data: latestRow } = await supabase
        .from('fact_production')
        .select('production_date')
        .eq('factory', factory)
        .order('production_date', { ascending: false })
        .limit(1)

      if (!latestRow || latestRow.length === 0) {
        setEquipmentList([])
        setKpi(null)
        setLoading(false)
        return
      }
      const latestDate = latestRow[0].production_date

      // 2. Get today's production data
      const { data: prodData } = await supabase
        .from('fact_production')
        .select('equipment_name, product_name, product_code, produced_qty, finished_qty, defect_qty, work_minutes, worker_count')
        .eq('factory', factory)
        .eq('production_date', latestDate)

      // 3. Get equipment master
      const { data: equipData } = await supabase
        .from('dim_equipment')
        .select('name_legacy, name_official, name_short, factory')
        .eq('factory', factory)

      // 4. Get product master for daily_max_qty
      const { data: productData } = await supabase
        .from('dim_product')
        .select('equipment_name, product_name, daily_max_qty')
        .eq('factory', factory)

      const equipMap = new Map<string, { official: string; short: string }>()
      equipData?.forEach(e => {
        equipMap.set(e.name_legacy, { official: e.name_official || e.name_legacy, short: e.name_short || '' })
      })

      const maxQtyMap = new Map<string, number>()
      productData?.forEach(p => {
        const key = `${p.equipment_name}__${p.product_name}`
        maxQtyMap.set(key, p.daily_max_qty || 0)
      })

      // Aggregate by equipment
      const equipAgg = new Map<string, {
        productName: string
        productCode: string
        producedQty: number
        defectQty: number
        dailyMaxQty: number
        workMinutes: number
        workerCount: number
      }>()

      prodData?.forEach(row => {
        const existing = equipAgg.get(row.equipment_name)
        const maxQty = maxQtyMap.get(`${row.equipment_name}__${row.product_name}`) || 0
        if (existing) {
          existing.producedQty += row.produced_qty || row.finished_qty || 0
          existing.defectQty += row.defect_qty || 0
          existing.dailyMaxQty += maxQty
          existing.workMinutes += row.work_minutes || 0
          existing.workerCount = Math.max(existing.workerCount, row.worker_count || 0)
          // Keep last product name
          existing.productName = row.product_name || existing.productName
          existing.productCode = row.product_code || existing.productCode
        } else {
          equipAgg.set(row.equipment_name, {
            productName: row.product_name || '-',
            productCode: row.product_code || '-',
            producedQty: row.produced_qty || row.finished_qty || 0,
            defectQty: row.defect_qty || 0,
            dailyMaxQty: maxQty,
            workMinutes: row.work_minutes || 0,
            workerCount: row.worker_count || 0,
          })
        }
      })

      // Build equipment status list
      const allEquipNames = new Set<string>()
      equipData?.forEach(e => allEquipNames.add(e.name_legacy))
      prodData?.forEach(r => allEquipNames.add(r.equipment_name))

      const statusList: EquipmentStatus[] = []
      allEquipNames.forEach(name => {
        const agg = equipAgg.get(name)
        const info = equipMap.get(name)
        const isRunning = !!agg && agg.producedQty > 0
        const produced = agg?.producedQty || 0
        const maxQty = agg?.dailyMaxQty || 0
        const defect = agg?.defectQty || 0
        const util = maxQty > 0 ? (produced / maxQty) * 100 : 0

        statusList.push({
          equipmentName: name,
          officialName: info?.official || name,
          status: isRunning ? 'running' : 'idle',
          productName: agg?.productName || '-',
          productCode: agg?.productCode || '-',
          producedQty: produced,
          defectQty: defect,
          dailyMaxQty: maxQty,
          utilization: Math.min(util, 150),
          workMinutes: agg?.workMinutes || 0,
          workerCount: agg?.workerCount || 0,
          defectRate: produced > 0 ? (defect / produced) * 100 : 0,
          lastUpdate: latestDate,
        })
      })

      // Sort: running first, then by utilization desc
      statusList.sort((a, b) => {
        if (a.status !== b.status) return a.status === 'running' ? -1 : 1
        return b.utilization - a.utilization
      })

      // Calculate KPIs
      const running = statusList.filter(e => e.status === 'running')
      const idle = statusList.filter(e => e.status === 'idle')
      const totalProd = statusList.reduce((s, e) => s + e.producedQty, 0)
      const totalDef = statusList.reduce((s, e) => s + e.defectQty, 0)
      const avgUtil = running.length > 0
        ? running.reduce((s, e) => s + e.utilization, 0) / running.length
        : 0

      setEquipmentList(statusList)
      setKpi({
        totalProduction: totalProd,
        totalDefect: totalDef,
        runningCount: running.length,
        idleCount: idle.length,
        avgUtilization: avgUtil,
        defectRate: totalProd > 0 ? (totalDef / totalProd) * 100 : 0,
        latestDate,
      })
      setLastRefresh(new Date())
    } catch (err) {
      console.error('Factory monitor error:', err)
    } finally {
      setLoading(false)
    }
  }, [factory])

  useEffect(() => { fetchData() }, [fetchData])

  const formatNum = (n: number) => n.toLocaleString('ko-KR')
  const formatPct = (n: number) => n.toFixed(1) + '%'
  const formatDate = (d: string) => {
    const parts = d.split('-')
    return `${parts[0]}년 ${parseInt(parts[1])}월 ${parseInt(parts[2])}일`
  }
  const formatMinutes = (m: number) => {
    const h = Math.floor(m / 60)
    const min = m % 60
    return h > 0 ? `${h}시간 ${min}분` : `${min}분`
  }

  const getUtilColor = (util: number) => {
    if (util >= 95) return 'text-red-600'
    if (util >= 80) return 'text-emerald-600'
    if (util >= 60) return 'text-blue-600'
    return 'text-amber-600'
  }

  const getUtilBg = (util: number) => {
    if (util >= 95) return 'bg-red-500'
    if (util >= 80) return 'bg-emerald-500'
    if (util >= 60) return 'bg-blue-500'
    return 'bg-amber-500'
  }

  const getBarWidth = (util: number) => Math.min(util, 100)

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">공장 현황판</h1>
          <p className="text-gray-500 text-sm mt-1">
            {kpi ? `${formatDate(kpi.latestDate)} 기준` : '데이터 로딩 중...'} · {factory}
          </p>
        </div>
        <Button onClick={fetchData} variant="outline" size="sm" disabled={loading}>
          {loading ? '로딩 중...' : '새로고침'}
        </Button>
      </div>

      {loading && !kpi ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      ) : !kpi ? (
        <div className="text-center py-20 text-gray-400">데이터가 없습니다</div>
      ) : (
        <>
          {/* Factory KPI Strip */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 stagger-children">
            <Card className="kpi-card">
              <CardContent className="p-4 text-center">
                <div className="text-xs text-gray-500 mb-1">총 생산량</div>
                <div className="text-xl font-bold text-gray-900">{formatNum(kpi.totalProduction)}</div>
              </CardContent>
            </Card>
            <Card className="kpi-card">
              <CardContent className="p-4 text-center">
                <div className="text-xs text-gray-500 mb-1">가동 설비</div>
                <div className="text-xl font-bold text-emerald-600">{kpi.runningCount}대</div>
              </CardContent>
            </Card>
            <Card className="kpi-card">
              <CardContent className="p-4 text-center">
                <div className="text-xs text-gray-500 mb-1">대기 설비</div>
                <div className="text-xl font-bold text-gray-400">{kpi.idleCount}대</div>
              </CardContent>
            </Card>
            <Card className="kpi-card">
              <CardContent className="p-4 text-center">
                <div className="text-xs text-gray-500 mb-1">평균 가동률</div>
                <div className={cn('text-xl font-bold', getUtilColor(kpi.avgUtilization))}>
                  {formatPct(kpi.avgUtilization)}
                </div>
              </CardContent>
            </Card>
            <Card className="kpi-card">
              <CardContent className="p-4 text-center">
                <div className="text-xs text-gray-500 mb-1">불량률</div>
                <div className={cn('text-xl font-bold', kpi.defectRate > 2 ? 'text-red-600' : 'text-gray-700')}>
                  {formatPct(kpi.defectRate)}
                </div>
              </CardContent>
            </Card>
            <Card className="kpi-card">
              <CardContent className="p-4 text-center">
                <div className="text-xs text-gray-500 mb-1">총 불량</div>
                <div className="text-xl font-bold text-red-500">{formatNum(kpi.totalDefect)}</div>
              </CardContent>
            </Card>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs text-gray-500 px-1">
            <span className="flex items-center gap-1.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              가동 중
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-gray-300" />
              대기
            </span>
            <span className="ml-auto text-gray-400">
              마지막 갱신: {lastRefresh.toLocaleTimeString('ko-KR')}
            </span>
          </div>

          {/* Equipment Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 stagger-children">
            {equipmentList.map((eq) => (
              <Card
                key={eq.equipmentName}
                className={cn(
                  'card-hover transition-all duration-300 relative overflow-hidden',
                  eq.status === 'running'
                    ? 'border-emerald-200 bg-white'
                    : 'border-gray-200 bg-gray-50/50'
                )}
              >
                {/* Status indicator bar */}
                <div className={cn(
                  'absolute top-0 left-0 right-0 h-1',
                  eq.status === 'running' ? getUtilBg(eq.utilization) : 'bg-gray-300'
                )} />

                <CardContent className="p-4 pt-5">
                  {/* Header: name + status */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      {eq.status === 'running' ? (
                        <span className="relative flex h-3 w-3 flex-shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                        </span>
                      ) : (
                        <span className="h-3 w-3 rounded-full bg-gray-300 flex-shrink-0" />
                      )}
                      <h3 className="font-bold text-sm truncate">{eq.officialName}</h3>
                    </div>
                    {eq.status === 'running' && (
                      <span className={cn(
                        'text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0',
                        eq.utilization >= 95 ? 'bg-red-100 text-red-700' :
                        eq.utilization >= 80 ? 'bg-emerald-100 text-emerald-700' :
                        eq.utilization >= 60 ? 'bg-blue-100 text-blue-700' :
                        'bg-amber-100 text-amber-700'
                      )}>
                        {formatPct(eq.utilization)}
                      </span>
                    )}
                  </div>

                  {eq.status === 'running' ? (
                    <>
                      {/* Product info */}
                      <div className="mb-3">
                        <div className="text-xs text-gray-500 mb-0.5">생산 제품</div>
                        <div className="text-sm font-medium truncate" title={eq.productName}>{eq.productName}</div>
                      </div>

                      {/* Progress bar */}
                      <div className="mb-3">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>생산량</span>
                          <span>{formatNum(eq.producedQty)} / {eq.dailyMaxQty > 0 ? formatNum(eq.dailyMaxQty) : '-'}</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                          <div
                            className={cn('h-full rounded-full transition-all duration-1000', getUtilBg(eq.utilization))}
                            style={{ width: `${getBarWidth(eq.utilization)}%` }}
                          />
                        </div>
                      </div>

                      {/* Metrics grid */}
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="bg-gray-50 rounded px-2 py-1.5">
                          <div className="text-[10px] text-gray-400">불량</div>
                          <div className={cn('text-xs font-bold', eq.defectRate > 2 ? 'text-red-600' : 'text-gray-700')}>
                            {formatNum(eq.defectQty)}
                          </div>
                        </div>
                        <div className="bg-gray-50 rounded px-2 py-1.5">
                          <div className="text-[10px] text-gray-400">가동시간</div>
                          <div className="text-xs font-bold text-gray-700">{formatMinutes(eq.workMinutes)}</div>
                        </div>
                        <div className="bg-gray-50 rounded px-2 py-1.5">
                          <div className="text-[10px] text-gray-400">작업자</div>
                          <div className="text-xs font-bold text-gray-700">{eq.workerCount}명</div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="py-6 text-center text-gray-400 text-sm">
                      <div className="text-2xl mb-1 opacity-30">⏸</div>
                      대기 중
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Utilization Distribution Summary */}
          {equipmentList.filter(e => e.status === 'running').length > 0 && (
            <Card>
              <CardContent className="p-5">
                <h3 className="font-bold text-sm mb-4">설비 가동률 분포</h3>
                <div className="space-y-2">
                  {equipmentList
                    .filter(e => e.status === 'running')
                    .sort((a, b) => b.utilization - a.utilization)
                    .map(eq => (
                      <div key={eq.equipmentName} className="flex items-center gap-3">
                        <div className="w-28 text-xs text-gray-600 truncate flex-shrink-0" title={eq.officialName}>
                          {eq.officialName}
                        </div>
                        <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                          <div
                            className={cn('h-full rounded-full transition-all duration-1000 flex items-center justify-end pr-1.5', getUtilBg(eq.utilization))}
                            style={{ width: `${getBarWidth(eq.utilization)}%` }}
                          >
                            {eq.utilization >= 20 && (
                              <span className="text-[10px] font-bold text-white">{formatPct(eq.utilization)}</span>
                            )}
                          </div>
                        </div>
                        {eq.utilization < 20 && (
                          <span className="text-[10px] font-bold text-gray-500 w-10">{formatPct(eq.utilization)}</span>
                        )}
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
