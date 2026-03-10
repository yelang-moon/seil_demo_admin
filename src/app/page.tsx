"use client"

import { useEffect, useState, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { KPICards } from "@/components/dashboard/kpi-cards"
import { DailyTrendChart } from "@/components/dashboard/daily-trend-chart"
import { EquipmentProductionChart } from "@/components/dashboard/equipment-production-chart"
import { ProductMixChart } from "@/components/dashboard/product-mix-chart"
import { EquipmentUtilizationChart } from "@/components/dashboard/equipment-utilization-chart"
import { MonthlyTrendChart } from "@/components/dashboard/monthly-trend-chart"
import { Button } from "@/components/ui/button"
import { useFactory } from "@/contexts/factory-context"

type PresetType = "1month" | "3months" | "6months" | "custom"

const PRESET_LABELS: Record<string, string> = {
  "1month": "1개월",
  "3months": "3개월",
  "6months": "6개월",
}

const PRESET_DAYS: Record<string, number> = {
  "1month": 30,
  "3months": 90,
  "6months": 180,
}

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

interface WeeklyData {
  week: string
  total: number
}

// KPI detail interfaces
interface ProductionDetail {
  product_name: string | null
  equipment_name: string | null
  finished_qty: number
}

interface EquipmentDetail {
  equipment_name: string
  product_name: string | null
  finished_qty: number
}

interface WorkerDetail {
  name: string
  role: string
  equipment_name: string | null
}

export default function Dashboard() {
  const { factory } = useFactory()
  const [activePreset, setActivePreset] = useState<PresetType>("1month")
  const [chartStartDate, setChartStartDate] = useState<string>("")
  const [chartEndDate, setChartEndDate] = useState<string>("")
  const [latestDate, setLatestDate] = useState<string>("")
  const [kpiData, setKpiData] = useState({
    periodProduction: 0,
    operatingEquipment: 0,
    defectRate: 0,
    yearChange: 0,
    periodLabel: "",
    lastYearPeriodLabel: "",
    defectPeriodLabel: "",
  })
  const [dailyTrendData, setDailyTrendData] = useState<DailyProduction[]>([])
  const [equipmentProductionData, setEquipmentProductionData] = useState<EquipmentProduction[]>([])
  const [productMixData, setProductMixData] = useState<ProductData[]>([])
  const [equipmentUtilData, setEquipmentUtilData] = useState<EquipmentUtil[]>([])
  const [weeklyTrendData, setWeeklyTrendData] = useState<WeeklyData[]>([])
  const [loading, setLoading] = useState(true)

  // KPI detail data
  const [productionDetails, setProductionDetails] = useState<ProductionDetail[]>([])
  const [equipmentDetails, setEquipmentDetails] = useState<EquipmentDetail[]>([])
  const [workerDetails, setWorkerDetails] = useState<WorkerDetail[]>([])
  const [totalEquipmentCount, setTotalEquipmentCount] = useState(0)

  const applyPreset = (preset: PresetType, baseDate: string) => {
    if (preset === "custom") return
    const days = PRESET_DAYS[preset] || 30
    const end = new Date(baseDate + "T00:00:00")
    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000)
    setChartStartDate(start.toISOString().split("T")[0])
    setChartEndDate(baseDate)
    setActivePreset(preset)
  }

  const handlePresetClick = (preset: PresetType) => {
    if (latestDate) applyPreset(preset, latestDate)
  }

  const handleCustomDateChange = (type: "start" | "end", value: string) => {
    if (type === "start") setChartStartDate(value)
    else setChartEndDate(value)
    setActivePreset("custom")
  }

  const getChartDaysBack = (): number => {
    if (!chartStartDate || !chartEndDate) return 30
    const start = new Date(chartStartDate + "T00:00:00")
    const end = new Date(chartEndDate + "T00:00:00")
    return Math.max(1, Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)))
  }

  // Helper: get ISO week string like "2024-W03"
  const getWeekString = (dateStr: string): string => {
    const d = new Date(dateStr + "T00:00:00")
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
    const week1 = new Date(d.getFullYear(), 0, 4)
    const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
    const year = d.getFullYear()
    return `${year}-W${String(weekNum).padStart(2, "0")}`
  }

  // Format week string for display
  const formatWeekLabel = (weekStr: string): string => {
    const parts = weekStr.split("-W")
    const year = parts[0].slice(2)
    const week = parseInt(parts[1])
    return `${year}년 ${week}주`
  }

  // Format date as MM.DD
  const formatShortDate = (dateStr: string) => {
    return dateStr.slice(5).replace("-", ".")
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
          const latest = data[0].production_date
          setLatestDate(latest)
          // Set default chart dates (1 month preset)
          applyPreset("1month", latest)
        }
      } catch (error) {
        console.error("Error fetching latest date:", error)
      }
    }
    fetchLatestDate()
  }, [factory])

  // Fetch KPI data
  const fetchKPIData = useCallback(async () => {
    if (!chartStartDate || !chartEndDate) return

    try {
      // Use chart period for KPI calculations
      const periodStartStr = chartStartDate
      const periodEndStr = chartEndDate

      // Last year same period (1년 전 동기간)
      const periodEnd = new Date(chartEndDate + "T00:00:00")
      const periodStart = new Date(chartStartDate + "T00:00:00")
      const lastYearEnd = new Date(periodEnd)
      lastYearEnd.setFullYear(lastYearEnd.getFullYear() - 1)
      const lastYearStart = new Date(periodStart)
      lastYearStart.setFullYear(lastYearStart.getFullYear() - 1)
      const lastYearStartStr = lastYearStart.toISOString().split("T")[0]
      const lastYearEndStr = lastYearEnd.toISOString().split("T")[0]

      // Fetch total equipment count
      const { data: allEquipment } = await supabase
        .from("dim_equipment")
        .select("equipment_id")
        .eq("factory", factory)

      setTotalEquipmentCount(allEquipment?.length || 0)

      // Fetch period data - used for all KPIs
      const { data: periodData } = await supabase
        .from("fact_production")
        .select("finished_qty, produced_qty, defect_qty, equipment_name, product_name, tech_worker, pack_workers")
        .eq("factory", factory)
        .gte("production_date", periodStartStr)
        .lte("production_date", periodEndStr)

      // Fetch last year same period data
      const { data: lastYearData } = await supabase
        .from("fact_production")
        .select("finished_qty")
        .eq("factory", factory)
        .gte("production_date", lastYearStartStr)
        .lte("production_date", lastYearEndStr)

      // KPI 1: Period total production (last 30 days)
      const periodProduction = (periodData || []).reduce(
        (sum, row) => sum + (row.finished_qty || 0), 0
      )

      // Production details for popup (period-based aggregation)
      const prodDetailMap = new Map<string, { product_name: string | null; equipment_name: string | null; finished_qty: number }>()
      ;(periodData || []).forEach(row => {
        const key = `${row.equipment_name}___${row.product_name}`
        if (!prodDetailMap.has(key)) {
          prodDetailMap.set(key, { product_name: row.product_name, equipment_name: row.equipment_name, finished_qty: 0 })
        }
        prodDetailMap.get(key)!.finished_qty += row.finished_qty || 0
      })
      setProductionDetails(Array.from(prodDetailMap.values()))

      // KPI 2: Operating equipment (within entire 30-day period)
      const periodEquipSet = new Set(
        (periodData || [])
          .filter(row => row.equipment_name && (row.finished_qty || 0) > 0)
          .map(row => row.equipment_name)
      )

      // Equipment details for popup (aggregate all period data)
      const equipMap = new Map<string, { product_name: string | null; finished_qty: number }>()
      ;(periodData || []).forEach(row => {
        if (row.equipment_name && (row.finished_qty || 0) > 0) {
          if (!equipMap.has(row.equipment_name)) {
            equipMap.set(row.equipment_name, { product_name: null, finished_qty: 0 })
          }
          const entry = equipMap.get(row.equipment_name)!
          entry.finished_qty += row.finished_qty || 0
        }
      })
      const eDetails: EquipmentDetail[] = []
      equipMap.forEach((val, key) => {
        eDetails.push({ equipment_name: key, product_name: val.product_name, finished_qty: val.finished_qty })
      })
      setEquipmentDetails(eDetails)

      // Worker details for popup (from period data)
      const workerMap = new Map<string, { role: string; equipment_name: string | null }>()
      ;(periodData || []).forEach(row => {
        if (row.tech_worker) {
          workerMap.set(row.tech_worker, { role: "기술자", equipment_name: row.equipment_name })
        }
        if (row.pack_workers) {
          row.pack_workers.split(/[,/]/).forEach((w: string) => {
            const name = w.trim()
            if (name) workerMap.set(name, { role: "포장", equipment_name: row.equipment_name })
          })
        }
      })
      const wDetails: WorkerDetail[] = []
      workerMap.forEach((val, key) => {
        wDetails.push({ name: key, role: val.role, equipment_name: val.equipment_name })
      })
      setWorkerDetails(wDetails)

      // KPI 3: Defect rate (period)
      const totalProduced = (periodData || []).reduce((sum, row) => sum + (row.produced_qty || 0), 0)
      const totalDefects = (periodData || []).reduce((sum, row) => sum + (row.defect_qty || 0), 0)
      const defectRate = totalProduced > 0 ? totalDefects / totalProduced : 0

      // KPI 4: Year-over-year change (last 30 days vs same period last year)
      const thisPeriodTotal = (periodData || []).reduce((sum, row) => sum + (row.finished_qty || 0), 0)
      const lastYearTotal = (lastYearData || []).reduce((sum, row) => sum + (row.finished_qty || 0), 0)

      // Period labels
      const periodLabel = `${formatShortDate(periodStartStr)} ~ ${formatShortDate(periodEndStr)}`
      const lastYearPeriodLabel = `${formatShortDate(lastYearStartStr)} ~ ${formatShortDate(lastYearEndStr)}`

      setKpiData({
        periodProduction,
        operatingEquipment: periodEquipSet.size,
        defectRate,
        yearChange: thisPeriodTotal - lastYearTotal,
        periodLabel,
        lastYearPeriodLabel,
        defectPeriodLabel: periodLabel,
      })
    } catch (error) {
      console.error("Error fetching KPI data:", error)
    }
  }, [chartStartDate, chartEndDate, factory])

  // Fetch chart data
  const fetchChartData = useCallback(async () => {
    if (!chartStartDate || !chartEndDate) return
    setLoading(true)

    try {
      const startDate = chartStartDate
      const endDate = chartEndDate
      const daysBack = getChartDaysBack()

      const { data: productionData } = await supabase
        .from("fact_production")
        .select("*")
        .eq("factory", factory)
        .gte("production_date", startDate)
        .lte("production_date", endDate)
        .order("production_date", { ascending: true })

      if (!productionData) return

      // Daily trend
      const dailyMap = new Map<string, DailyProduction>()
      productionData.forEach((row) => {
        const date = row.production_date || ""
        if (!dailyMap.has(date)) dailyMap.set(date, { date, total: 0, details: [] })
        const entry = dailyMap.get(date)!
        entry.total += row.finished_qty || 0
        entry.details.push({ date, product_name: row.product_name, finished_qty: row.finished_qty || 0, equipment_name: row.equipment_name })
      })
      setDailyTrendData(Array.from(dailyMap.values()))

      // Equipment production (uses full period data)
      const equipmentMap = new Map<string, EquipmentProduction>()
      productionData.forEach((row) => {
        const equipName = row.equipment_name || "미지정"
        if (!equipmentMap.has(equipName)) equipmentMap.set(equipName, { equipment_name: equipName, total: 0, details: [] })
        const entry = equipmentMap.get(equipName)!
        entry.total += row.finished_qty || 0
        entry.details.push({ equipment_name: equipName, product_name: row.product_name, finished_qty: row.finished_qty || 0 })
      })
      setEquipmentProductionData(Array.from(equipmentMap.values()))

      // Product mix (top 10, uses full period data)
      const productMap = new Map<string, ProductData>()
      productionData.forEach((row) => {
        const prodName = row.product_name || "미지정"
        if (!productMap.has(prodName)) productMap.set(prodName, { product_name: prodName, value: 0, details: [] })
        const entry = productMap.get(prodName)!
        entry.value += row.finished_qty || 0
        entry.details.push({ date: row.production_date || "", finished_qty: row.finished_qty || 0 })
      })
      setProductMixData(Array.from(productMap.values()).sort((a, b) => b.value - a.value).slice(0, 10))

      // Equipment utilization (uses full period data)
      const { data: productDims } = await supabase
        .from("dim_product")
        .select("equipment_name, daily_max_qty")
        .eq("factory", factory)

      // Equipment utilization: totalActual / (daily_max_qty * periodDays)
      const periodDays = daysBack
      const utilMap = new Map<string, { actual: number }>()
      productionData.forEach((row) => {
        const equipName = row.equipment_name || "미지정"
        if (!utilMap.has(equipName)) utilMap.set(equipName, { actual: 0 })
        utilMap.get(equipName)!.actual += row.finished_qty || 0
      })

      const utilData: EquipmentUtil[] = []
      utilMap.forEach((value, equipName) => {
        const maxQty = productDims?.find((p) => p.equipment_name === equipName)?.daily_max_qty || 0
        // capacity = daily_max_qty * period days
        const totalCapacity = maxQty * periodDays
        utilData.push({ equipment_name: equipName, actual: value.actual, capacity: totalCapacity })
      })
      setEquipmentUtilData(utilData)

      // Weekly trend (instead of monthly)
      const weeklyMap = new Map<string, number>()
      productionData.forEach((row) => {
        const date = row.production_date
        if (date) {
          const weekKey = getWeekString(date)
          weeklyMap.set(weekKey, (weeklyMap.get(weekKey) || 0) + (row.finished_qty || 0))
        }
      })
      setWeeklyTrendData(
        Array.from(weeklyMap.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([week, total]) => ({ week: formatWeekLabel(week), total }))
      )
    } catch (error) {
      console.error("Error fetching chart data:", error)
    } finally {
      setLoading(false)
    }
  }, [chartStartDate, chartEndDate, factory])

  useEffect(() => {
    if (chartStartDate && chartEndDate) fetchKPIData()
  }, [chartStartDate, chartEndDate, fetchKPIData])

  useEffect(() => {
    if (chartStartDate && chartEndDate) fetchChartData()
  }, [chartStartDate, chartEndDate, fetchChartData])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">메인 대시보드</h1>
            {chartStartDate && chartEndDate && (
              <p className="text-sm text-gray-500 mt-1">
                데이터 기준: {chartStartDate} ~ {chartEndDate}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {Object.entries(PRESET_LABELS).map(([key, label]) => (
            <Button
              key={key}
              size="sm"
              variant={activePreset === key ? "default" : "outline"}
              onClick={() => handlePresetClick(key as PresetType)}
              className="h-8 px-3 text-xs"
            >
              {label}
            </Button>
          ))}
          <div className="flex items-center gap-1 ml-2">
            <input
              type="date"
              value={chartStartDate}
              onChange={(e) => handleCustomDateChange("start", e.target.value)}
              className="px-2 py-1 border border-gray-300 rounded text-xs h-8 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <span className="text-gray-400 text-xs">~</span>
            <input
              type="date"
              value={chartEndDate}
              onChange={(e) => handleCustomDateChange("end", e.target.value)}
              className="px-2 py-1 border border-gray-300 rounded text-xs h-8 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-500">데이터 로딩 중...</div>
      ) : (
        <>
          <KPICards
            {...kpiData}
            latestDate={latestDate}
            productionDetails={productionDetails}
            equipmentDetails={equipmentDetails}
            workerDetails={workerDetails}
            totalEquipmentCount={totalEquipmentCount}
            factory={factory}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <DailyTrendChart data={dailyTrendData as any} />
            <EquipmentProductionChart data={equipmentProductionData as any} />
            <ProductMixChart data={productMixData as any} />
            <EquipmentUtilizationChart data={equipmentUtilData as any} />
          </div>

          <div className="mt-6">
            <MonthlyTrendChart data={weeklyTrendData} />
          </div>
        </>
      )}
    </div>
  )
}
