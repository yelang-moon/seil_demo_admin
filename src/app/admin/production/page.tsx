'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Production, Product, Equipment } from '@/types/database'
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { formatNumber, formatDate } from '@/lib/utils'
import { Check, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'

const columns: Column<Production>[] = [
  { key: 'production_date', label: '생산일', sortable: true, format: (v) => formatDate(v || '') },
  { key: 'product_name', label: '제품명', sortable: true, searchable: true },
  { key: 'finished_qty', label: '완성수량', sortable: true, format: (v) => formatNumber(v || 0) },
  { key: 'produced_qty', label: '생산수량', sortable: true, format: (v) => formatNumber(v || 0) },
  { key: 'defect_qty', label: '불량수량', sortable: true, format: (v) => formatNumber(v || 0) },
  { key: 'equipment_name', label: '설비', sortable: true },
  { key: 'tech_worker', label: '기술자', sortable: true },
  { key: 'pack_workers', label: '포장자', sortable: true },
]

interface FormData extends Partial<Production> {}

export default function ProductionPage() {
  const [productions, setProductions] = useState<Production[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Production | null>(null)
  const [formData, setFormData] = useState<FormData>({})
  const [productOpen, setProductOpen] = useState(false)
  const [equipmentOpen, setEquipmentOpen] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [productionsRes, productsRes, equipmentRes] = await Promise.all([
        supabase.from('fact_production').select('*').order('production_date', { ascending: false }),
        supabase.from('dim_product').select('*').order('product_code'),
        supabase.from('dim_equipment').select('equipment_id, name_official, name_legacy').order('equipment_id') as any,
      ])

      if (productionsRes.error) throw productionsRes.error
      if (productsRes.error) throw productsRes.error
      if (equipmentRes.error) throw equipmentRes.error

      setProductions(productionsRes.data || [])
      setProducts(productsRes.data || [])
      setEquipment(equipmentRes.data || [])
    } catch (err) {
      console.error('Failed to fetch data:', err)
      window.alert('데이터를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const getTodayDate = () => {
    const today = new Date()
    return today.toISOString().split('T')[0]
  }

  const getYearMonth = (dateStr: string) => {
    if (!dateStr) return ''
    return dateStr.substring(0, 7).replace('-', '')
  }

  const calculateWorkMinutes = (startTime: string, endTime: string) => {
    if (!startTime || !endTime) return 0

    const parseTime = (timeStr: string) => {
      const [hours, minutes] = timeStr.split(':').map(Number)
      return hours * 60 + minutes
    }

    const start = parseTime(startTime)
    const end = parseTime(endTime)
    return Math.max(0, end - start)
  }

  const handleNew = () => {
    const today = getTodayDate()
    setEditingItem(null)
    setFormData({
      production_date: today,
      production_type: '생산',
      year_month: getYearMonth(today),
    })
    setDialogOpen(true)
  }

  const handleEdit = (item: Production) => {
    setEditingItem(item)
    setFormData(item)
    setDialogOpen(true)
  }

  const handleDelete = async (item: Production) => {
    try {
      const { error } = await supabase
        .from('fact_production')
        .delete()
        .eq('id', item.id)

      if (error) throw error
      window.alert('생산 기록이 삭제되었습니다.')
      await fetchData()
    } catch (err) {
      console.error('Failed to delete production:', err)
      window.alert('생산 기록 삭제에 실패했습니다.')
    }
  }

  const handleProductSelect = (product: Product) => {
    setFormData({
      ...formData,
      product_code: product.product_code,
      product_name: product.product_name || '',
      equipment_name: product.equipment_name || '',
    })
    setProductOpen(false)
  }

  const handleProductionDateChange = (date: string) => {
    setFormData({
      ...formData,
      production_date: date,
      year_month: getYearMonth(date),
    })
  }

  const handleWorkTimeChange = (field: 'work_start_hhmm' | 'work_end_hhmm', value: string) => {
    const newData = { ...formData, [field]: value }

    if (field === 'work_start_hhmm') {
      newData.work_start_hhmm = value
    } else {
      newData.work_end_hhmm = value
    }

    if (newData.work_start_hhmm && newData.work_end_hhmm) {
      newData.work_minutes = calculateWorkMinutes(newData.work_start_hhmm, newData.work_end_hhmm)
    }

    setFormData(newData)
  }

  const handleCopyLastRecord = async () => {
    if (!editingItem) {
      const lastRecord = productions[0]
      if (lastRecord) {
        const today = getTodayDate()
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id: _id, ...rest } = lastRecord
        setFormData({
          ...rest,
          production_date: today,
          year_month: getYearMonth(today),
        })
        window.alert('이전 기록이 복사되었습니다.')
      } else {
        window.alert('복사할 이전 기록이 없습니다.')
      }
    }
  }

  const handleSave = async () => {
    if (!formData.production_date) {
      window.alert('생산일은 필수입니다.')
      return
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { id, ...saveData } = formData as any
      if (editingItem) {
        const { error } = await supabase
          .from('fact_production')
          .update(saveData)
          .eq('id', editingItem.id)

        if (error) throw error
        window.alert('생산 기록이 수정되었습니다.')
      } else {
        const { error } = await supabase
          .from('fact_production')
          .insert([saveData])

        if (error) throw error
        window.alert('생산 기록이 추가되었습니다.')
      }

      setDialogOpen(false)
      await fetchData()
    } catch (err) {
      console.error('Failed to save production:', err)
      window.alert('생산 기록 저장에 실패했습니다.')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">생산 관리</h1>
        <p className="text-gray-600 mt-2">생산 기록을 관리합니다.</p>
      </div>

      <DataTable<Production>
        columns={columns}
        data={productions}
        loading={loading}
        onNew={handleNew}
        onEdit={handleEdit}
        onDelete={handleDelete}
        searchableFields={['product_name']}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? '생산 기록 수정' : '생산 기록 추가'}
            </DialogTitle>
            <DialogDescription>
              생산 정보를 입력하세요.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="flex-1">
                <Label htmlFor="production_date">생산일</Label>
                <Input
                  id="production_date"
                  type="date"
                  value={formData.production_date || ''}
                  onChange={(e) => handleProductionDateChange(e.target.value)}
                />
              </div>
              {!editingItem && (
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCopyLastRecord}
                  >
                    이전 기록 복사
                  </Button>
                </div>
              )}
            </div>

            <div>
              <Label>제품코드</Label>
              <Popover open={productOpen} onOpenChange={setProductOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={productOpen}
                    className="w-full justify-between"
                  >
                    {formData.product_code ? (
                      <span className="truncate">{formData.product_code}</span>
                    ) : (
                      <span className="text-gray-500">제품 선택...</span>
                    )}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <div className="p-2 space-y-1 max-h-48 overflow-y-auto">
                    {products.map((product) => (
                      <button
                        key={product.id}
                        onClick={() => handleProductSelect(product)}
                        className={cn(
                          'w-full text-left px-2 py-2 rounded text-sm flex items-center gap-2 hover:bg-gray-100',
                          formData.product_code === product.product_code && 'bg-blue-100'
                        )}
                      >
                        {formData.product_code === product.product_code && (
                          <Check className="h-4 w-4" />
                        )}
                        <div>
                          <div className="font-medium">{product.product_code}</div>
                          <div className="text-xs text-gray-600">{product.product_name}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <Label htmlFor="product_name">제품명</Label>
              <Input
                id="product_name"
                value={formData.product_name || ''}
                onChange={(e) =>
                  setFormData({ ...formData, product_name: e.target.value || null })
                }
                placeholder="자동 입력됨"
                readOnly
                className="bg-gray-50"
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
                    {equipment.map((equip) => {
                      const legacyName = equip.name_legacy || ''
                      const displayName = equip.name_official || equip.name_legacy || `설비 ${equip.equipment_id}`
                      return (
                        <button
                          key={equip.equipment_id}
                          onClick={() => {
                            setFormData({
                              ...formData,
                              equipment_name: legacyName,
                            })
                            setEquipmentOpen(false)
                          }}
                          className={cn(
                            'w-full text-left px-2 py-2 rounded text-sm flex items-center gap-2 hover:bg-gray-100',
                            formData.equipment_name === legacyName && 'bg-blue-100'
                          )}
                        >
                          {formData.equipment_name === legacyName && (
                            <Check className="h-4 w-4" />
                          )}
                          <div>
                            <div>{displayName}</div>
                            {equip.name_official && equip.name_legacy && (
                              <div className="text-xs text-gray-500">{legacyName}</div>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label htmlFor="finished_qty">완성수량</Label>
                <Input
                  id="finished_qty"
                  type="number"
                  value={formData.finished_qty || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, finished_qty: e.target.value ? parseInt(e.target.value) : null })
                  }
                  placeholder="0"
                />
              </div>

              <div>
                <Label htmlFor="produced_qty">생산수량</Label>
                <Input
                  id="produced_qty"
                  type="number"
                  value={formData.produced_qty || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, produced_qty: e.target.value ? parseInt(e.target.value) : null })
                  }
                  placeholder="0"
                />
              </div>

              <div>
                <Label htmlFor="defect_qty">불량수량</Label>
                <Input
                  id="defect_qty"
                  type="number"
                  value={formData.defect_qty || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, defect_qty: e.target.value ? parseInt(e.target.value) : null })
                  }
                  placeholder="0"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="tech_worker">기술자</Label>
              <Input
                id="tech_worker"
                value={formData.tech_worker || ''}
                onChange={(e) =>
                  setFormData({ ...formData, tech_worker: e.target.value || null })
                }
                placeholder="예: 김철수"
              />
            </div>

            <div>
              <Label htmlFor="pack_workers">포장자</Label>
              <Input
                id="pack_workers"
                value={formData.pack_workers || ''}
                onChange={(e) =>
                  setFormData({ ...formData, pack_workers: e.target.value || null })
                }
                placeholder="예: 이영희, 박민지"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label htmlFor="work_start_hhmm">작업시작</Label>
                <Input
                  id="work_start_hhmm"
                  type="time"
                  value={formData.work_start_hhmm || ''}
                  onChange={(e) => handleWorkTimeChange('work_start_hhmm', e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="work_end_hhmm">작업종료</Label>
                <Input
                  id="work_end_hhmm"
                  type="time"
                  value={formData.work_end_hhmm || ''}
                  onChange={(e) => handleWorkTimeChange('work_end_hhmm', e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="work_minutes">작업시간</Label>
                <Input
                  id="work_minutes"
                  type="number"
                  value={formData.work_minutes || ''}
                  readOnly
                  className="bg-gray-50"
                  placeholder="자동 계산"
                />
              </div>
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
