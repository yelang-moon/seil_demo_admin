"use client"

import { useState, useEffect, useRef } from "react"
import { supabase } from "@/lib/supabase"
import { useFactory } from "@/contexts/factory-context"
import { formatNumber } from "@/lib/utils"

interface EquipmentInfo {
  equipment_id: number
  name_official: string | null
  name_short: string | null
  name_legacy: string | null
  manufacturer: string | null
  country: string | null
  note: string | null
}

interface ProductInfo {
  product_code: string | null
  product_name: string | null
  pack_qty: number | null
  rpm: number | null
  equipment_name: string | null
  raw_material: string | null
  daily_max_qty: number | null
}

// Cache to avoid re-fetching
const equipmentCache = new Map<string, EquipmentInfo | null>()
const productCache = new Map<string, ProductInfo | null>()

function TooltipBox({ children, content, visible }: {
  children: React.ReactNode
  content: React.ReactNode
  visible: boolean
}) {
  const triggerRef = useRef<HTMLSpanElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  useEffect(() => {
    if (visible && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setPos({
        top: rect.bottom + 4,
        left: rect.left,
      })
    }
  }, [visible])

  return (
    <>
      <span ref={triggerRef} className="inline-block">
        {children}
      </span>
      {visible && pos && (
        <div
          ref={tooltipRef}
          className="fixed z-[9999] bg-white border border-gray-200 shadow-lg rounded-lg p-3 text-xs max-w-xs"
          style={{ top: pos.top, left: pos.left }}
        >
          {content}
        </div>
      )}
    </>
  )
}

export function EquipmentNameTooltip({ name, legacyName }: { name: string; legacyName?: string }) {
  const { factory } = useFactory()
  const [info, setInfo] = useState<EquipmentInfo | null>(null)
  const [hovered, setHovered] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const fetchInfo = async () => {
    if (loaded) return
    const cacheKey = `${factory}:${name}:${legacyName || ""}`
    if (equipmentCache.has(cacheKey)) {
      setInfo(equipmentCache.get(cacheKey) || null)
      setLoaded(true)
      return
    }

    try {
      let query = supabase
        .from("dim_equipment")
        .select("*")
        .eq("factory", factory)

      if (legacyName) {
        query = query.eq("name_legacy", legacyName)
      } else {
        query = query.or(`name_official.eq.${name},name_short.eq.${name},name_legacy.eq.${name}`)
      }

      const { data } = await query.limit(1)
      const result = data && data.length > 0 ? data[0] as EquipmentInfo : null
      equipmentCache.set(cacheKey, result)
      setInfo(result)
    } catch (e) {
      console.error("Error fetching equipment info:", e)
    } finally {
      setLoaded(true)
    }
  }

  const handleMouseEnter = () => {
    setHovered(true)
    fetchInfo()
  }

  if (!name || name === "-") return <span>{name || "-"}</span>

  return (
    <TooltipBox
      visible={hovered && loaded && !!info}
      content={
        info ? (
          <div className="space-y-1.5">
            <div className="font-semibold text-sm text-gray-900 border-b pb-1">
              {info.name_official || info.name_legacy || name}
            </div>
            {info.name_short && (
              <div><span className="text-gray-500">약칭:</span> {info.name_short}</div>
            )}
            {info.name_legacy && info.name_legacy !== info.name_official && (
              <div><span className="text-gray-500">레거시명:</span> {info.name_legacy}</div>
            )}
            {info.manufacturer && (
              <div><span className="text-gray-500">제조사:</span> {info.manufacturer}</div>
            )}
            {info.country && (
              <div><span className="text-gray-500">생산국:</span> {info.country}</div>
            )}
            {info.note && (
              <div><span className="text-gray-500">비고:</span> {info.note}</div>
            )}
            <div><span className="text-gray-500">설비 ID:</span> {info.equipment_id}</div>
          </div>
        ) : null
      }
    >
      <span
        className="cursor-help border-b border-dashed border-gray-400 hover:border-blue-500 hover:text-blue-600 transition-colors"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setHovered(false)}
      >
        {name}
      </span>
    </TooltipBox>
  )
}

export function ProductNameTooltip({ name }: { name: string }) {
  const { factory } = useFactory()
  const [info, setInfo] = useState<ProductInfo | null>(null)
  const [hovered, setHovered] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const fetchInfo = async () => {
    if (loaded) return
    const cacheKey = `${factory}:${name}`
    if (productCache.has(cacheKey)) {
      setInfo(productCache.get(cacheKey) || null)
      setLoaded(true)
      return
    }

    try {
      const { data } = await supabase
        .from("dim_product")
        .select("*")
        .eq("factory", factory)
        .eq("product_name", name)
        .limit(1)

      const result = data && data.length > 0 ? data[0] as ProductInfo : null
      productCache.set(cacheKey, result)
      setInfo(result)
    } catch (e) {
      console.error("Error fetching product info:", e)
    } finally {
      setLoaded(true)
    }
  }

  const handleMouseEnter = () => {
    setHovered(true)
    fetchInfo()
  }

  if (!name || name === "-") return <span>{name || "-"}</span>

  return (
    <TooltipBox
      visible={hovered && loaded && !!info}
      content={
        info ? (
          <div className="space-y-1.5">
            <div className="font-semibold text-sm text-gray-900 border-b pb-1">
              {info.product_name || name}
            </div>
            {info.product_code && (
              <div><span className="text-gray-500">제품코드:</span> {info.product_code}</div>
            )}
            {info.raw_material && (
              <div><span className="text-gray-500">원재료:</span> {info.raw_material}</div>
            )}
            {info.pack_qty != null && (
              <div><span className="text-gray-500">포장수량:</span> {formatNumber(info.pack_qty)}</div>
            )}
            {info.rpm != null && (
              <div><span className="text-gray-500">RPM:</span> {info.rpm}</div>
            )}
            {info.daily_max_qty != null && (
              <div><span className="text-gray-500">일 기준량:</span> {formatNumber(info.daily_max_qty)}</div>
            )}
            {info.equipment_name && (
              <div><span className="text-gray-500">생산설비:</span> {info.equipment_name}</div>
            )}
          </div>
        ) : null
      }
    >
      <span
        className="cursor-help border-b border-dashed border-gray-400 hover:border-blue-500 hover:text-blue-600 transition-colors"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setHovered(false)}
      >
        {name}
      </span>
    </TooltipBox>
  )
}
