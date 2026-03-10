"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { formatNumber, formatPercent } from "@/lib/utils"
import { cn } from "@/lib/utils"

interface ProductionRow {
  equipment_name: string | null
  product_name: string | null
  daily_max_qty: number | null
  finished_qty: number | null
  produced_qty: number | null
  work_start_hhmm: string | null
  work_end_hhmm: string | null
  work_minutes: number | null
  defect_qty: number | null
  tech_worker: string | null
  pack_workers: string | null
  note: string | null
}

interface ReportData {
  selected_date: string
  rows: ProductionRow[]
  totals: {
    finished_qty: number
    produced_qty: number
    defect_qty: number
  }
}

export default function ProductionReport() {
  const [selectedDate, setSelectedDate] = useState<string>("")
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [latestDate, setLatestDate] = useState<string>("")

  // Get latest date
  useEffect(() => {
    const fetchLatestDate = async () => {
      try {
        const { data } = await supabase
          .from("fact_production")
          .select("production_date")
          .order("production_date", { ascending: false })
          .limit(1)

        if (data && data.length > 0) {
          const latest = data[0].production_date
          setLatestDate(latest)
          setSelectedDate(latest)
        }
      } catch (error) {
        console.error("Error fetching latest date:", error)
      }
    }
    fetchLatestDate()
  }, [])

  // Fetch report data
  useEffect(() => {
    if (!selectedDate) return

    const fetchReportData = async () => {
      setLoading(true)
      try {
        // Get all equipment
        const { data: allEquipment } = await supabase
          .from("dim_equipment")
          .select("*")
          .order("equipment_id")

        if (!allEquipment) return

        // Get production data for selected date
        const { data: productionData } = await supabase
          .from("fact_production")
          .select("*")
          .eq("production_date", selectedDate)

        // Get product specs
        const { data: productSpecs } = await supabase
          .from("dim_product")
          .select("equipment_name, daily_max_qty")

        // Create a map of production data
        const productionByEquip = new Map()
        productionData?.forEach((prod) => {
          if (prod.equipment_name) {
            if (!productionByEquip.has(prod.equipment_name)) {
              productionByEquip.set(prod.equipment_name, [])
            }
            productionByEquip.get(prod.equipment_name).push(prod)
          }
        })

        // Build rows for all equipment (21 total)
        let totalFinished = 0
        let totalProduced = 0
        let totalDefects = 0

        const rows = allEquipment.map((equip) => {
          // fact_production uses legacy names (e.g. "HRP-8온스"), not official names
          const legacyName = equip.name_legacy || ""
          const displayName = equip.name_official || equip.name_legacy
          const prodList = productionByEquip.get(legacyName) || []

          let row: ProductionRow
          if (prodList.length === 0) {
            // No production for this equipment
            row = {
              equipment_name: displayName,
              product_name: null,
              daily_max_qty: productSpecs?.find(
                (p) => p.equipment_name === legacyName
              )?.daily_max_qty || null,
              finished_qty: null,
              produced_qty: null,
              work_start_hhmm: null,
              work_end_hhmm: null,
              work_minutes: null,
              defect_qty: null,
              tech_worker: null,
              pack_workers: null,
              note: null,
            }
          } else {
            // Use first production record (there might be multiple products per equipment)
            const prod = prodList[0]
            row = {
              equipment_name: displayName,
              product_name: prod.product_name,
              daily_max_qty: productSpecs?.find(
                (p) => p.equipment_name === legacyName
              )?.daily_max_qty || prod.produced_qty || 0,
              finished_qty: prod.finished_qty,
              produced_qty: prod.produced_qty,
              work_start_hhmm: prod.work_start_hhmm,
              work_end_hhmm: prod.work_end_hhmm,
              work_minutes: prod.work_minutes,
              defect_qty: prod.defect_qty,
              tech_worker: prod.tech_worker,
              pack_workers: prod.pack_workers,
              note: prod.note,
            }

            // Sum totals
            totalFinished += prod.finished_qty || 0
            totalProduced += prod.produced_qty || 0
            totalDefects += prod.defect_qty || 0
          }

          return row
        })

        setReportData({
          selected_date: selectedDate,
          rows,
          totals: {
            finished_qty: totalFinished,
            produced_qty: totalProduced,
            defect_qty: totalDefects,
          },
        })
      } catch (error) {
        console.error("Error fetching report data:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchReportData()
  }, [selectedDate])

  const downloadCSV = () => {
    if (!reportData) return

    const headers = [
      "NO",
      "설비명",
      "생산품명",
      "기준수량(1일8시간)",
      "생산수량",
      "가동율",
      "작업시간(시작)",
      "작업시간(종료)",
      "작업시간(가동분)",
      "불량수량",
      "불량율",
      "기술자",
      "포장1",
      "포장2",
      "비고",
    ]

    const rows = reportData.rows.map((row, idx) => {
      const finishedQty = row.finished_qty || 0
      const maxQty = row.daily_max_qty || 0
      const utilRate = maxQty > 0 ? finishedQty / maxQty : 0
      const defectQty = row.defect_qty || 0
      const defectRate =
        (row.finished_qty || 0) > 0
          ? defectQty / (row.finished_qty || 1)
          : 0
      const packWorkers = row.pack_workers
        ? row.pack_workers.split(/[,/]/)
        : ["-", "-"]

      return [
        idx + 1,
        row.equipment_name || "-",
        row.product_name || "-",
        maxQty || "-",
        finishedQty || "-",
        (utilRate * 100).toFixed(1),
        row.work_start_hhmm || "-",
        row.work_end_hhmm || "-",
        row.work_minutes || "-",
        defectQty || "-",
        (defectRate * 100).toFixed(1),
        row.tech_worker || "-",
        packWorkers[0] || "-",
        packWorkers[1] || "-",
        row.note || "-",
      ]
    })

    // Add totals row
    rows.push([
      "합계",
      "",
      "",
      "",
      reportData.totals.finished_qty,
      reportData.totals.produced_qty > 0
        ? (
            (reportData.totals.finished_qty / reportData.totals.produced_qty) *
            100
          ).toFixed(1)
        : "-",
      "",
      "",
      "",
      reportData.totals.defect_qty,
      reportData.totals.produced_qty > 0
        ? (
            (reportData.totals.defect_qty / reportData.totals.produced_qty) *
            100
          ).toFixed(1)
        : "-",
      "",
      "",
      "",
      "",
    ])

    const csvContent = [
      headers.join(","),
      ...rows.map((row) =>
        row
          .map((cell) =>
            typeof cell === "string" && cell.includes(",")
              ? `"${cell}"`
              : cell
          )
          .join(",")
      ),
    ].join("\n")

    const element = document.createElement("a")
    element.setAttribute(
      "href",
      "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent)
    )
    element.setAttribute("download", `production-report-${selectedDate}.csv`)
    element.style.display = "none"
    document.body.appendChild(element)
    element.click()
    document.body.removeChild(element)
  }

  const getUtilColor = (
    finishedQty: number | null,
    maxQty: number | null
  ): string => {
    if (!finishedQty || !maxQty) return ""
    const rate = finishedQty / maxQty
    if (rate >= 0.9) return "bg-green-50 text-green-700"
    if (rate >= 0.7) return "bg-yellow-50 text-yellow-700"
    return "bg-red-50 text-red-700"
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="text-3xl font-bold text-gray-900">생산보고</h1>
        <Button onClick={downloadCSV} variant="outline">
          CSV 다운로드
        </Button>
      </div>

      {/* Date Picker */}
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
          <Card>
            <CardContent className="pt-6">
              <div className="overflow-x-auto">
                <Table className="text-sm">
                  <TableHeader>
                    <TableRow className="bg-gray-100">
                      <TableHead className="h-12">NO</TableHead>
                      <TableHead className="h-12">설비명</TableHead>
                      <TableHead className="h-12">생산품명</TableHead>
                      <TableHead className="h-12 text-right">
                        기준수량
                        <br />
                        (1일8시간)
                      </TableHead>
                      <TableHead className="h-12 text-right">생산수량</TableHead>
                      <TableHead className="h-12 text-right">가동율</TableHead>
                      <TableHead className="h-12">작업시간(시작)</TableHead>
                      <TableHead className="h-12">작업시간(종료)</TableHead>
                      <TableHead className="h-12 text-right">
                        작업시간
                        <br />
                        (분)
                      </TableHead>
                      <TableHead className="h-12 text-right">불량수량</TableHead>
                      <TableHead className="h-12 text-right">불량율</TableHead>
                      <TableHead className="h-12">기술자</TableHead>
                      <TableHead className="h-12">포장1</TableHead>
                      <TableHead className="h-12">포장2</TableHead>
                      <TableHead className="h-12">비고</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportData.rows.map((row, idx) => {
                      const finishedQty = row.finished_qty || 0
                      const maxQty = row.daily_max_qty || 0
                      const utilRate =
                        maxQty > 0 ? finishedQty / maxQty : 0
                      const defectQty = row.defect_qty || 0
                      const defectRate =
                        (row.finished_qty || 0) > 0
                          ? defectQty / (row.finished_qty || 1)
                          : 0
                      const packWorkers = row.pack_workers
                        ? row.pack_workers.split(/[,/]/)
                        : ["-", "-"]

                      return (
                        <TableRow key={idx} className="border-b hover:bg-gray-50">
                          <TableCell className="w-10 text-right">
                            {idx + 1}
                          </TableCell>
                          <TableCell className="font-medium">
                            {row.equipment_name || "-"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {row.product_name || "-"}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {maxQty > 0 ? formatNumber(maxQty) : "-"}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {finishedQty > 0
                              ? formatNumber(finishedQty)
                              : "-"}
                          </TableCell>
                          <TableCell
                            className={cn(
                              "text-right font-semibold",
                              getUtilColor(finishedQty, maxQty)
                            )}
                          >
                            {maxQty > 0 ? formatPercent(utilRate) : "-"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {row.work_start_hhmm || "-"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {row.work_end_hhmm || "-"}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {row.work_minutes || "-"}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {defectQty > 0 ? formatNumber(defectQty) : "-"}
                          </TableCell>
                          <TableCell className="text-right text-sm">
                            {(row.finished_qty || 0) > 0
                              ? formatPercent(defectRate)
                              : "-"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {row.tech_worker || "-"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {packWorkers[0] || "-"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {packWorkers[1] || "-"}
                          </TableCell>
                          <TableCell className="text-sm">
                            {row.note || "-"}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                    {/* Total Row */}
                    <TableRow className="bg-gray-100 font-bold">
                      <TableCell colSpan={2}>합계</TableCell>
                      <TableCell></TableCell>
                      <TableCell className="text-right">-</TableCell>
                      <TableCell className="text-right">
                        {formatNumber(reportData.totals.finished_qty)}
                      </TableCell>
                      <TableCell className="text-right">
                        {reportData.totals.produced_qty > 0
                          ? formatPercent(
                              reportData.totals.finished_qty /
                                reportData.totals.produced_qty
                            )
                          : "-"}
                      </TableCell>
                      <TableCell colSpan={3}></TableCell>
                      <TableCell className="text-right">
                        {formatNumber(reportData.totals.defect_qty)}
                      </TableCell>
                      <TableCell className="text-right">
                        {reportData.totals.produced_qty > 0
                          ? formatPercent(
                              reportData.totals.defect_qty /
                                reportData.totals.produced_qty
                            )
                          : "-"}
                      </TableCell>
                      <TableCell colSpan={4}></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="text-center py-12 text-gray-500">
            데이터를 선택해주세요
          </div>
        )}
    </div>
  )
}
