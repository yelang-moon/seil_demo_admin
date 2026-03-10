"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatNumber, formatPercent } from "@/lib/utils"
import { DetailPopup } from "@/components/common/detail-popup"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { supabase } from "@/lib/supabase"

interface KPICardsProps {
  periodProduction: number
  operatingEquipment: number
  defectRate: number
  yearChange: number
  periodLabel: string
  lastYearPeriodLabel: string
  defectPeriodLabel: string
  latestDate: string
  productionDetails: Array<{
    product_name: string | null
    equipment_name: string | null
    finished_qty: number
  }>
  equipmentDetails: Array<{
    equipment_name: string
    product_name: string | null
    finished_qty: number
  }>
  workerDetails: Array<{
    name: string
    role: string
    equipment_name: string | null
  }>
  totalEquipmentCount: number
  factory: string
}

type EquipPopupPeriod = "1month" | "3months"

export function KPICards({
  periodProduction,
  operatingEquipment,
  defectRate,
  yearChange,
  periodLabel,
  lastYearPeriodLabel,
  defectPeriodLabel,
  latestDate,
  productionDetails,
  equipmentDetails,
  workerDetails,
  totalEquipmentCount,
  factory,
}: KPICardsProps) {
  const isPositiveChange = yearChange >= 0

  const [productionPopup, setProductionPopup] = useState(false)
  const [equipmentPopup, setEquipmentPopup] = useState(false)
  const [workerPopup, setWorkerPopup] = useState(false)
  const [equipUtilPopup, setEquipUtilPopup] = useState(false)
  const [equipUtilPeriod, setEquipUtilPeriod] = useState<EquipPopupPeriod>("1month")
  const [equipUtilChartData, setEquipUtilChartData] = useState<Array<{ date: string; rate: number }>>([])
  const [equipUtilLoading, setEquipUtilLoading] = useState(false)

  const fetchEquipUtilData = useCallback(async () => {
    if (!latestDate || !equipUtilPopup) return
    setEquipUtilLoading(true)
    try {
      const days = equipUtilPeriod === "1month" ? 30 : 90
      const end = new Date(latestDate + "T00:00:00")
      const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000)
      const startStr = start.toISOString().split("T")[0]

      const [prodRes, equipRes, specRes] = await Promise.all([
        supabase
          .from("fact_production")
          .select("production_date, equipment_name, finished_qty")
          .eq("factory", factory)
          .gte("production_date", startStr)
          .lte("production_date", latestDate),
        supabase
          .from("dim_equipment")
          .select("equipment_id, name_legacy")
          .eq("factory", factory),
        supabase
          .from("dim_product")
          .select("equipment_name, daily_max_qty")
          .eq("factory", factory),
      ])

      const productionData = prodRes.data || []
      const allEquipment = equipRes.data || []
      const productSpecs = specRes.data || []

      const equipCapacity = new Map<string, number>()
      allEquipment.forEach(eq => {
        const spec = productSpecs.find(s => s.equipment_name === eq.name_legacy)
        if (spec?.daily_max_qty) {
          equipCapacity.set(eq.name_legacy || "", spec.daily_max_qty)
        }
      })
      const totalDailyCapacity = Array.from(equipCapacity.values()).reduce((s, v) => s + v, 0)

      const dailyMap = new Map<string, number>()
      productionData.forEach(row => {
        const date = row.production_date || ""
        dailyMap.set(date, (dailyMap.get(date) || 0) + (row.finished_qty || 0))
      })

      const chartData = Array.from(dailyMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, total]) => ({
          date: date.slice(5),
          rate: totalDailyCapacity > 0 ? Math.round((total / totalDailyCapacity) * 100) : 0,
        }))

      setEquipUtilChartData(chartData)
    } catch (err) {
      console.error("Error fetching equipment utilization:", err)
    } finally {
      setEquipUtilLoading(false)
    }
  }, [latestDate, equipUtilPeriod, equipUtilPopup, factory])

  useEffect(() => {
    fetchEquipUtilData()
  }, [fetchEquipUtilData])

  // Calculate year change percentage
  const yearChangePercent = yearChange !== 0 && lastYearPeriodLabel
    ? (() => {
        // We don't have lastYearTotal directly, but we can derive it
        // yearChange = thisTotal - lastYearTotal => lastYearTotal = thisTotal - yearChange
        // We'd need thisTotal which we don't have, so just show absolute
        return null
      })()
    : null

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setProductionPopup(true)}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">기간내 생산량</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(periodProduction)}</div>
            <p className="text-xs text-gray-500 mt-1">{periodLabel}</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setEquipmentPopup(true)}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">가동 설비 수</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {operatingEquipment}
              <span className="text-sm text-gray-400 font-normal ml-1">/ {totalEquipmentCount}</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">{periodLabel} 기간 내</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setWorkerPopup(true)}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">불량률</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPercent(defectRate)}</div>
            <p className="text-xs text-gray-500 mt-1">{defectPeriodLabel}</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setEquipUtilPopup(true)}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">작년 대비 증감</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${isPositiveChange ? "text-green-600" : "text-red-600"}`}>
              {isPositiveChange ? "+" : ""}{formatNumber(yearChange)}
            </div>
            <p className="text-xs text-gray-500 mt-1">직전 30일 vs 작년 동기간</p>
          </CardContent>
        </Card>
      </div>

      {/* 총생산량 팝업 */}
      <DetailPopup
        open={productionPopup}
        onOpenChange={setProductionPopup}
        title={`${periodLabel} 생산량 상세`}
        columns={[
          { key: "equipment_name", label: "설비명" },
          { key: "product_name", label: "제품명" },
          { key: "finished_qty", label: "생산량" },
        ]}
        data={productionDetails.map(d => ({
          equipment_name: d.equipment_name || "-",
          product_name: d.product_name || "-",
          finished_qty: formatNumber(d.finished_qty),
        }))}
      />

      {/* 가동 설비 팝업 */}
      <DetailPopup
        open={equipmentPopup}
        onOpenChange={setEquipmentPopup}
        title={`${periodLabel} 가동 설비 현황`}
        columns={[
          { key: "equipment_name", label: "설비명" },
          { key: "finished_qty", label: "기간 총 생산량" },
        ]}
        data={equipmentDetails.map(d => ({
          equipment_name: d.equipment_name,
          finished_qty: formatNumber(d.finished_qty),
        }))}
      />

      {/* 작업인원 팝업 */}
      <DetailPopup
        open={workerPopup}
        onOpenChange={setWorkerPopup}
        title={`${periodLabel} 작업 인원`}
        columns={[
          { key: "name", label: "이름" },
          { key: "role", label: "역할" },
          { key: "equipment_name", label: "담당 설비" },
        ]}
        data={workerDetails.map(d => ({
          name: d.name,
          role: d.role,
          equipment_name: d.equipment_name || "-",
        }))}
      />

      {/* 설비 가동율 차트 팝업 */}
      <Dialog open={equipUtilPopup} onOpenChange={setEquipUtilPopup}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-4">
              <span>일별 설비 가동율 추이</span>
              <Select value={equipUtilPeriod} onValueChange={(v) => setEquipUtilPeriod(v as EquipPopupPeriod)}>
                <SelectTrigger className="w-28 h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1month">1개월</SelectItem>
                  <SelectItem value="3months">3개월</SelectItem>
                </SelectContent>
              </Select>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            {equipUtilLoading ? (
              <div className="text-center py-12 text-gray-500">로딩 중...</div>
            ) : equipUtilChartData.length === 0 ? (
              <div className="text-center py-12 text-gray-500">데이터가 없습니다</div>
            ) : (
              <div className="w-full h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={equipUtilChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis domain={[0, 120]} tickFormatter={(v) => `${v}%`} />
                    <Tooltip
                      formatter={(value) => [`${value}%`, "가동율"]}
                      contentStyle={{ backgroundColor: "#f3f4f6", border: "1px solid #e5e7eb" }}
                    />
                    <Bar dataKey="rate" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
