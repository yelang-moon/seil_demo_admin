"use client"

import { useState, useRef, useEffect } from "react"

interface DateNavigatorProps {
  value: string
  onChange: (date: string) => void
}

export function DateNavigator({ value, onChange }: DateNavigatorProps) {
  const [showPicker, setShowPicker] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowPicker(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const shiftDate = (days: number) => {
    if (!value) return
    const d = new Date(value + "T00:00:00")
    d.setDate(d.getDate() + days)
    onChange(d.toISOString().split("T")[0])
  }

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return "날짜 선택"
    const d = new Date(dateStr + "T00:00:00")
    const dayNames = ["일", "월", "화", "수", "목", "금", "토"]
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    const dayName = dayNames[d.getDay()]
    return `${year}.${month}.${day} (${dayName})`
  }

  return (
    <div ref={containerRef} className="flex items-center gap-1">
      <button
        onClick={() => shiftDate(-1)}
        className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 text-gray-600 transition-colors text-lg"
        title="이전 날짜"
      >
        ‹
      </button>
      <div
        className="relative"
        onMouseEnter={() => setShowPicker(true)}
        onMouseLeave={() => setShowPicker(false)}
      >
        <div className="px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium cursor-pointer hover:bg-gray-50 min-w-[160px] text-center">
          {formatDisplayDate(value)}
        </div>
        {showPicker && (
          <div className="absolute top-full left-0 mt-1 z-50 bg-white shadow-lg rounded-md border p-2">
            <input
              type="date"
              value={value}
              onChange={(e) => { onChange(e.target.value); setShowPicker(false) }}
              className="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
        )}
      </div>
      <button
        onClick={() => shiftDate(1)}
        className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 text-gray-600 transition-colors text-lg"
        title="다음 날짜"
      >
        ›
      </button>
    </div>
  )
}
