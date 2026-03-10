"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { DetailPopup } from "@/components/common/detail-popup"

interface EquipmentProductionChartProps {
  data: {
    equipment_name: string
    total: number
    details: Array<{
      equipment_name: string
      product_name: string
      finished_qty: number
    }>
  }[]
}

// Format large numbers for y-axis: 100000 → 100K, 1000000 → 1M
const formatYAxis = (value: number): string => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`
  return String(value)
}

export function EquipmentProductionChart({
  data,
}: EquipmentProductionChartProps) {
  const [selectedEquipment, setSelectedEquipment] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)

  const handleBarClick = (equipment: string) => {
    setSelectedEquipment(equipment)
    setIsOpen(true)
  }

  const selectedDetails = selectedEquipment
    ? (() => {
        const details = data.find((d) => d.equipment_name === selectedEquipment)?.details || []
        // Aggregate by product_name
        const map = new Map<string, number>()
        details.forEach(d => {
          const key = d.product_name || '미지정'
          map.set(key, (map.get(key) || 0) + d.finished_qty)
        })
        return Array.from(map.entries()).map(([name, qty]) => ({
          product_name: name,
          finished_qty: qty,
        })).sort((a, b) => b.finished_qty - a.finished_qty)
      })()
    : []

  // Sort by total production descending
  const chartData = [...data]
    .sort((a, b) => b.total - a.total)
    .map((d) => ({
      equipment_name: d.equipment_name || "미지정",
      total: d.total,
    }))

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">설비별 생산량</CardTitle>
          <p className="text-xs text-gray-500 mt-1">설비별 기간 내 총 생산량 비교 · 클릭하면 해당 설비의 제품별 상세를 볼 수 있습니다</p>
        </CardHeader>
        <CardContent>
          <div className="w-full h-64 md:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 20, right: 20, left: 10, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="equipment_name"
                  angle={-45}
                  textAnchor="end"
                  height={100}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  width={55}
                  tickFormatter={formatYAxis}
                  tick={{ fontSize: 11 }}
                />
                <Tooltip
                  formatter={(value) => (value ?? 0).toLocaleString("ko-KR")}
                  contentStyle={{
                    backgroundColor: "#f3f4f6",
                    border: "1px solid #e5e7eb",
                  }}
                />
                <Bar
                  dataKey="total"
                  fill="#8b5cf6"
                  onClick={(e: any) => handleBarClick(e.equipment_name)}
                  style={{ cursor: "pointer" }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <DetailPopup
        open={isOpen}
        onOpenChange={setIsOpen}
        title={`${selectedEquipment}의 제품별 생산량`}
        columns={[
          { key: "product_name", label: "제품명" },
          { key: "finished_qty", label: "생산량" },
        ]}
        data={selectedDetails.map((d) => ({
          product_name: d.product_name,
          finished_qty: d.finished_qty.toLocaleString("ko-KR"),
        }))}
      />

    </>
  )
}
