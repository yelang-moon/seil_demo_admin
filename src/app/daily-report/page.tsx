"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { EquipmentCard } from "@/components/dashboard/equipment-card"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DetailPopup } from "@/components/common/detail-popup"
import { formatNumber } from "@/lib/utils"
import { useFactory } from "@/contexts/factory-context"

interface DailyReportData {
  selected_date: string
  total_production: number
  operating_equipment: number
  total_equipment: number
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
  note: string | null
}

export default function DailyReport() {
  const { factory } = useFactory()
  const [selectedDate, setSelectedDate] = useState<string>("")
  const [reportData, setReportData] = useState<DailyReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [latestDate, setLatestDate] = useState<string>("")

  const [productionPopup, setProductionPopup] = useState(false)
  const [equipmentPopup, setEquipmentPopup] = useState(false)
  const [workerPopup, setWorkerPopup] = useState(false)

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

  useEffect(() => {
    if (!selectedDate) return

    const fetchReportData = async () => {
      setLoading(true)
      try {
        const { data: allEquipment } = await supabase
          .from("dim_equipment")
          .select("*")
          .eq("factory", factory)
          .order("equipment_id")

        if (!allEquipment) return

        const { data: productionData } = await supabase
          .from("fact_production")
          .select("*")
          .eq("production_date", selectedDate)
          .eq("factory", factory)

        const { data: productSpecs } = await supabase
          .from("dim_product")
          .select("equipment_name, daily_max_qty")
          .eq("factory", factory)

        const productionByEquip = new Map()
        productionData?.forEach((prod) => {
          if (prod.equipment_name && !productionByEquip.has(prod.equipment_name)) {
            productionByEquip.set(prod.equipment_name, prod)
          }
        })

        const workerSet = new Set<string>()
        const workerDetailsArr: DailyReportData["workerDetails"] = []
        const workerTracker = new Map<string, { role: string; equipment_name: string | null }>()

        productionData?.forEach((prod) => {
          if (prod.tech_worker) {
            workerSet.add(prod.tech_worker)
            workerTracker.set(prod.tech_worker, { role: "기술자", equipment_name: prod.equipment_name })
          }
          if (prod.pack_workers) {
            prod.pack_workers.split(/[,/]/).forEach((w: string) => {
              const name = w.trim()
              if (name) {
                workerSet.add(name)
                workerTracker.set(name, { role: "포장", equipment_name: prod.equipment_name })
              }
            })
          }
        })
        workerTracker.forEach((val, key) => {
          workerDetailsArr.push({ name: key, role: val.role, equipment_name: val.equipment_name })
        })

        const noteData = productionData?.[0]?.note || null

        let totalProduction = 0
        let operatingCount = 0
        const prodDetails: DailyReportData["productionDetails"] = []
        const equipDetails: DailyReportData["equipmentDetails"] = []

        const equipmentData = allEquipment.map((equip) => {
          const legacyName = equip.name_legacy || ""
          const prod = productionByEquip.get(legacyName)
          if (prod) {
            totalProduction += prod.finished_qty || 0
            operatingCount += 1
            prodDetails.push({
              product_name: prod.product_name,
              equipment_name: equip.name_official || legacyName,
              finished_qty: prod.finished_qty || 0,
            })
            equipDetails.push({
              equipment_name: equip.name_official || legacyName,
              product_name: prod.product_name,
              finished_qty: prod.finished_qty || 0,
            })
          }

          const spec = productSpecs?.find((p) => p.equipment_name === legacyName)

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
            productSpec: spec ? { daily_max_qty: spec.daily_max_qty } : undefined,
          }
        })

        setReportData({
          selected_date: selectedDate,
          total_production: totalProduction,
          operating_equipment: operatingCount,
          total_equipment: allEquipment.length,
          worker_count: workerSet.size,
          equipmentData,
          productionDetails: prodDetails,
          equipmentDetails: equipDetails,
          workerDetails: workerDetailsArr,
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

  const operatingEquipment = reportData?.equipmentData.filter(e => !!e.production) || []
  const nonOperatingEquipment = reportData?.equipmentData.filter(e => !e.production) || []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">일보 (일일보고)</h1>
      </div>

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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setProductionPopup(true)}>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-2">총 생산량</p>
                  <p className="text-3xl font-bold text-blue-600">{formatNumber(reportData.total_production)}</p>
                  <p className="text-xs text-gray-500 mt-1">개</p>
                </div>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setEquipmentPopup(true)}>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-2">가동 설비 수</p>
                  <p className="text-3xl font-bold text-purple-600">
                    {reportData.operating_equipment}
                    <span className="text-sm text-gray-400 font-normal ml-1">/ {reportData.total_equipment}</span>
                  </p>
                  <p className="text-xs text-gray-500 mt-1">대</p>
                </div>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setWorkerPopup(true)}>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-2">작업 인원</p>
                  <p className="text-3xl font-bold text-green-600">{reportData.worker_count}</p>
                  <p className="text-xs text-gray-500 mt-1">명</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 가동 설비 */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              가동 설비
              <span className="text-sm font-normal text-gray-500 ml-2">{operatingEquipment.length}대</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {operatingEquipment.map((equip) => (
                <EquipmentCard
                  key={equip.equipment_id}
                  equipment={{ name_official: equip.name_official, name_short: equip.name_short }}
                  production={equip.production}
                  productSpec={equip.productSpec}
                />
              ))}
            </div>
          </div>

          {/* 미가동 설비 */}
          {nonOperatingEquipment.length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-500 mb-4">
                미가동 설비
                <span className="text-sm font-normal ml-2">{nonOperatingEquipment.length}대</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {nonOperatingEquipment.map((equip) => (
                  <EquipmentCard
                    key={equip.equipment_id}
                    equipment={{ name_official: equip.name_official, name_short: equip.name_short }}
                    production={equip.production}
                    productSpec={equip.productSpec}
                  />
                ))}
              </div>
            </div>
          )}

          {reportData.note && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">비고</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{reportData.note}</p>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <div className="text-center py-12 text-gray-500">데이터를 선택해주세요</div>
      )}

      {/* Popups */}
      <DetailPopup
        open={productionPopup}
        onOpenChange={setProductionPopup}
        title={`${selectedDate} 생산량 상세`}
        columns={[
          { key: "equipment_name", label: "설비명" },
          { key: "product_name", label: "제품명" },
          { key: "finished_qty", label: "생산량" },
        ]}
        data={(reportData?.productionDetails || []).map(d => ({
          equipment_name: d.equipment_name || "-",
          product_name: d.product_name || "-",
          finished_qty: formatNumber(d.finished_qty),
        }))}
      />

      <DetailPopup
        open={equipmentPopup}
        onOpenChange={setEquipmentPopup}
        title={`${selectedDate} 가동 설비 현황`}
        columns={[
          { key: "equipment_name", label: "설비명" },
          { key: "product_name", label: "생산품명" },
          { key: "finished_qty", label: "생산량" },
        ]}
        data={(reportData?.equipmentDetails || []).map(d => ({
          equipment_name: d.equipment_name,
          product_name: d.product_name || "-",
          finished_qty: formatNumber(d.finished_qty),
        }))}
      />

      <DetailPopup
        open={workerPopup}
        onOpenChange={setWorkerPopup}
        title={`${selectedDate} 작업 인원`}
        columns={[
          { key: "name", label: "이름" },
          { key: "role", label: "역할" },
          { key: "equipment_name", label: "담당 설비" },
        ]}
        data={(reportData?.workerDetails || []).map(d => ({
          name: d.name,
          role: d.role,
          equipment_name: d.equipment_name || "-",
        }))}
      />
    </div>
  )
}
