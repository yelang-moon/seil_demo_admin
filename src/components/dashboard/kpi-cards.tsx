"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatNumber, formatPercent } from "@/lib/utils"
import { DetailPopup } from "@/components/common/detail-popup"

interface KPICardsProps {
  periodProduction: number
  operatingEquipment: number
  defectRate: number
  yearChange: number
  periodLabel: string
  lastYearPeriodLabel: string
  defectPeriodLabel: string
  latestDate: string
  periodDays: number
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
  defectDetails: Array<{
    equipment_name: string
    produced_qty: number
    defect_qty: number
    defect_rate: number
  }>
  lastYearCompareDetails: Array<{
    equipment_name: string
    thisYearQty: number
    lastYearQty: number
    change: number
  }>
  totalEquipmentCount: number
  factory: string
}

export function KPICards({
  periodProduction,
  operatingEquipment,
  defectRate,
  yearChange,
  periodLabel,
  lastYearPeriodLabel,
  defectPeriodLabel,
  latestDate,
  periodDays,
  productionDetails,
  equipmentDetails,
  workerDetails,
  defectDetails,
  lastYearCompareDetails,
  totalEquipmentCount,
  factory,
}: KPICardsProps) {
  const isPositiveChange = yearChange >= 0

  const [productionPopup, setProductionPopup] = useState(false)
  const [equipmentPopup, setEquipmentPopup] = useState(false)
  const [defectPopup, setDefectPopup] = useState(false)
  const [workerPopup, setWorkerPopup] = useState(false)
  const [yearComparePopup, setYearComparePopup] = useState(false)

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {/* 기간내 생산량 카드 */}
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setProductionPopup(true)}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">기간내 생산량</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(periodProduction)}</div>
            <p className="text-xs text-gray-500 mt-1">{periodLabel}</p>
          </CardContent>
        </Card>

        {/* 가동 설비 수 카드 */}
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

        {/* 불량률 카드 */}
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setDefectPopup(true)}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">불량률</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPercent(defectRate)}</div>
            <p className="text-xs text-gray-500 mt-1">{defectPeriodLabel}</p>
          </CardContent>
        </Card>

        {/* 작업 인원 총원 카드 */}
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setWorkerPopup(true)}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">작업 인원</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{workerDetails.length}</div>
            <p className="text-xs text-gray-500 mt-1">{periodLabel} 기간 내</p>
          </CardContent>
        </Card>

        {/* 작년 대비 증감 카드 */}
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setYearComparePopup(true)}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">작년 대비 증감</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${isPositiveChange ? "text-green-600" : "text-red-600"}`}>
              {isPositiveChange ? "+" : ""}{formatNumber(yearChange)}
            </div>
            <p className="text-xs text-gray-500 mt-1">기간내 생산량 vs 작년 동기간</p>
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
          { key: "daily_avg", label: "일평균 생산량" },
        ]}
        data={productionDetails.map(d => ({
          equipment_name: d.equipment_name || "-",
          product_name: d.product_name || "-",
          finished_qty: formatNumber(d.finished_qty),
          daily_avg: formatNumber(Math.round(d.finished_qty / periodDays)),
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

      {/* 불량률 상세 팝업 */}
      <DetailPopup
        open={defectPopup}
        onOpenChange={setDefectPopup}
        title={`${defectPeriodLabel} 불량률 상세`}
        columns={[
          { key: "equipment_name", label: "설비명" },
          { key: "produced_qty", label: "생산량" },
          { key: "defect_qty", label: "불량량" },
          { key: "defect_rate", label: "불량률" },
        ]}
        data={defectDetails.map(d => ({
          equipment_name: d.equipment_name,
          produced_qty: formatNumber(d.produced_qty),
          defect_qty: formatNumber(d.defect_qty),
          defect_rate: formatPercent(d.defect_rate),
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

      {/* 작년 대비 생산량 비교 팝업 */}
      <DetailPopup
        open={yearComparePopup}
        onOpenChange={setYearComparePopup}
        title={`${periodLabel} vs ${lastYearPeriodLabel} 생산량 비교`}
        columns={[
          { key: "equipment_name", label: "설비명" },
          { key: "thisYearQty", label: "올해 생산량" },
          { key: "lastYearQty", label: "작년 생산량" },
          { key: "change", label: "증감량" },
          { key: "changePercent", label: "증감률" },
        ]}
        data={lastYearCompareDetails.map(d => ({
          equipment_name: d.equipment_name,
          thisYearQty: formatNumber(d.thisYearQty),
          lastYearQty: formatNumber(d.lastYearQty),
          change: formatNumber(d.change),
          changePercent: d.lastYearQty !== 0 ? formatPercent((d.change / d.lastYearQty) * 100) : "-",
        }))}
      />
    </>
  )
}
