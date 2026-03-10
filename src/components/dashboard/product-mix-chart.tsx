"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { DetailPopup } from "@/components/common/detail-popup"
import { formatNumber } from "@/lib/utils"
import { ProductNameTooltip } from "@/components/common/name-tooltip"

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

const RANK_COLORS = [
  "bg-blue-100 text-blue-800",
  "bg-green-100 text-green-800",
  "bg-yellow-100 text-yellow-800",
  "bg-purple-100 text-purple-800",
  "bg-pink-100 text-pink-800",
  "bg-cyan-100 text-cyan-800",
  "bg-orange-100 text-orange-800",
  "bg-indigo-100 text-indigo-800",
  "bg-teal-100 text-teal-800",
  "bg-red-100 text-red-800",
]

export function ProductMixChart({ data }: ProductMixChartProps) {
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)

  const handleRowClick = (product: string) => {
    setSelectedProduct(product)
    setIsOpen(true)
  }

  const selectedDetails = selectedProduct
    ? data.find((d) => d.product_name === selectedProduct)?.details || []
    : []

  const totalValue = data.reduce((sum, d) => sum + d.value, 0)

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">제품별 생산 비율 (상위 10)</CardTitle>
          <p className="text-xs text-gray-500 mt-1">생산량 기준 상위 10개 제품 · 클릭하면 해당 제품의 일별 상세를 볼 수 있습니다</p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table className="text-sm">
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="w-10 text-center">순위</TableHead>
                  <TableHead>제품명</TableHead>
                  <TableHead className="text-right">생산량</TableHead>
                  <TableHead className="text-right w-20">비율</TableHead>
                  <TableHead className="w-32">비율 바</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                      데이터가 없습니다
                    </TableCell>
                  </TableRow>
                ) : (
                  data.map((item, idx) => {
                    const percentage = totalValue > 0 ? (item.value / totalValue) * 100 : 0
                    return (
                      <TableRow
                        key={idx}
                        className="cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => handleRowClick(item.product_name)}
                      >
                        <TableCell className="text-center">
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${RANK_COLORS[idx] || "bg-gray-100 text-gray-800"}`}>
                            {idx + 1}
                          </span>
                        </TableCell>
                        <TableCell className="font-medium truncate max-w-[200px]">
                          <ProductNameTooltip name={item.product_name || "미지정"} />
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatNumber(item.value)}
                        </TableCell>
                        <TableCell className="text-right text-gray-600">
                          {percentage.toFixed(1)}%
                        </TableCell>
                        <TableCell>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-500 h-2 rounded-full transition-all"
                              style={{ width: `${Math.min(percentage, 100)}%` }}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
                {data.length > 0 && (
                  <TableRow className="bg-gray-50 font-bold border-t-2">
                    <TableCell colSpan={2} className="text-center">합계</TableCell>
                    <TableCell className="text-right">{formatNumber(totalValue)}</TableCell>
                    <TableCell className="text-right">100%</TableCell>
                    <TableCell />
                  </TableRow>
                )}
              </TableBody>
            </Table>
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
