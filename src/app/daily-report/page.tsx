"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { EquipmentCard } from "@/components/dashboard/equipment-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatNumber } from "@/lib/utils"
import { useFactory } from "@/contexts/factory-context"

interface DailyReportData {
  selected_date: string
  total_production: number
  operating_equipment: number
  worker_count: number
  equipmentData: Array<{
    equipment_id: number
    name_official: string | null
    name_short: string | null
    production?: {
      product_name: string | null
      finished_qty: number
      tech_worker: string | null
      pack_workers: string | null
      work_start_hhmm: string | null
      work_end_hhmm: string | null
      work_minutes: number | null
    }
    productSpec?: {
      daily_max_qty: number | null
    }
  }>
  note: string | null
}

export default function DailyReport() {
  const { factory } = useFactory()
  const [selectedDate, setSelectedDate] = useState<string>("")
  const [reportData, setReportData] = useState<DailyReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [latestDate, setLatestDate] = useState<string>("")

  // Get latest date with data
  useEffect(() => {
    const fetchLatestDate = async () => {
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
          setSelectedDate(latest)
        } else {
          setLatestDate("")
          setSelectedDate("")
          setReportData(null)
        }
      } catch (error) {
        console.error("Error fetching latest date:", error)
      }
    }
    fetchLatestDate()
  }, [factory])

  // Fetch report data when date changes
  useEffect(() => {
    if (!selectedDate) return

    const fetchReportData = async () => {
      setLoading(true)
      try {
        // Get all equipment
        const { data: allEquipment } = await supabase
          .from("dim_equipment")
          .select("*")
          .eq("factory", factory)
          .order("equipment_id")

        if (!allEquipment) return

        // Get production data for selected date
        const { data: productionData } = await supabase
          .from("fact_production")
          .select("*")
          .eq("production_date", selectedDate)
          .eq("factory", factory)

        // Get product specs
        const { data: productSpecs } = await supabase
          .from("dim_product")
          .select("equipment_name, daily_max_qty")
          .eq("factory", factory)

        // Map production data by equipment
        const productionByEquip = new Map()
        productionData?.forEach((prod) => {
          if (prod.equipment_name && !productionByEquip.has(prod.equipment_name)) {
            productionByEquip.set(prod.equipment_name, prod)
          }
        })

        // Get all worker count
        const workerCount = new Set<string>()
        productionData?.forEach((prod) => {
          if (prod.tech_worker) workerCount.add(prod.tech_worker)
          if (prod.pack_workers) {
            prod.pack_workers.split(/[,/]/).forEach((w: string) => {
              if (w.trim()) workerCount.add(w.trim())
            })
          }
        })

        // Get note from first matching row
        const noteData = productionData?.[0]?.note || null

        // Calculate totals and build equipment data
        let totalProduction = 0
        let operatingCount = 0
        const equipmentData = allEquipment.map((equip) => {
          // fact_production uses legacy names (e.g. "HRP-8온스")
          const legacyName = equip.name_legacy || ""
          const prod = productionByEquip.get(legacyName)
          if (prod) {
            totalProduction += prod.finished_qty || 0
            operatingCount += 1
          }

          const spec = productSpecs?.find(
            (p) => p.equipment_name === legacyName
          )

          return {
            equipment_id: equip.equipment_id,
            name_official: equip.name_official,
            name_short: equip.name_short,
            production: prod
              ? {
                  product_name: prod.product_name,
                  finished_qty: prod.finished_qty || 0,
                  tech_worker: prod.tech_worker,
                  pack_workers: prod.pack_workers,
                  work_start_hhmm: prod.work_start_hhmm,
                  work_end_hhmm: prod.work_end_hhmm,
                  work_minutes: prod.work_minutes,
                }
              : undefined,
            productSpec: spec
              ? {
                  daily_max_qty: spec.daily_max_qty,
                }
              : undefined,
          }
        })

        setReportData({
          selected_date: selectedDate,
          total_production: totalProduction,
          operating_equipment: operatingCount,
          worker_count: workerCount.size,
          equipmentData,
          note: noteData,
        })
      } catch (error) {
        console.error("Error fetching report data:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchReportData()
  }, [selectedDate, factory])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">일보 (일일보고)</h1>
      </div>

      {/* Date Picker */}
      <div className="flex items-center gap-4">
        <label className="text-sm font-medium text-gray-700">날짜:</label>
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">데이터 로딩 중...</div>
        ) : reportData ? (
          <>
            {/* Summary Bar */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-sm text-gray-600 mb-2">총 생산량</p>
                    <p className="text-3xl font-bold text-blue-600">
                      {formatNumber(reportData.total_production)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">개</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-sm text-gray-600 mb-2">가동 설비 수</p>
                    <p className="text-3xl font-bold text-purple-600">
                      {reportData.operating_equipment}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">대</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-sm text-gray-600 mb-2">작업 인원</p>
                    <p className="text-3xl font-bold text-green-600">
                      {reportData.worker_count}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">명</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Equipment Cards Grid */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">설비 현황</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {reportData.equipmentData.map((equip) => (
                  <EquipmentCard
                    key={equip.equipment_id}
                    equipment={{
                      name_official: equip.name_official,
                      name_short: equip.name_short,
                    }}
                    production={equip.production}
                    productSpec={equip.productSpec}
                  />
                ))}
              </div>
            </div>

            {/* Notes Section */}
            {reportData.note && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">비고</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {reportData.note}
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          <div className="text-center py-12 text-gray-500">
            데이터를 선택해주세요
          </div>
        )}
    </div>
  )
}
