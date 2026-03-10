"use client"

import { useEffect, useState } from "react"
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
  const [period, setPeriod] = useState<PeriodType>("1month")
  const [latestDate, setLatestDate] = useState<string>("")
  const [kpiData, setKpiData] = useState({
    todayProduction: 0,
    operatingEquipment: 0,
    defectRate: 0,
    monthChange: 0,
  })
  const [dailyTrendData, setDailyTrendData] = useState<DailyProduction[]>([])
  const [equipmentProductionData, setEquipmentProductionData] = useState<
    EquipmentProduction[]
  >([])
  const [productMixData, setProductMixData] = useState<ProductData[]>([])
  const [equipmentUtilData, setEquipmentUtilData] = useState<EquipmentUtil[]>(
    []
  )
  const [monthlyTrendData, setMonthlyTrendData] = useState<MonthlyData[]>([])
  const [loading, setLoading] = useState(true)

  const getDaysBack = (type: PeriodType): number => {
    switch (type) {
      case "1month":
        return 30
      case "3months":
        return 90
      case "6months":
        return 180
      default:
        return 30
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

  // Fetch the latest date with data on mount
  useEffect(() => {
    const fetchLatestDate = async () => {
      try {
        const { data } = await supabase
          .from("fact_production")
          .select("production_date")
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
  }, [])

  const fetchData = async () => {
    if (!latestDate) return
    setLoading(true)
    try {
      const daysBack = getDaysBack(period)
      const { startDate, endDate } = getDateRange(daysBack, latestDate)
      // Use latestDate as the reference "today" for KPI calculations
      const today = latestDate

      // Fetch production data
      const { data: productionData } = await supabase
        .from("fact_production")
        .select("*")
        .gte("production_date", startDate)
        .lte("production_date", endDate)
        .order("production_date", { ascending: true })

      if (!productionData) return

      // Calculate KPI: Latest day's total production
      const todayData = productionData.filter(
        (row) => row.production_date === today
      )
      const todayTotal = todayData.reduce((sum, row) => sum + (row.finished_qty || 0), 0)

      // Calculate KPI: Operating equipment count on latest day
      const operatingEquipSet = new Set(
        todayData
          .filter((row) => row.equipment_name)
          .map((row) => row.equipment_name)
      )
      const operatingEquipCount = operatingEquipSet.size

      // Calculate KPI: Defect rate for the month of latest date
      const currentMonth = today.substring(0, 7)
      const thisMonthData = productionData.filter(
        (row) => row.production_date?.substring(0, 7) === currentMonth
      )
      const totalProduced = thisMonthData.reduce(
        (sum, row) => sum + (row.produced_qty || 0),
        0
      )
      const totalDefects = thisMonthData.reduce(
        (sum, row) => sum + (row.defect_qty || 0),
        0
      )
      const defectRate =
        totalProduced > 0 ? totalDefects / totalProduced : 0

      // Calculate KPI: Month-over-month change
      const lastMonth = new Date(today + "T00:00:00")
      lastMonth.setMonth(lastMonth.getMonth() - 1)
      const lastMonthStr = lastMonth.toISOString().split("T")[0].substring(0, 7)
      const lastMonthData = productionData.filter(
        (row) => row.production_date?.substring(0, 7) === lastMonthStr
      )
      const lastMonthTotal = lastMonthData.reduce(
        (sum, row) => sum + (row.finished_qty || 0),
        0
      )
      const thisMonthTotal = thisMonthData.reduce(
        (sum, row) => sum + (row.finished_qty || 0),
        0
      )
      const monthChange = thisMonthTotal - lastMonthTotal

      setKpiData({
        todayProduction: todayTotal,
        operatingEquipment: operatingEquipCount,
        defectRate,
        monthChange,
      })

      // Process daily trend data
      const dailyMap = new Map<string, DailyProduction>()
      productionData.forEach((row) => {
        const date = row.production_date || ""
        if (!dailyMap.has(date)) {
          dailyMap.set(date, {
            date,
            total: 0,
            details: [],
          })
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
          equipmentMap.set(equipName, {
            equipment_name: equipName,
            total: 0,
            details: [],
          })
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
          productMap.set(prodName, {
            product_name: prodName,
            value: 0,
            details: [],
          })
        }
        const entry = productMap.get(prodName)!
        entry.value += row.finished_qty || 0
        entry.details.push({
          date: row.production_date || "",
          finished_qty: row.finished_qty || 0,
        })
      })
      const sortedProducts = Array.from(productMap.values())
        .sort((a, b) => b.value - a.value)
        .slice(0, 10)
      setProductMixData(sortedProducts)

      // Process equipment utilization (current month average)
      const { data: productDims } = await supabase
        .from("dim_product")
        .select("equipment_name, daily_max_qty")

      const utilMap = new Map<string, { actual: number; days: number }>()
      thisMonthData.forEach((row) => {
        const equipName = row.equipment_name || "미지정"
        if (!utilMap.has(equipName)) {
          utilMap.set(equipName, { actual: 0, days: 0 })
        }
        const entry = utilMap.get(equipName)!
        entry.actual += row.finished_qty || 0
      })

      const utilData: EquipmentUtil[] = []
      utilMap.forEach((value, equipName) => {
        const maxQty = productDims?.find(
          (p) => p.equipment_name === equipName
        )?.daily_max_qty || 0
        const daysInMonth = thisMonthData.filter(
          (r) => r.equipment_name === equipName
        ).length
        utilData.push({
          equipment_name: equipName,
          actual: Math.round(value.actual / Math.max(daysInMonth, 1)),
          capacity: maxQty || 0,
        })
      })
      setEquipmentUtilData(utilData)

      // Process monthly trend data (last 12 months)
      const monthlyMap = new Map<string, number>()
      productionData.forEach((row) => {
        const month = row.production_date?.substring(0, 7) || ""
        if (month) {
          monthlyMap.set(
            month,
            (monthlyMap.get(month) || 0) + (row.finished_qty || 0)
          )
        }
      })
      const sortedMonths = Array.from(monthlyMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-12)
      setMonthlyTrendData(
        sortedMonths.map(([month, total]) => ({ month, total }))
      )
    } catch (error) {
      console.error("Error fetching data:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (latestDate) {
      fetchData()
    }
  }, [period, latestDate])

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">메인 대시보드</h1>
            {latestDate && (
              <p className="text-sm text-gray-500 mt-1">
                기준일: {latestDate}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">기간:</label>
            <Select value={period} onValueChange={(value) => setPeriod(value as PeriodType)}>
              <SelectTrigger className="w-32">
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
            <KPICards {...kpiData} />

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
    </div>
  )
}
