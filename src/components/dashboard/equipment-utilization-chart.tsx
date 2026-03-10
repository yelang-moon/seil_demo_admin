"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DetailPopup } from "@/components/common/detail-popup"
import { formatNumber } from "@/lib/utils"

interface EquipmentUtilizationChartProps {
  data: {
    equipment_name: string
    actual: number
    capacity: number
  }[]
}

function GaugeChart({
  label,
  actual,
  capacity,
  size = 140,
  onClick,
}: {
  label: string
  actual: number
  capacity: number
  size?: number
  onClick?: () => void
}) {
  const percentage = capacity > 0 ? Math.min((actual / capacity) * 100, 100) : 0
  const radius = size / 2 - 12
  const circumference = Math.PI * radius
  const strokeDashoffset = circumference - (percentage / 100) * circumference

  // Color based on percentage
  const getColor = (pct: number) => {
    if (pct >= 90) return "#22c55e"  // green
    if (pct >= 70) return "#eab308"  // yellow
    if (pct >= 50) return "#f97316"  // orange
    return "#ef4444"                  // red
  }

  const color = getColor(percentage)

  return (
    <div
      className={`flex flex-col items-center ${onClick ? "cursor-pointer hover:opacity-80 transition-opacity" : ""}`}
      onClick={onClick}
    >
      <svg width={size} height={size / 2 + 20} viewBox={`0 0 ${size} ${size / 2 + 20}`}>
        {/* Background arc */}
        <path
          d={`M ${12} ${size / 2 + 4} A ${radius} ${radius} 0 0 1 ${size - 12} ${size / 2 + 4}`}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={10}
          strokeLinecap="round"
        />
        {/* Foreground arc */}
        <path
          d={`M ${12} ${size / 2 + 4} A ${radius} ${radius} 0 0 1 ${size - 12} ${size / 2 + 4}`}
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
        {/* Percentage text */}
        <text
          x={size / 2}
          y={size / 2 - 4}
          textAnchor="middle"
          className="text-lg font-bold"
          fill={color}
          fontSize={size > 120 ? 20 : 16}
          fontWeight="bold"
        >
          {percentage.toFixed(1)}%
        </text>
        {/* Actual / Capacity */}
        <text
          x={size / 2}
          y={size / 2 + 14}
          textAnchor="middle"
          fill="#6b7280"
          fontSize={10}
        >
          {formatNumber(actual)} / {formatNumber(capacity)}
        </text>
      </svg>
      <p className="text-xs text-gray-600 text-center mt-1 truncate max-w-[120px]" title={label}>
        {label}
      </p>
    </div>
  )
}

export function EquipmentUtilizationChart({
  data,
}: EquipmentUtilizationChartProps) {
  const [popupOpen, setPopupOpen] = useState(false)
  const filteredData = data.filter(d => d.capacity > 0)

  // Calculate overall utilization
  const totalActual = filteredData.reduce((sum, d) => sum + d.actual, 0)
  const totalCapacity = filteredData.reduce((sum, d) => sum + d.capacity, 0)

  const popupData = filteredData.map(d => {
    const rate = d.capacity > 0 ? ((d.actual / d.capacity) * 100).toFixed(1) + "%" : "N/A"
    return {
      equipment_name: d.equipment_name,
      actual: formatNumber(d.actual),
      capacity: formatNumber(d.capacity),
      rate,
    }
  })

  return (
    <>
      <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setPopupOpen(true)}>
        <CardHeader>
          <CardTitle className="text-base">설비 가동률</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredData.length === 0 ? (
            <div className="text-center py-8 text-gray-500">데이터가 없습니다</div>
          ) : (
            <div className="space-y-4">
              {/* Overall gauge */}
              <div className="flex justify-center pb-2 border-b">
                <GaugeChart
                  label="전체 평균"
                  actual={totalActual}
                  capacity={totalCapacity}
                  size={160}
                />
              </div>
              {/* Individual gauges */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {filteredData.map((item, idx) => (
                  <GaugeChart
                    key={idx}
                    label={item.equipment_name || "미지정"}
                    actual={item.actual}
                    capacity={item.capacity}
                    size={120}
                  />
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <DetailPopup
        open={popupOpen}
        onOpenChange={setPopupOpen}
        title="설비별 가동률 상세"
        columns={[
          { key: "equipment_name", label: "설비명" },
          { key: "actual", label: "기간 총 생산량" },
          { key: "capacity", label: "기간 최대 생산능력" },
          { key: "rate", label: "가동률" },
        ]}
        data={popupData}
      />
    </>
  )
}
