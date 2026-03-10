'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ErpItem } from '@/types/database'
import { DataTable, Column } from '@/components/common/data-table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { formatNumber } from '@/lib/utils'

const columns: Column<ErpItem>[] = [
  { key: 'item_code', label: '품목코드', sortable: true, searchable: true },
  { key: 'item_name', label: '품명', sortable: true, searchable: true },
  { key: 'category_large', label: '대분류', sortable: true },
  { key: 'category_medium', label: '중분류', sortable: true },
  { key: 'category_small', label: '소분류', sortable: true },
  { key: 'spec', label: '규격', sortable: true },
  { key: 'tax_type', label: '과세유형', sortable: true },
  { key: 'purchase_price', label: '매입단가', sortable: true, format: (v) => formatNumber(v || 0) },
  { key: 'sales_price', label: '매출단가', sortable: true, format: (v) => formatNumber(v || 0) },
  { key: 'is_discontinued', label: '단종', sortable: true, format: (v) => v === 1 ? '예' : '아니오' },
]

interface FormData extends Partial<ErpItem> {}

interface CategoryOptions {
  large: string[]
  medium: Record<string, string[]>
  small: Record<string, string[]>
}

export default function ErpItemsPage() {
  const [items, setItems] = useState<ErpItem[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<ErpItem | null>(null)
  const [formData, setFormData] = useState<FormData>({})
  const [categories, setCategories] = useState<CategoryOptions>({
    large: [],
    medium: {},
    small: {},
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('dim_erp_item')
        .select('*')
        .order('item_code')

      if (error) throw error
      setItems(data || [])

      // Extract unique categories
      const largeSet = new Set<string>()
      const mediumMap: Record<string, Set<string>> = {}
      const smallMap: Record<string, Set<string>> = {}

      ;(data || []).forEach((item) => {
        if (item.category_large) {
          largeSet.add(item.category_large)
          if (!mediumMap[item.category_large]) {
            mediumMap[item.category_large] = new Set()
          }
          if (item.category_medium) {
            mediumMap[item.category_large].add(item.category_medium)
            if (!smallMap[item.category_medium]) {
              smallMap[item.category_medium] = new Set()
            }
            if (item.category_small) {
              smallMap[item.category_medium].add(item.category_small)
            }
          }
        }
      })

      setCategories({
        large: Array.from(largeSet).sort(),
        medium: Object.fromEntries(
          Object.entries(mediumMap).map(([key, val]) => [key, Array.from(val).sort()])
        ),
        small: Object.fromEntries(
          Object.entries(smallMap).map(([key, val]) => [key, Array.from(val).sort()])
        ),
      })
    } catch (err) {
      console.error('Failed to fetch items:', err)
      window.alert('데이터를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleNew = () => {
    setEditingItem(null)
    setFormData({ item_code: '', is_discontinued: 0 })
    setDialogOpen(true)
  }

  const handleEdit = (item: ErpItem) => {
    setEditingItem(item)
    setFormData(item)
    setDialogOpen(true)
  }

  const handleDelete = async (item: ErpItem) => {
    try {
      const { error } = await supabase
        .from('dim_erp_item')
        .delete()
        .eq('item_code', item.item_code)

      if (error) throw error
      window.alert('품목이 삭제되었습니다.')
      await fetchData()
    } catch (err) {
      console.error('Failed to delete item:', err)
      window.alert('품목 삭제에 실패했습니다.')
    }
  }

  const handleSave = async () => {
    if (!formData.item_code) {
      window.alert('품목코드는 필수입니다.')
      return
    }

    try {
      if (editingItem) {
        const { error } = await supabase
          .from('dim_erp_item')
          .update(formData)
          .eq('item_code', editingItem.item_code)

        if (error) throw error
        window.alert('품목이 수정되었습니다.')
      } else {
        const { error } = await supabase
          .from('dim_erp_item')
          .insert([formData])

        if (error) throw error
        window.alert('품목이 추가되었습니다.')
      }

      setDialogOpen(false)
      await fetchData()
    } catch (err) {
      console.error('Failed to save item:', err)
      window.alert('품목 저장에 실패했습니다.')
    }
  }

  const getMediumOptions = () => {
    if (!formData.category_large) return []
    return categories.medium[formData.category_large] || []
  }

  const getSmallOptions = () => {
    if (!formData.category_medium) return []
    return categories.small[formData.category_medium] || []
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">ERP 품목 관리</h1>
        <p className="text-gray-600 mt-2">ERP 품목 정보를 관리합니다.</p>
      </div>

      <DataTable<ErpItem>
        columns={columns}
        data={items}
        loading={loading}
        onNew={handleNew}
        onEdit={handleEdit}
        onDelete={handleDelete}
        searchableFields={['item_code', 'item_name']}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? '품목 수정' : '품목 추가'}
            </DialogTitle>
            <DialogDescription>
              품목 정보를 입력하세요.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="item_code">품목코드</Label>
              <Input
                id="item_code"
                value={formData.item_code || ''}
                onChange={(e) =>
                  setFormData({ ...formData, item_code: e.target.value })
                }
                disabled={!!editingItem}
                placeholder="예: I001"
              />
            </div>

            <div>
              <Label htmlFor="item_name">품명</Label>
              <Input
                id="item_name"
                value={formData.item_name || ''}
                onChange={(e) =>
                  setFormData({ ...formData, item_name: e.target.value || null })
                }
                placeholder="예: 상품명"
              />
            </div>

            <div>
              <Label htmlFor="category_large">대분류</Label>
              <Select
                value={formData.category_large || '__none__'}
                onValueChange={(value) => {
                  setFormData({
                    ...formData,
                    category_large: value === '__none__' ? null : value,
                    category_medium: null,
                    category_small: null,
                  })
                }}
              >
                <SelectTrigger id="category_large">
                  <SelectValue placeholder="대분류 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">선택 안 함</SelectItem>
                  {categories.large.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="category_medium">중분류</Label>
              <Select
                value={formData.category_medium || '__none__'}
                onValueChange={(value) => {
                  setFormData({
                    ...formData,
                    category_medium: value === '__none__' ? null : value,
                    category_small: null,
                  })
                }}
                disabled={!formData.category_large}
              >
                <SelectTrigger id="category_medium">
                  <SelectValue placeholder="중분류 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">선택 안 함</SelectItem>
                  {getMediumOptions().map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="category_small">소분류</Label>
              <Select
                value={formData.category_small || '__none__'}
                onValueChange={(value) => {
                  setFormData({
                    ...formData,
                    category_small: value === '__none__' ? null : value,
                  })
                }}
                disabled={!formData.category_medium}
              >
                <SelectTrigger id="category_small">
                  <SelectValue placeholder="소분류 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">선택 안 함</SelectItem>
                  {getSmallOptions().map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="spec">규격</Label>
              <Input
                id="spec"
                value={formData.spec || ''}
                onChange={(e) =>
                  setFormData({ ...formData, spec: e.target.value || null })
                }
                placeholder="예: 10x10cm"
              />
            </div>

            <div>
              <Label htmlFor="tax_type">과세유형</Label>
              <Select
                value={formData.tax_type || '__none__'}
                onValueChange={(value) => {
                  setFormData({ ...formData, tax_type: value === '__none__' ? null : value })
                }}
              >
                <SelectTrigger id="tax_type">
                  <SelectValue placeholder="과세유형 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">선택 안 함</SelectItem>
                  <SelectItem value="과세">과세</SelectItem>
                  <SelectItem value="면세">면세</SelectItem>
                  <SelectItem value="영세">영세</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="purchase_price">매입단가</Label>
              <Input
                id="purchase_price"
                type="number"
                value={formData.purchase_price || ''}
                onChange={(e) =>
                  setFormData({ ...formData, purchase_price: e.target.value ? parseInt(e.target.value) : null })
                }
                placeholder="0"
              />
            </div>

            <div>
              <Label htmlFor="sales_price">매출단가</Label>
              <Input
                id="sales_price"
                type="number"
                value={formData.sales_price || ''}
                onChange={(e) =>
                  setFormData({ ...formData, sales_price: e.target.value ? parseInt(e.target.value) : null })
                }
                placeholder="0"
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="is_discontinued"
                checked={formData.is_discontinued === 1}
                onCheckedChange={(checked) => {
                  setFormData({ ...formData, is_discontinued: checked ? 1 : 0 })
                }}
              />
              <Label htmlFor="is_discontinued" className="cursor-pointer">
                단종
              </Label>
            </div>

            <div>
              <Label htmlFor="note">비고</Label>
              <Textarea
                id="note"
                value={formData.note || ''}
                onChange={(e) =>
                  setFormData({ ...formData, note: e.target.value || null })
                }
                placeholder="추가 설명"
                className="resize-none"
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              취소
            </Button>
            <Button onClick={handleSave}>
              {editingItem ? '수정' : '추가'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
