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
    // Parse YYYY-MM-DD parts directly to avoid timezone issues
    const [y, m, d] = value.split("-").map(Number)
    const date = new Date(y, m - 1, d + days)
    const newY = date.getFullYear()
    const newM = String(date.getMonth() + 1).padStart(2, "0")
    const newD = String(date.getDate()).padStart(2, "0")
    onChange(`${newY}-${newM}-${newD}`)
  }

  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return "날짜 선택"
    const [y, m, d] = dateStr.split("-").map(Number)
    const date = new Date(y, m - 1, d)
    const dayNames = ["일", "월", "화", "수", "목", "금", "토"]
    const dayName = dayNames[date.getDay()]
    return `${y}.${String(m).padStart(2, "0")}.${String(d).padStart(2, "0")} (${dayName})`
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
      <div className="relative">
        <div
          className="px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium cursor-pointer hover:bg-gray-50 min-w-[160px] text-center select-none"
          onClick={() => setShowPicker((prev) => !prev)}
        >
          {formatDisplayDate(value)}
        </div>
        {showPicker && (
          <div className="absolute top-full left-0 mt-1 z-50 bg-white shadow-lg rounded-md border p-2">
            <input
              type="date"
              value={value}
              onChange={(e) => { onChange(e.target.value); setShowPicker(false) }}
              className="px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              autoFocus
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
