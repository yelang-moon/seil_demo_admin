import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatNumber, formatPercent } from "@/lib/utils"

interface KPICardsProps {
  todayProduction: number
  operatingEquipment: number
  defectRate: number
  monthChange: number
}

export function KPICards({
  todayProduction,
  operatingEquipment,
  defectRate,
  monthChange,
}: KPICardsProps) {
  const isPositiveChange = monthChange >= 0

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">오늘 총 생산량</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatNumber(todayProduction)}</div>
          <p className="text-xs text-gray-500 mt-1">개</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">가동 설비 수</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{operatingEquipment}</div>
          <p className="text-xs text-gray-500 mt-1">대</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">불량률</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatPercent(defectRate)}</div>
          <p className="text-xs text-gray-500 mt-1">이번 달</p>
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
          <p className="text-xs text-gray-500 mt-1">개</p>
        </CardContent>
      </Card>
    </div>
  )
}
