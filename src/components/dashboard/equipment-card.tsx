import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatNumber, formatPercent } from "@/lib/utils"
import { EquipmentNameTooltip, ProductNameTooltip } from "@/components/common/name-tooltip"

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

function MiniGauge({ rate, size = 80 }: { rate: number; size?: number }) {
  const percentage = Math.min(rate * 100, 100)
  const radius = size / 2 - 8
  const circumference = Math.PI * radius
  const strokeDashoffset = circumference - (percentage / 100) * circumference

  const getColor = (pct: number) => {
    if (pct >= 90) return "#22c55e"
    if (pct >= 70) return "#eab308"
    if (pct >= 50) return "#f97316"
    return "#ef4444"
  }

  const color = getColor(percentage)

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size / 2 + 12} viewBox={`0 0 ${size} ${size / 2 + 12}`}>
        <path
          d={`M ${8} ${size / 2 + 2} A ${radius} ${radius} 0 0 1 ${size - 8} ${size / 2 + 2}`}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={7}
          strokeLinecap="round"
        />
        <path
          d={`M ${8} ${size / 2 + 2} A ${radius} ${radius} 0 0 1 ${size - 8} ${size / 2 + 2}`}
          fill="none"
          stroke={color}
          strokeWidth={7}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
        <text
          x={size / 2}
          y={size / 2 - 2}
          textAnchor="middle"
          fill={color}
          fontSize={14}
          fontWeight="bold"
        >
          {percentage.toFixed(1)}%
        </text>
      </svg>
    </div>
  )
}

export function EquipmentCard({
  equipment,
  production,
  productSpec,
}: EquipmentCardProps) {
  const hasProduction = !!production

  if (!hasProduction) {
    return (
      <Card className="bg-gray-100 border-gray-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-gray-400">
            <EquipmentNameTooltip name={equipment.name_official || equipment.name_short || "미지정"} />
            {equipment.name_short && <span className="text-gray-400"> ({equipment.name_short})</span>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-gray-400 text-sm py-4">미가동</div>
        </CardContent>
      </Card>
    )
  }

  const maxQty = productSpec?.daily_max_qty || 0
  const finishedQty = production.finished_qty || 0
  const utilRate = maxQty > 0 ? finishedQty / maxQty : 0

  const workMinutes = production.work_minutes || 0
  const workHours = Math.floor(workMinutes / 60)
  const workMins = workMinutes % 60

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">
          <EquipmentNameTooltip name={equipment.name_official || equipment.name_short || "미지정"} />
          {equipment.name_short && <span className="text-gray-500"> ({equipment.name_short})</span>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-xs text-gray-500">생산품명</p>
          <p className="text-sm font-medium">
            <ProductNameTooltip name={production.product_name || "-"} />
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

        {/* 가동률 게이지 */}
        <div className="flex flex-col items-center py-1">
          <p className="text-xs text-gray-500 mb-1">가동률</p>
          <MiniGauge rate={utilRate} size={90} />
          <p className="text-xs text-gray-500 mt-0.5">
            {formatNumber(finishedQty)} / {formatNumber(maxQty)}
          </p>
        </div>

        <div>
          <p className="text-xs text-gray-500">작업시간</p>
          <p className="text-sm font-medium">
            {production.work_start_hhmm || "-"} ~ {production.work_end_hhmm || "-"}
          </p>
          <p className="text-xs text-gray-600">
            {workHours}시간 {workMins}분
          </p>
          {(() => {
            if (!production.work_start_hhmm || !production.work_end_hhmm || !production.work_minutes) return null
            const [sh, sm] = production.work_start_hhmm.split(':').map(Number)
            const [eh, em] = production.work_end_hhmm.split(':').map(Number)
            const totalMinutes = (eh * 60 + em) - (sh * 60 + sm)
            const breakMinutes = totalMinutes - (production.work_minutes || 0)
            if (breakMinutes <= 0) return null
            const breakH = Math.floor(breakMinutes / 60)
            const breakM = breakMinutes % 60
            return (
              <p className="text-xs text-orange-500 mt-0.5">
                휴게 {breakH > 0 ? `${breakH}시간 ` : ''}{breakM}분
              </p>
            )
          })()}
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
