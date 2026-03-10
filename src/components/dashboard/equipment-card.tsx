import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatNumber, formatPercent } from "@/lib/utils"
import { cn } from "@/lib/utils"

interface EquipmentCardProps {
  equipment: {
    name_official: string | null
    name_short: string | null
  }
  production?: {
    product_name: string | null
    finished_qty: number
    tech_worker: string | null
    pack_workers: string | null
    work_start_hhmm: string | null
    work_end_hhmm: string | null
    work_minutes: number | null
  }
  productSpec?: {
    daily_max_qty: number | null
  }
}

export function EquipmentCard({
  equipment,
  production,
  productSpec,
}: EquipmentCardProps) {
  const hasProduction = !!production

  if (!hasProduction) {
    return (
      <Card className="bg-gray-100 opacity-60">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">
            {equipment.name_official || equipment.name_short || "미지정"}
            {equipment.name_short && ` (${equipment.name_short})`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-gray-500 text-sm py-4">미가동</div>
        </CardContent>
      </Card>
    )
  }

  const maxQty = productSpec?.daily_max_qty || 0
  const finishedQty = production.finished_qty || 0
  const utilRate = maxQty > 0 ? finishedQty / maxQty : 0

  const utilColor = utilRate >= 0.9 ? "green" : utilRate >= 0.7 ? "yellow" : "red"
  const utilColorClass = {
    green: "text-green-600 bg-green-50",
    yellow: "text-yellow-600 bg-yellow-50",
    red: "text-red-600 bg-red-50",
  }[utilColor]

  const workMinutes = production.work_minutes || 0
  const workHours = Math.floor(workMinutes / 60)
  const workMins = workMinutes % 60

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">
          {equipment.name_official || equipment.name_short || "미지정"}
          {equipment.name_short && ` (${equipment.name_short})`}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-xs text-gray-500">생산품명</p>
          <p className="text-sm font-medium">
            {production.product_name || "-"}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-xs text-gray-500">생산량</p>
            <p className="text-lg font-bold">
              {formatNumber(finishedQty)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">기준량</p>
            <p className="text-lg font-bold">
              {formatNumber(maxQty)}
            </p>
          </div>
        </div>

        <div className={`p-2 rounded ${utilColorClass}`}>
          <p className="text-xs">수율</p>
          <p className="text-sm font-bold">{formatPercent(utilRate)}</p>
        </div>

        <div>
          <p className="text-xs text-gray-500">작업시간</p>
          <p className="text-sm font-medium">
            {production.work_start_hhmm || "-"} ~ {production.work_end_hhmm || "-"}
          </p>
          <p className="text-xs text-gray-600">
            {workHours}시간 {workMins}분
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-2 border-t">
          <div>
            <p className="text-xs text-gray-500">기술자</p>
            <p className="text-xs font-medium">
              {production.tech_worker || "-"}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">포장</p>
            <p className="text-xs font-medium">
              {production.pack_workers || "-"}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
