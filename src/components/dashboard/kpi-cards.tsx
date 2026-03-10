import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatNumber, formatPercent } from "@/lib/utils"

interface KPICardsProps {
  latestDayProduction: number
  operatingEquipment: number
  defectRate: number
  monthChange: number
  latestMonthLabel: string
  prevMonthLabel: string
  latestDate: string
}

export function KPICards({
  latestDayProduction,
  operatingEquipment,
  defectRate,
  monthChange,
  latestMonthLabel,
  prevMonthLabel,
  latestDate,
}: KPICardsProps) {
  const isPositiveChange = monthChange >= 0
  const dateLabel = latestDate ? latestDate.replace(/-/g, ". ") + "." : ""

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">최근일 생산량</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatNumber(latestDayProduction)}</div>
          <p className="text-xs text-gray-500 mt-1">{dateLabel} 기준</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">가동 설비 수</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{operatingEquipment}</div>
          <p className="text-xs text-gray-500 mt-1">{dateLabel} 기준</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{latestMonthLabel} 불량률</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatPercent(defectRate)}</div>
          <p className="text-xs text-gray-500 mt-1">{latestMonthLabel} 누적</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">전월 대비 증감</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${isPositiveChange ? "text-green-600" : "text-red-600"}`}>
            {isPositiveChange ? "+" : ""}{formatNumber(monthChange)}
          </div>
          <p className="text-xs text-gray-500 mt-1">{latestMonthLabel} vs {prevMonthLabel}</p>
        </CardContent>
      </Card>
    </div>
  )
}
