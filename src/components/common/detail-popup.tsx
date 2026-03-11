"use client"

import { useState, useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export interface DetailPopupProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  columns: {
    key: string
    label: string
    cellClassName?: (value: any, row: Record<string, any>) => string
  }[]
  data: Record<string, any>[]
}

type SortDir = "asc" | "desc" | null

export function DetailPopup({
  open,
  onOpenChange,
  title,
  columns,
  data,
}: DetailPopupProps) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>(null)

  const handleSort = (key: string) => {
    if (sortKey === key) {
      // Cycle: asc -> desc -> null
      if (sortDir === "asc") setSortDir("desc")
      else if (sortDir === "desc") { setSortKey(null); setSortDir(null) }
      else { setSortDir("asc") }
    } else {
      setSortKey(key)
      setSortDir("asc")
    }
  }

  const sortedData = useMemo(() => {
    if (!sortKey || !sortDir) return data

    return [...data].sort((a, b) => {
      let valA = a[sortKey]
      let valB = b[sortKey]

      // Try to parse as numbers (handle formatted numbers like "1,234")
      const numA = typeof valA === "string" ? parseFloat(valA.replace(/,/g, "")) : valA
      const numB = typeof valB === "string" ? parseFloat(valB.replace(/,/g, "")) : valB

      if (!isNaN(numA) && !isNaN(numB)) {
        return sortDir === "asc" ? numA - numB : numB - numA
      }

      // Fallback to string comparison
      const strA = String(valA ?? "")
      const strB = String(valB ?? "")
      return sortDir === "asc"
        ? strA.localeCompare(strB, "ko")
        : strB.localeCompare(strA, "ko")
    })
  }, [data, sortKey, sortDir])

  const getSortIcon = (key: string) => {
    if (sortKey !== key) return " ↕"
    if (sortDir === "asc") return " ↑"
    if (sortDir === "desc") return " ↓"
    return " ↕"
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setSortKey(null); setSortDir(null) } }}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="overflow-auto flex-1">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((col) => (
                  <TableHead
                    key={col.key}
                    className="cursor-pointer select-none hover:bg-gray-100 transition-colors whitespace-nowrap"
                    onClick={() => handleSort(col.key)}
                  >
                    {col.label}
                    <span className="text-xs text-gray-400">{getSortIcon(col.key)}</span>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-center py-4 text-gray-500">
                    데이터가 없습니다
                  </TableCell>
                </TableRow>
              ) : (
                sortedData.map((row, idx) => (
                  <TableRow key={idx}>
                    {columns.map((col) => (
                      <TableCell key={col.key} className={col.cellClassName ? col.cellClassName(row[col.key], row) : undefined}>
                        {row[col.key] ?? "-"}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  )
}
