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
    ? data.find((d) => d.equipment_name === selectedEquipment)?.details || []
    : []

  const chartData = data.map((d) => ({
    equipment_name: d.equipment_name || "미지정",
    total: d.total,
  }))

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">설비별 생산량</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 20, right: 30, left: 0, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="equipment_name"
                  angle={-45}
                  textAnchor="end"
                  height={100}
                  tick={{ fontSize: 11 }}
                />
                <YAxis />
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
          product_name: d.product_name || "-",
          finished_qty: d.finished_qty.toLocaleString("ko-KR"),
        }))}
      />

    </>
  )
}
