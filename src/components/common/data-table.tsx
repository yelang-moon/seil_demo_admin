'use client'

import React, { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { ChevronUp, ChevronDown, Search, Plus, Edit2, Trash2 } from 'lucide-react'

export interface Column<T> {
  key: keyof T
  label: string
  sortable?: boolean
  searchable?: boolean
  width?: string
  format?: (value: any) => string | React.ReactNode
  hideMobile?: boolean
}

interface DataTableProps<T extends Record<string, any>> {
  columns: Column<T>[]
  data: T[]
  searchableFields?: (keyof T)[]
  onEdit?: (item: T) => void
  onDelete?: (item: T) => void
  onNew?: () => void
  loading?: boolean
  itemsPerPage?: number
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  searchableFields = [],
  onEdit,
  onDelete,
  onNew,
  loading = false,
  itemsPerPage = 20,
}: DataTableProps<T>) {
  const [searchTerm, setSearchTerm] = useState('')
  const [sortConfig, setSortConfig] = useState<{
    key: keyof T
    direction: 'asc' | 'desc'
  } | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [isMobile, setIsMobile] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<T | null>(null)

  // Detect mobile on mount and resize
  React.useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Filter data
  const filteredData = useMemo(() => {
    if (!searchTerm) return data

    return data.filter((item) => {
      const fieldsToSearch = searchableFields.length > 0 ? searchableFields : columns.map(c => c.key)
      return fieldsToSearch.some((field) => {
        const value = item[field]
        if (value === null || value === undefined) return false
        return String(value).toLowerCase().includes(searchTerm.toLowerCase())
      })
    })
  }, [data, searchTerm, searchableFields, columns])

  // Sort data
  const sortedData = useMemo(() => {
    const sorted = [...filteredData]
    if (!sortConfig) return sorted

    sorted.sort((a, b) => {
      const aValue = a[sortConfig.key]
      const bValue = b[sortConfig.key]

      if (aValue === null || aValue === undefined) return 1
      if (bValue === null || bValue === undefined) return -1

      if (typeof aValue === 'string') {
        return sortConfig.direction === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue)
      }

      return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue
    })

    return sorted
  }, [filteredData, sortConfig])

  // Paginate
  const paginatedData = useMemo(() => {
    const startIdx = (currentPage - 1) * itemsPerPage
    return sortedData.slice(startIdx, startIdx + itemsPerPage)
  }, [sortedData, currentPage, itemsPerPage])

  const totalPages = Math.ceil(sortedData.length / itemsPerPage)

  const handleSort = (key: keyof T) => {
    const sortableColumn = columns.find(c => c.key === key && c.sortable)
    if (!sortableColumn) return

    setSortConfig((prev) => {
      if (prev?.key === key) {
        return {
          key,
          direction: prev.direction === 'asc' ? 'desc' : 'asc',
        }
      }
      return { key, direction: 'asc' }
    })
  }

  const handleDelete = (item: T) => {
    setDeleteConfirm(item)
  }

  const confirmDelete = () => {
    if (deleteConfirm && onDelete) {
      onDelete(deleteConfirm)
      setDeleteConfirm(null)
    }
  }

  if (isMobile) {
    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="검색..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setCurrentPage(1)
              }}
              className="pl-8"
            />
          </div>
          {onNew && (
            <Button onClick={onNew} size="sm">
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="space-y-2">
          {paginatedData.map((item, idx) => (
            <Card key={idx}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-sm">
                    {columns[0]?.format
                      ? columns[0].format(item[columns[0].key])
                      : item[columns[0]?.key]}
                  </CardTitle>
                  <div className="flex gap-1">
                    {onEdit && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onEdit(item)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    )}
                    {onDelete && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(item)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-1 text-xs">
                {columns.slice(1).map((col) => (
                  !col.hideMobile && (
                    <div key={String(col.key)} className="flex justify-between">
                      <span className="text-gray-600">{col.label}</span>
                      <span className="font-medium">
                        {col.format
                          ? col.format(item[col.key])
                          : item[col.key] === null || item[col.key] === undefined
                            ? '-'
                            : String(item[col.key])}
                      </span>
                    </div>
                  )
                ))}
              </CardContent>
            </Card>
          ))}
        </div>

        {totalPages > 1 && (
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600">
              {currentPage} / {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                이전
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                다음
              </Button>
            </div>
          </div>
        )}

        {deleteConfirm && (
          <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>삭제 확인</DialogTitle>
                <DialogDescription>정말로 이 항목을 삭제하시겠습니까?</DialogDescription>
              </DialogHeader>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setDeleteConfirm(null)}
                >
                  취소
                </Button>
                <Button
                  variant="destructive"
                  onClick={confirmDelete}
                >
                  삭제
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    )
  }

  // Desktop view
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="검색..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setCurrentPage(1)
            }}
            className="pl-8"
          />
        </div>
        {onNew && (
          <Button onClick={onNew}>
            <Plus className="h-4 w-4 mr-2" />
            추가
          </Button>
        )}
      </div>

      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              {columns.map((col) => (
                <TableHead
                  key={String(col.key)}
                  className={cn(
                    'text-center font-semibold text-gray-700',
                    col.width,
                    col.sortable && 'cursor-pointer hover:bg-gray-100'
                  )}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <div className="flex items-center justify-center gap-1">
                    {col.label}
                    {col.sortable && (
                      <span className="inline-block">
                        {sortConfig?.key === col.key ? (
                          sortConfig.direction === 'asc' ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )
                        ) : (
                          <ChevronUp className="h-4 w-4 opacity-30" />
                        )}
                      </span>
                    )}
                  </div>
                </TableHead>
              ))}
              <TableHead className="text-center font-semibold text-gray-700 w-24">작업</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + 1}
                  className="text-center py-8 text-gray-500"
                >
                  데이터가 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.map((item, idx) => (
                <TableRow key={idx} className="hover:bg-gray-50">
                  {columns.map((col) => (
                    <TableCell key={String(col.key)} className="text-center py-3">
                      {col.format
                        ? col.format(item[col.key])
                        : item[col.key] === null || item[col.key] === undefined
                          ? '-'
                          : String(item[col.key])}
                    </TableCell>
                  ))}
                  <TableCell className="text-center py-3">
                    <div className="flex gap-1 justify-center">
                      {onEdit && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onEdit(item)}
                          className="h-8 w-8 p-0"
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      )}
                      {onDelete && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(item)}
                          className="h-8 w-8 p-0"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-600">
            전체 {sortedData.length}개 중 {(currentPage - 1) * itemsPerPage + 1}-
            {Math.min(currentPage * itemsPerPage, sortedData.length)}개 표시
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              이전
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <Button
                key={page}
                size="sm"
                variant={currentPage === page ? 'default' : 'outline'}
                onClick={() => setCurrentPage(page)}
                className="w-8"
              >
                {page}
              </Button>
            ))}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              다음
            </Button>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>삭제 확인</DialogTitle>
              <DialogDescription>정말로 이 항목을 삭제하시겠습니까?</DialogDescription>
            </DialogHeader>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => setDeleteConfirm(null)}
              >
                취소
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDelete}
              >
                삭제
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
