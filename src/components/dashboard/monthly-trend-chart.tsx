"use client"

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

interface WeeklyTrendChartProps {
  data: {
    week: string
    total: number
  }[]
}

export function MonthlyTrendChart({ data }: WeeklyTrendChartProps) {
  const chartData = data.map((d) => ({
    week: d.week,
    생산량: d.total,
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">주별 생산량 트렌드</CardTitle>
        <p className="text-xs text-gray-500 mt-1">주(week) 단위 총 생산량 추이 · 생산 증감 패턴을 파악할 수 있습니다</p>
      </CardHeader>
      <CardContent>
        <div className="w-full h-64 md:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week" tick={{ fontSize: 11 }} />
              <YAxis />
              <Tooltip
                formatter={(value) => (value ?? 0).toLocaleString("ko-KR")}
                contentStyle={{
                  backgroundColor: "#f3f4f6",
                  border: "1px solid #e5e7eb",
                }}
              />
              <Bar
                dataKey="생산량"
                fill="#10b981"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
