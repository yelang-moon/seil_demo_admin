"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { DetailPopup } from "@/components/common/detail-popup"

interface DailyTrendChartProps {
  data: {
    date: string
    total: number
    details: Array<{
      date: string
      product_name: string
      finished_qty: number
      equipment_name: string
    }>
  }[]
}

export function DailyTrendChart({ data }: DailyTrendChartProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)

  const handleBarClick = (date: string) => {
    setSelectedDate(date)
    setIsOpen(true)
  }

  const selectedDetails = selectedDate
    ? data.find((d) => d.date === selectedDate)?.details || []
    : []

  const chartData = data.map((d) => ({
    date: d.date,
    total: d.total,
  }))

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">일별 생산량 추이</CardTitle>
          <p className="text-xs text-gray-500 mt-1">선택 기간의 일자별 총 생산량 변화 · 클릭하면 해당 일자의 제품별 상세를 볼 수 있습니다</p>
        </CardHeader>
        <CardContent>
          <div className="w-full h-64 md:h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  tick={{ fontSize: 12 }}
                />
                <YAxis />
                <Tooltip
                  formatter={(value) => (value ?? 0).toLocaleString("ko-KR")}
                  contentStyle={{
                    backgroundColor: "#f3f4f6",
                    border: "1px solid #e5e7eb",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="#3b82f6"
                  fillOpacity={1}
                  fill="url(#colorTotal)"
                  onClick={(e: any) => handleBarClick(e.date)}
                  style={{ cursor: "pointer" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <DetailPopup
        open={isOpen}
        onOpenChange={setIsOpen}
        title={`${selectedDate}의 생산 상세 정보`}
        columns={[
          { key: "date", label: "날짜" },
          { key: "product_name", label: "제품명" },
          { key: "equipment_name", label: "설비명" },
          { key: "finished_qty", label: "생산량" },
        ]}
        data={selectedDetails.map((d) => ({
          date: d.date,
          product_name: d.product_name || "-",
          equipment_name: d.equipment_name || "-",
          finished_qty: d.finished_qty.toLocaleString("ko-KR"),
        }))}
      />

    </>
  )
}
