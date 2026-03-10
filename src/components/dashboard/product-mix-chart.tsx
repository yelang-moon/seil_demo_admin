"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  PieChart,
  Pie,
  Cell,
  Legend,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { DetailPopup } from "@/components/common/detail-popup"

interface ProductMixChartProps {
  data: {
    product_name: string
    value: number
    details: Array<{
      date: string
      finished_qty: number
    }>
  }[]
}

const COLORS = [
  "#3b82f6",
  "#ef4444",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#f97316",
  "#6366f1",
  "#14b8a6",
]

export function ProductMixChart({ data }: ProductMixChartProps) {
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)

  const handleSliceClick = (product: string) => {
    setSelectedProduct(product)
    setIsOpen(true)
  }

  const selectedDetails = selectedProduct
    ? data.find((d) => d.product_name === selectedProduct)?.details || []
    : []

  const chartData = data.map((d) => ({
    name: d.product_name || "미지정",
    value: d.value,
  }))

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">제품별 생산 비율 (상위 10)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="w-full h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip
                  formatter={(value) => (value ?? 0).toLocaleString("ko-KR")}
                  contentStyle={{
                    backgroundColor: "#f3f4f6",
                    border: "1px solid #e5e7eb",
                  }}
                />
                <Legend />
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) =>
                    `${name}: ${(value).toLocaleString("ko-KR")}`
                  }
                  outerRadius={120}
                  fill="#8884d8"
                  dataKey="value"
                  onClick={(e: any) => handleSliceClick(e.name)}
                  style={{ cursor: "pointer" }}
                >
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <DetailPopup
        open={isOpen}
        onOpenChange={setIsOpen}
        title={selectedProduct ? `${selectedProduct}의 일일 생산량 추이` : "일일 생산량 추이"}
        columns={[
          { key: "date", label: "날짜" },
          { key: "finished_qty", label: "생산량" },
        ]}
        data={selectedDetails.map((d) => ({
          date: d.date,
          finished_qty: d.finished_qty.toLocaleString("ko-KR"),
        }))}
      />

    </>
  )
}
