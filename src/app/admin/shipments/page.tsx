'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { Shipment, Product } from '@/types/database'
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { formatNumber } from '@/lib/utils'
import { Check, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useFactory } from '@/contexts/factory-context'

const CUSTOMERS = [
  '쿠팡',
  '네이버스토어',
  '11번가',
  'SSG.COM',
  '옥션',
  '지마켓',
  '아마존',
  '직접출하',
]

const columns: Column<Shipment>[] = [
  { key: 'shipment_date', label: '출하일', sortable: true, searchable: true },
  { key: 'product_name', label: '제품명', sortable: true, searchable: true },
  { key: 'shipped_qty', label: '출하수량', sortable: true, format: (v) => formatNumber(v || 0) },
  { key: 'customer_name', label: '고객사', sortable: true, searchable: true },
  { key: 'order_number', label: '주문번호', sortable: true, searchable: true },
  { key: 'equipment_name', label: '설비명', sortable: true },
]

interface FormData extends Partial<Shipment> {}

export default function ShipmentsPage() {
  const { factory } = useFactory()
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Shipment | null>(null)
  const [formData, setFormData] = useState<FormData>({})
  const [productOpen, setProductOpen] = useState(false)
  const [productSearch, setProductSearch] = useState('')

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [shipmentsRes, productsRes] = await Promise.all([
        supabase
          .from('fact_shipment')
          .select('*')
          .eq('factory', factory)
          .order('shipment_date', { ascending: false })
          .limit(500),
        supabase
          .from('dim_product')
          .select('id, product_code, product_name, equipment_name')
          .eq('factory', factory)
          .order('product_name'),
      ])

      if (shipmentsRes.error) throw shipmentsRes.error
      if (productsRes.error) throw productsRes.error

      setShipments(shipmentsRes.data || [])
      setProducts(productsRes.data || [])
    } catch (err) {
      console.error('Failed to fetch data:', err)
      window.alert('데이터를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }, [factory])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleNew = () => {
    setEditingItem(null)
    const today = new Date()
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    setFormData({
      shipment_date: dateStr,
      factory,
      customer_name: '쿠팡',
    })
    setDialogOpen(true)
  }

  const handleEdit = (item: Shipment) => {
    setEditingItem(item)
    setFormData(item)
    setDialogOpen(true)
  }

  const handleDelete = async (item: Shipment) => {
    try {
      const { error } = await supabase
        .from('fact_shipment')
        .delete()
        .eq('id', item.id)

      if (error) throw error
      window.alert('출하 기록이 삭제되었습니다.')
      await fetchData()
    } catch (err) {
      console.error('Failed to delete shipment:', err)
      window.alert('출하 기록 삭제에 실패했습니다.')
    }
  }

  const handleSave = async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, ...saveData } = formData as any
      if (editingItem) {
        const { error } = await supabase
          .from('fact_shipment')
          .update(saveData)
          .eq('id', editingItem.id)

        if (error) throw error
        window.alert('출하 기록이 수정되었습니다.')
      } else {
        const { error } = await supabase
          .from('fact_shipment')
          .insert([saveData])

        if (error) throw error
        window.alert('출하 기록이 추가되었습니다.')
      }

      setDialogOpen(false)
      await fetchData()
    } catch (err) {
      console.error('Failed to save shipment:', err)
      window.alert('출하 기록 저장에 실패했습니다.')
    }
  }

  const selectProduct = (product: Product) => {
    setFormData({
      ...formData,
      product_code: product.product_code,
      product_name: product.product_name,
      equipment_name: product.equipment_name,
    })
    setProductOpen(false)
    setProductSearch('')
  }

  const filteredProducts = products.filter(
    (p) =>
      !productSearch ||
      (p.product_name || '').toLowerCase().includes(productSearch.toLowerCase()) ||
      (p.product_code || '').toLowerCase().includes(productSearch.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">출하량 관리</h1>
        <p className="text-gray-600 mt-2">출하 기록을 관리합니다.</p>
      </div>

      <DataTable<Shipment>
        columns={columns}
        data={shipments}
        loading={loading}
        onNew={handleNew}
        onEdit={handleEdit}
        onDelete={handleDelete}
        searchableFields={['product_name', 'customer_name', 'order_number']}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? '출하 기록 수정' : '출하 기록 추가'}
            </DialogTitle>
            <DialogDescription>
              출하 정보를 입력하세요.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="shipment_date">출하일</Label>
              <Input
                id="shipment_date"
                type="date"
                value={formData.shipment_date || ''}
                onChange={(e) =>
                  setFormData({ ...formData, shipment_date: e.target.value })
                }
              />
            </div>

            <div>
              <Label>제품</Label>
              <Popover open={productOpen} onOpenChange={setProductOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={productOpen}
                    className="w-full justify-between"
                  >
                    {formData.product_name ? (
                      <span className="truncate">{formData.product_name}</span>
                    ) : (
                      <span className="text-gray-500">제품 선택...</span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <div className="p-2 border-b">
                    <Input
                      placeholder="제품 검색..."
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      className="h-8"
                    />
                  </div>
                  <div className="p-2 space-y-1 max-h-48 overflow-y-auto">
                    {filteredProducts.map((product) => (
                      <button
                        key={product.id}
                        onClick={() => selectProduct(product)}
                        className={cn(
                          'w-full text-left px-2 py-2 rounded text-sm flex items-center gap-2 hover:bg-gray-100',
                          formData.product_name === product.product_name && 'bg-blue-100'
                        )}
                      >
                        {formData.product_name === product.product_name && (
                          <Check className="h-4 w-4 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <div className="truncate">{product.product_name}</div>
                          <div className="text-xs text-gray-500">{product.product_code}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Label htmlFor="shipped_qty">출하수량</Label>
              <Input
                id="shipped_qty"
                type="number"
                value={formData.shipped_qty || ''}
                onChange={(e) =>
                  setFormData({ ...formData, shipped_qty: e.target.value ? parseInt(e.target.value) : null })
                }
                placeholder="0"
              />
            </div>

            <div>
              <Label>고객사</Label>
              <Select
                value={formData.customer_name || ''}
                onValueChange={(v) => setFormData({ ...formData, customer_name: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="고객사 선택..." />
                </SelectTrigger>
                <SelectContent>
                  {CUSTOMERS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="order_number">주문번호</Label>
              <Input
                id="order_number"
                value={formData.order_number || ''}
                onChange={(e) =>
                  setFormData({ ...formData, order_number: e.target.value || null })
                }
                placeholder="예: ORD-20260310-00001"
              />
            </div>

            <div>
              <Label htmlFor="note">비고</Label>
              <Textarea
                id="note"
                value={formData.note || ''}
                onChange={(e) =>
                  setFormData({ ...formData, note: e.target.value || null })
                }
                placeholder="메모"
                rows={2}
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
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
