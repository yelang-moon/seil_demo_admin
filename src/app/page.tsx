"use client"

import { useEffect, useState, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { KPICards } from "@/components/dashboard/kpi-cards"
import { DailyTrendChart } from "@/components/dashboard/daily-trend-chart"
import { EquipmentProductionChart } from "@/components/dashboard/equipment-production-chart"
import { ProductMixChart } from "@/components/dashboard/product-mix-chart"
import { EquipmentUtilizationChart } from "@/components/dashboard/equipment-utilization-chart"
import { MonthlyTrendChart } from "@/components/dashboard/monthly-trend-chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useFactory } from "@/contexts/factory-context"

type PeriodType = "1month" | "3months" | "6months"

interface DailyProduction {
  date: string
  total: number
  details: Array<{
    date: string
    product_name: string | null
    finished_qty: number
    equipment_name: string | null
  }>
}

interface EquipmentProduction {
  equipment_name: string | null
  total: number
  details: Array<{
    equipment_name: string | null
    product_name: string | null
    finished_qty: number
  }>
}

interface ProductData {
  product_name: string | null
  value: number
  details: Array<{
    date: string
    finished_qty: number
  }>
}

interface EquipmentUtil {
  equipment_name: string | null
  actual: number
  capacity: number
}

interface MonthlyData {
  month: string
  total: number
}

export default function Dashboard() {
  const { factory } = useFactory()
  const [period, setPeriod] = useState<PeriodType>("1month")
  const [latestDate, setLatestDate] = useState<string>("")
  const [kpiData, setKpiData] = useState({
    latestDayProduction: 0,
    operatingEquipment: 0,
    defectRate: 0,
    monthChange: 0,
    latestMonthLabel: "",
    prevMonthLabel: "",
  })
  const [dailyTrendData, setDailyTrendData] = useState<DailyProduction[]>([])
  const [equipmentProductionData, setEquipmentProductionData] = useState<EquipmentProduction[]>([])
  const [productMixData, setProductMixData] = useState<ProductData[]>([])
  const [equipmentUtilData, setEquipmentUtilData] = useState<EquipmentUtil[]>([])
  const [monthlyTrendData, setMonthlyTrendData] = useState<MonthlyData[]>([])
  const [loading, setLoading] = useState(true)

  const getDaysBack = (type: PeriodType): number => {
    switch (type) {
      case "1month": return 30
      case "3months": return 90
      case "6months": return 180
      default: return 30
    }
  }

  const getDateRange = (daysBack: number, baseDate: string) => {
    const end = new Date(baseDate + "T00:00:00")
    const start = new Date(end.getTime() - daysBack * 24 * 60 * 60 * 1000)
    return {
      startDate: start.toISOString().split("T")[0],
      endDate: end.toISOString().split("T")[0],
    }
  }

  // Fetch the latest date with data on mount or factory change
  useEffect(() => {
    const fetchLatestDate = async () => {
      setLatestDate("")
      try {
        const { data } = await supabase
          .from("fact_production")
          .select("production_date")
          .eq("factory", factory)
          .order("production_date", { ascending: false })
          .limit(1)
        if (data && data.length > 0) {
          setLatestDate(data[0].production_date)
        }
      } catch (error) {
        console.error("Error fetching latest date:", error)
      }
    }
    fetchLatestDate()
  }, [factory])

  // Fetch KPI data (independent of period, always based on latestDate)
  const fetchKPIData = useCallback(async () => {
    if (!latestDate) return

    try {
      const currentMonth = latestDate.substring(0, 7)
      const prevMonthDate = new Date(latestDate + "T00:00:00")
      prevMonthDate.setMonth(prevMonthDate.getMonth() - 1)
      const prevMonth = prevMonthDate.toISOString().split("T")[0].substring(0, 7)

      // Fetch latest day data
      const { data: latestDayData } = await supabase
        .from("fact_production")
        .select("finished_qty, equipment_name")
        .eq("production_date", latestDate)
        .eq("factory", factory)

      // Fetch current month data
      const { data: currentMonthData } = await supabase
        .from("fact_production")
        .select("finished_qty, produced_qty, defect_qty")
        .eq("factory", factory)
        .gte("production_date", currentMonth + "-01")
        .lte("production_date", latestDate)

      // Fetch previous month data (full month)
      const prevMonthStart = prevMonth + "-01"
      const prevMonthEnd = new Date(
        parseInt(prevMonth.substring(0, 4)),
        parseInt(prevMonth.substring(5, 7)),
        0
      ).toISOString().split("T")[0]

      const { data: prevMonthData } = await supabase
        .from("fact_production")
        .select("finished_qty")
        .eq("factory", factory)
        .gte("production_date", prevMonthStart)
        .lte("production_date", prevMonthEnd)

      // KPI 1: Latest day production
      const latestDayProduction = (latestDayData || []).reduce(
        (sum, row) => sum + (row.finished_qty || 0), 0
      )

      // KPI 2: Operating equipment on latest day
      const equipSet = new Set(
        (latestDayData || [])
          .filter(row => row.equipment_name)
          .map(row => row.equipment_name)
      )

      // KPI 3: Defect rate (current month)
      const totalProduced = (currentMonthData || []).reduce(
        (sum, row) => sum + (row.produced_qty || 0), 0
      )
      const totalDefects = (currentMonthData || []).reduce(
        (sum, row) => sum + (row.defect_qty || 0), 0
      )
      const defectRate = totalProduced > 0 ? totalDefects / totalProduced : 0

      // KPI 4: Month-over-month
      const thisMonthTotal = (currentMonthData || []).reduce(
        (sum, row) => sum + (row.finished_qty || 0), 0
      )
      const prevMonthTotal = (prevMonthData || []).reduce(
        (sum, row) => sum + (row.finished_qty || 0), 0
      )

      // Format month labels (e.g., "3월" vs "2월")
      const latestMonthNum = parseInt(currentMonth.substring(5, 7))
      const prevMonthNum = parseInt(prevMonth.substring(5, 7))

      setKpiData({
        latestDayProduction,
        operatingEquipment: equipSet.size,
        defectRate,
        monthChange: thisMonthTotal - prevMonthTotal,
        latestMonthLabel: `${latestMonthNum}월`,
        prevMonthLabel: `${prevMonthNum}월`,
      })
    } catch (error) {
      console.error("Error fetching KPI data:", error)
    }
  }, [latestDate, factory])

  // Fetch chart data (depends on period)
  const fetchChartData = useCallback(async () => {
    if (!latestDate) return
    setLoading(true)

    try {
      const daysBack = getDaysBack(period)
      const { startDate, endDate } = getDateRange(daysBack, latestDate)
      const currentMonth = latestDate.substring(0, 7)

      // Fetch production data for charts
      const { data: productionData } = await supabase
        .from("fact_production")
        .select("*")
        .eq("factory", factory)
        .gte("production_date", startDate)
        .lte("production_date", endDate)
        .order("production_date", { ascending: true })

      if (!productionData) return

      // Current month data (for equipment chart, product mix, utilization)
      const thisMonthData = productionData.filter(
        (row) => row.production_date?.substring(0, 7) === currentMonth
      )

      // Process daily trend data
      const dailyMap = new Map<string, DailyProduction>()
      productionData.forEach((row) => {
        const date = row.production_date || ""
        if (!dailyMap.has(date)) {
          dailyMap.set(date, { date, total: 0, details: [] })
        }
        const entry = dailyMap.get(date)!
        entry.total += row.finished_qty || 0
        entry.details.push({
          date,
          product_name: row.product_name,
          finished_qty: row.finished_qty || 0,
          equipment_name: row.equipment_name,
        })
      })
      setDailyTrendData(Array.from(dailyMap.values()))

      // Process equipment production data (current month only)
      const equipmentMap = new Map<string, EquipmentProduction>()
      thisMonthData.forEach((row) => {
        const equipName = row.equipment_name || "미지정"
        if (!equipmentMap.has(equipName)) {
          equipmentMap.set(equipName, { equipment_name: equipName, total: 0, details: [] })
        }
        const entry = equipmentMap.get(equipName)!
        entry.total += row.finished_qty || 0
        entry.details.push({
          equipment_name: equipName,
          product_name: row.product_name,
          finished_qty: row.finished_qty || 0,
        })
      })
      setEquipmentProductionData(Array.from(equipmentMap.values()))

      // Process product mix data (current month, top 10)
      const productMap = new Map<string, ProductData>()
      thisMonthData.forEach((row) => {
        const prodName = row.product_name || "미지정"
        if (!productMap.has(prodName)) {
          productMap.set(prodName, { product_name: prodName, value: 0, details: [] })
        }
        const entry = productMap.get(prodName)!
        entry.value += row.finished_qty || 0
        entry.details.push({
          date: row.production_date || "",
          finished_qty: row.finished_qty || 0,
        })
      })
      setProductMixData(
        Array.from(productMap.values()).sort((a, b) => b.value - a.value).slice(0, 10)
      )

      // Process equipment utilization (current month average)
      const { data: productDims } = await supabase
        .from("dim_product")
        .select("equipment_name, daily_max_qty")
        .eq("factory", factory)

      const utilMap = new Map<string, { actual: number }>()
      thisMonthData.forEach((row) => {
        const equipName = row.equipment_name || "미지정"
        if (!utilMap.has(equipName)) {
          utilMap.set(equipName, { actual: 0 })
        }
        utilMap.get(equipName)!.actual += row.finished_qty || 0
      })

      const utilData: EquipmentUtil[] = []
      utilMap.forEach((value, equipName) => {
        const maxQty = productDims?.find(
          (p) => p.equipment_name === equipName
        )?.daily_max_qty || 0
        const daysWorked = new Set(
          thisMonthData
            .filter((r) => r.equipment_name === equipName)
            .map((r) => r.production_date)
        ).size
        utilData.push({
          equipment_name: equipName,
          actual: Math.round(value.actual / Math.max(daysWorked, 1)),
          capacity: maxQty || 0,
        })
      })
      setEquipmentUtilData(utilData)

      // Process monthly trend data
      const monthlyMap = new Map<string, number>()
      productionData.forEach((row) => {
        const month = row.production_date?.substring(0, 7) || ""
        if (month) {
          monthlyMap.set(month, (monthlyMap.get(month) || 0) + (row.finished_qty || 0))
        }
      })
      setMonthlyTrendData(
        Array.from(monthlyMap.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .slice(-12)
          .map(([month, total]) => ({ month, total }))
      )
    } catch (error) {
      console.error("Error fetching chart data:", error)
    } finally {
      setLoading(false)
    }
  }, [latestDate, period, factory])

  useEffect(() => {
    if (latestDate) {
      fetchKPIData()
      fetchChartData()
    }
  }, [latestDate, fetchKPIData, fetchChartData])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">메인 대시보드</h1>
          {latestDate && (
            <p className="text-sm text-gray-500 mt-1">
              데이터 기준일: {latestDate}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">차트 기간:</label>
          <Select value={period} onValueChange={(value) => setPeriod(value as PeriodType)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1month">최근 1개월</SelectItem>
              <SelectItem value="3months">최근 3개월</SelectItem>
              <SelectItem value="6months">최근 6개월</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">데이터 로딩 중...</div>
      ) : (
        <>
          {/* KPI Cards */}
          <KPICards {...kpiData} latestDate={latestDate} />

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <DailyTrendChart data={dailyTrendData as any} />
            <EquipmentProductionChart data={equipmentProductionData as any} />
            <ProductMixChart data={productMixData as any} />
            <EquipmentUtilizationChart data={equipmentUtilData as any} />
          </div>

          {/* Full width monthly trend */}
          <div className="mt-6">
            <MonthlyTrendChart data={monthlyTrendData} />
          </div>
        </>
      )}
    </div>
  )
}
