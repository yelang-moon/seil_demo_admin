"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"

interface EquipmentUtilizationChartProps {
  data: {
    equipment_name: string
    actual: number
    capacity: number
  }[]
}

export function EquipmentUtilizationChart({
  data,
}: EquipmentUtilizationChartProps) {
  const chartData = data.map((d) => ({
    equipment_name: d.equipment_name || "미지정",
    실적: d.actual,
    기준: d.capacity,
  }))

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">설비 가동률</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 200, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="equipment_name" type="category" width={190} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value) => (value ?? 0).toLocaleString("ko-KR")}
                  contentStyle={{
                    backgroundColor: "#f3f4f6",
                    border: "1px solid #e5e7eb",
                  }}
                />
                <Legend />
                <Bar dataKey="실적" fill="#3b82f6" />
                <Bar dataKey="기준" fill="#e5e7eb" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="mt-2 p-3 bg-blue-50 rounded-lg text-sm text-blue-800 min-h-[40px]">
        <span className="text-gray-400">💡 AI 분석 로딩 중...</span>
      </div>
    </>
  )
}
