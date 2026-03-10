'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Product, Equipment } from '@/types/database'
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

const columns: Column<Product>[] = [
  { key: 'product_code', label: '제품코드', sortable: true, searchable: true },
  { key: 'product_name', label: '제품명', sortable: true, searchable: true },
  { key: 'pack_qty', label: '입수량', sortable: true, format: (v) => formatNumber(v || 0) },
  { key: 'rpm', label: 'RPM', sortable: true, format: (v) => formatNumber(v || 0) },
  { key: 'equipment_name', label: '설비명', sortable: true },
  { key: 'raw_material', label: '원자재', sortable: true },
  { key: 'daily_max_qty', label: '일최대생산량', sortable: true, format: (v) => formatNumber(v || 0) },
]

interface FormData extends Partial<Product> {}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Product | null>(null)
  const [formData, setFormData] = useState<FormData>({})
  const [equipmentOpen, setEquipmentOpen] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [productsRes, equipmentRes] = await Promise.all([
        supabase.from('dim_product').select('*').order('id'),
        supabase.from('dim_equipment').select('equipment_id, name_official, name_legacy').order('equipment_id') as any,
      ])

      if (productsRes.error) throw productsRes.error
      if (equipmentRes.error) throw equipmentRes.error

      setProducts(productsRes.data || [])
      setEquipment(equipmentRes.data || [])
    } catch (err) {
      console.error('Failed to fetch data:', err)
      window.alert('데이터를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleNew = () => {
    setEditingItem(null)
    setFormData({ product_code: '' })
    setDialogOpen(true)
  }

  const handleEdit = (item: Product) => {
    setEditingItem(item)
    setFormData(item)
    setDialogOpen(true)
  }

  const handleDelete = async (item: Product) => {
    try {
      const { error } = await supabase
        .from('dim_product')
        .delete()
        .eq('id', item.id)

      if (error) throw error
      window.alert('제품이 삭제되었습니다.')
      await fetchData()
    } catch (err) {
      console.error('Failed to delete product:', err)
      window.alert('제품 삭제에 실패했습니다.')
    }
  }

  const handleSave = async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, ...saveData } = formData as any
      if (editingItem) {
        const { error } = await supabase
          .from('dim_product')
          .update(saveData)
          .eq('id', editingItem.id)

        if (error) throw error
        window.alert('제품이 수정되었습니다.')
      } else {
        const { error } = await supabase
          .from('dim_product')
          .insert([saveData])

        if (error) throw error
        window.alert('제품이 추가되었습니다.')
      }

      setDialogOpen(false)
      await fetchData()
    } catch (err) {
      console.error('Failed to save product:', err)
      window.alert('제품 저장에 실패했습니다.')
    }
  }

  const getEquipmentName = (equipmentId: string | null) => {
    if (!equipmentId) return ''
    const equip = equipment.find(e => String(e.equipment_id) === equipmentId)
    return equip?.name_official || equip?.name_legacy || ''
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">제품 관리</h1>
        <p className="text-gray-600 mt-2">제품 정보를 관리합니다.</p>
      </div>

      <DataTable<Product>
        columns={columns}
        data={products}
        loading={loading}
        onNew={handleNew}
        onEdit={handleEdit}
        onDelete={handleDelete}
        searchableFields={['product_code', 'product_name']}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? '제품 수정' : '제품 추가'}
            </DialogTitle>
            <DialogDescription>
              제품 정보를 입력하세요.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="product_code">제품코드</Label>
              <Input
                id="product_code"
                value={formData.product_code || ''}
                onChange={(e) =>
                  setFormData({ ...formData, product_code: e.target.value })
                }
                placeholder="예: P001"
              />
            </div>

            <div>
              <Label htmlFor="product_name">제품명</Label>
              <Input
                id="product_name"
                value={formData.product_name || ''}
                onChange={(e) =>
                  setFormData({ ...formData, product_name: e.target.value || null })
                }
                placeholder="예: 상품A"
              />
            </div>

            <div>
              <Label htmlFor="pack_qty">입수량</Label>
              <Input
                id="pack_qty"
                type="number"
                value={formData.pack_qty || ''}
                onChange={(e) =>
                  setFormData({ ...formData, pack_qty: e.target.value ? parseInt(e.target.value) : null })
                }
                placeholder="0"
              />
            </div>

            <div>
              <Label htmlFor="rpm">RPM</Label>
              <Input
                id="rpm"
                type="number"
                value={formData.rpm || ''}
                onChange={(e) =>
                  setFormData({ ...formData, rpm: e.target.value ? parseInt(e.target.value) : null })
                }
                placeholder="0"
              />
            </div>

            <div>
              <Label>설비명</Label>
              <Popover open={equipmentOpen} onOpenChange={setEquipmentOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={equipmentOpen}
                    className="w-full justify-between"
                  >
                    {formData.equipment_name ? (
                      <span className="truncate">{formData.equipment_name}</span>
                    ) : (
                      <span className="text-gray-500">설비 선택...</span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <div className="p-2 space-y-1 max-h-48 overflow-y-auto">
                    <button
                      onClick={() => {
                        setFormData({ ...formData, equipment_name: null })
                        setEquipmentOpen(false)
                      }}
                      className="w-full text-left px-2 py-2 rounded hover:bg-gray-100 text-sm"
                    >
                      (없음)
                    </button>
                    {equipment.map((equip) => (
                      <button
                        key={equip.equipment_id}
                        onClick={() => {
                          setFormData({
                            ...formData,
                            equipment_name: equip.name_official || equip.name_legacy || '',
                          })
                          setEquipmentOpen(false)
                        }}
                        className={cn(
                          'w-full text-left px-2 py-2 rounded text-sm flex items-center gap-2 hover:bg-gray-100',
                          formData.equipment_name === (equip.name_official || equip.name_legacy) && 'bg-blue-100'
                        )}
                      >
                        {formData.equipment_name === (equip.name_official || equip.name_legacy) && (
                          <Check className="h-4 w-4" />
                        )}
                        {equip.name_official || equip.name_legacy || `설비 ${equip.equipment_id}`}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Label htmlFor="raw_material">원자재</Label>
              <Input
                id="raw_material"
                value={formData.raw_material || ''}
                onChange={(e) =>
                  setFormData({ ...formData, raw_material: e.target.value || null })
                }
                placeholder="예: 플라스틱"
              />
            </div>

            <div>
              <Label htmlFor="daily_max_qty">일최대생산량</Label>
              <Input
                id="daily_max_qty"
                type="number"
                value={formData.daily_max_qty || ''}
                onChange={(e) =>
                  setFormData({ ...formData, daily_max_qty: e.target.value ? parseInt(e.target.value) : null })
                }
                placeholder="0"
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
