export interface Equipment {
  equipment_id: number
  name_legacy: string | null
  name_official: string | null
  name_short: string | null
  note: string | null
  manufacturer: string | null
  country: string | null
  factory: string | null
}

export interface Product {
  id: number
  product_code: string | null
  product_name: string | null
  pack_qty: number | null
  rpm: number | null
  equipment_name: string | null
  raw_material: string | null
  daily_max_qty: number | null
  safety_stock_qty: number | null
  current_stock_qty: number | null
  factory: string | null
}

export interface Shipment {
  id: number
  shipment_date: string | null
  product_code: string | null
  product_name: string | null
  equipment_name: string | null
  shipped_qty: number | null
  customer_name: string | null
  order_number: string | null
  factory: string | null
  note: string | null
}

export interface ErpItem {
  item_code: string
  item_name: string | null
  category_large: string | null
  category_medium: string | null
  category_small: string | null
  spec: string | null
  tax_type: string | null
  purchase_price: number | null
  sales_price: number | null
  is_discontinued: number
  note: string | null
}

export interface Production {
  id: number
  year_month: string | null
  production_type: string | null
  production_date: string | null
  product_code: string | null
  product_name: string | null
  finished_qty: number | null
  produced_qty: number | null
  defect_qty: number | null
  tech_worker: string | null
  pack_workers: string | null
  equipment_name: string | null
  note: string | null
  source_sheet: string | null
  work_specification: Record<string, string[]> | null
  worker_count: number | null
  work_start_hhmm: string | null
  work_end_hhmm: string | null
  work_minutes: number | null
  factory: string | null
}
