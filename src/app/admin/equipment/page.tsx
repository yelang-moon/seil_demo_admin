'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Equipment } from '@/types/database'
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
import { useFactory } from '@/contexts/factory-context'

const columns: Column<Equipment>[] = [
  { key: 'equipment_id', label: '설비ID', sortable: true, searchable: true },
  { key: 'name_legacy', label: '기존명', sortable: true, searchable: true },
  { key: 'name_official', label: '공식명', sortable: true, searchable: true },
  { key: 'name_short', label: '약칭', sortable: true },
  { key: 'note', label: '비고', sortable: false },
  { key: 'manufacturer', label: '제조사', sortable: true },
  { key: 'country', label: '제조국', sortable: true },
]

interface FormData extends Partial<Equipment> {}

export default function EquipmentPage() {
  const { factory } = useFactory()
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Equipment | null>(null)
  const [formData, setFormData] = useState<FormData>({})

  useEffect(() => {
    fetchEquipment()
  }, [factory])

  const fetchEquipment = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('dim_equipment')
        .select('*')
        .eq('factory', factory)
        .order('equipment_id', { ascending: true })

      if (error) throw error
      setEquipment(data || [])
    } catch (err) {
      console.error('Failed to fetch equipment:', err)
      window.alert('설비 데이터를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const getNextEquipmentId = () => {
    if (equipment.length === 0) return 1
    return Math.max(...equipment.map(e => e.equipment_id)) + 1
  }

  const handleNew = () => {
    setEditingItem(null)
    setFormData({ equipment_id: getNextEquipmentId(), factory })
    setDialogOpen(true)
  }

  const handleEdit = (item: Equipment) => {
    setEditingItem(item)
    setFormData(item)
    setDialogOpen(true)
  }

  const handleDelete = async (item: Equipment) => {
    try {
      const { error } = await supabase
        .from('dim_equipment')
        .delete()
        .eq('equipment_id', item.equipment_id)

      if (error) throw error
      window.alert('설비가 삭제되었습니다.')
      await fetchEquipment()
    } catch (err) {
      console.error('Failed to delete equipment:', err)
      window.alert('설비 삭제에 실패했습니다.')
    }
  }

  const handleSave = async () => {
    if (!formData.equipment_id) {
      window.alert('설비ID는 필수입니다.')
      return
    }

    try {
      if (editingItem) {
        const { error } = await supabase
          .from('dim_equipment')
          .update(formData)
          .eq('equipment_id', editingItem.equipment_id)

        if (error) throw error
        window.alert('설비가 수정되었습니다.')
      } else {
        const { error } = await supabase
          .from('dim_equipment')
          .insert([formData])

        if (error) throw error
        window.alert('설비가 추가되었습니다.')
      }

      setDialogOpen(false)
      await fetchEquipment()
    } catch (err) {
      console.error('Failed to save equipment:', err)
      window.alert('설비 저장에 실패했습니다.')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">설비 관리</h1>
        <p className="text-gray-600 mt-2">설비 정보를 관리합니다.</p>
      </div>

      <DataTable<Equipment>
        columns={columns}
        data={equipment}
        loading={loading}
        onNew={handleNew}
        onEdit={handleEdit}
        onDelete={handleDelete}
        searchableFields={['equipment_id', 'name_legacy', 'name_official']}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? '설비 수정' : '설비 추가'}
            </DialogTitle>
            <DialogDescription>
              설비 정보를 입력하세요.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="equipment_id">설비ID</Label>
              <Input
                id="equipment_id"
                type="number"
                value={formData.equipment_id || ''}
                onChange={(e) =>
                  setFormData({ ...formData, equipment_id: parseInt(e.target.value) || 0 })
                }
                disabled={!!editingItem}
              />
            </div>

            <div>
              <Label htmlFor="name_legacy">기존명</Label>
              <Input
                id="name_legacy"
                value={formData.name_legacy || ''}
                onChange={(e) =>
                  setFormData({ ...formData, name_legacy: e.target.value || null })
                }
                placeholder="예: 기계1"
              />
            </div>

            <div>
              <Label htmlFor="name_official">공식명</Label>
              <Input
                id="name_official"
                value={formData.name_official || ''}
                onChange={(e) =>
                  setFormData({ ...formData, name_official: e.target.value || null })
                }
                placeholder="예: 프레스 기계"
              />
            </div>

            <div>
              <Label htmlFor="name_short">약칭</Label>
              <Input
                id="name_short"
                value={formData.name_short || ''}
                onChange={(e) =>
                  setFormData({ ...formData, name_short: e.target.value || null })
                }
                placeholder="예: PR-1"
              />
            </div>

            <div>
              <Label htmlFor="manufacturer">제조사</Label>
              <Input
                id="manufacturer"
                value={formData.manufacturer || ''}
                onChange={(e) =>
                  setFormData({ ...formData, manufacturer: e.target.value || null })
                }
                placeholder="예: 삼성"
              />
            </div>

            <div>
              <Label htmlFor="country">제조국</Label>
              <Input
                id="country"
                value={formData.country || ''}
                onChange={(e) =>
                  setFormData({ ...formData, country: e.target.value || null })
                }
                placeholder="예: 한국"
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
