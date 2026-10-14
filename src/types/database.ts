export type Role = 'admin' | 'staff'
export type CurrencyCode = 'GHS' | 'GBP' | 'USD'

export interface Profile {
  id: string
  email: string | null
  full_name: string | null
  phone: string | null
  role: Role
  created_at: string
}

export interface Supplier {
  id: string
  name: string
  contact_person: string | null
  phone: string | null
  email: string | null
  address: string | null
  created_at: string
  updated_at: string
}

export interface Customer {
  id: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface Product {
  id: string
  sku: string
  barcode: string | null
  name: string
  description: string | null
  category: string | null
  manufacturer: string | null
  currency: CurrencyCode
  low_stock_threshold: number
  image_url: string | null
  current_cost_price: number
  current_selling_price: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface Purchase {
  id: string
  product_id: string
  quantity: number
  unit_cost: number
  total_cost: number
  currency: CurrencyCode
  fx_rate_to_ghs: number
  total_cost_ghs: number
  purchase_date: string
  manufacturer: string | null
  supplier_id: string | null
  purchase_batch_id: string | null
  purchase_number: string | null
  invoice_url: string | null
  notes: string | null
  created_by: string
  created_at: string
  products?: Pick<Product, 'sku' | 'name' | 'barcode' | 'currency'> | null
  suppliers?: Pick<Supplier, 'name'> | null
}

export interface Sale {
  id: string
  product_id: string
  quantity: number
  unit_price: number
  total_amount: number
  currency: CurrencyCode
  fx_rate_to_ghs: number
  total_amount_ghs: number
  unit_cost_basis: number
  unit_cost_basis_ghs: number
  profit: number
  profit_ghs: number
  sale_date: string
  customer_id: string | null
  customer_name: string | null
  sale_batch_id: string | null
  sale_number: string | null
  payment_method: string | null
  receipt_url: string | null
  notes: string | null
  created_by: string
  created_at: string
  products?: Pick<Product, 'sku' | 'name' | 'barcode' | 'currency'> | null
  customers?: Pick<Customer, 'name'> | null
}

export interface InventoryRow {
  product_id: string
  sku: string
  name: string
  manufacturer: string | null
  current_cost_price: number
  current_selling_price: number
  total_purchased: number
  total_sold: number
  quantity_on_hand: number
  avg_unit_cost: number
  total_invested: number
  potential_revenue: number | null
  realized_profit: number
  potential_profit: number | null
  barcode: string | null
  category: string | null
  currency: CurrencyCode
  low_stock_threshold: number
  is_low_stock: boolean
  sales_revenue: number
}

export interface ExchangeRate {
  id: string
  currency_code: CurrencyCode
  rate_to_ghs: number
  rate_source: 'manual' | 'bank_of_ghana'
  source_date: string | null
  updated_by: string | null
  updated_at: string
}

export interface StockMovement {
  movement_id: string
  product_id: string
  movement_type: 'purchase' | 'sale'
  movement_date: string
  quantity: number
  unit_amount: number
  total_amount: number
  currency: CurrencyCode
  total_amount_ghs: number
  created_by: string
  created_at: string
  notes: string | null
}

export interface ActivityLog {
  id: string
  user_id: string | null
  action: 'insert' | 'update' | 'delete' | string
  entity_type: string
  entity_id: string | null
  details: Record<string, unknown>
  created_at: string
  profiles?: Pick<Profile, 'full_name' | 'email'> | null
}

export interface AppSettings {
  id: string
  setting_key: 'primary'
  business_name: string
  business_phone: string | null
  business_email: string | null
  business_address: string | null
  receipt_footer: string | null
  default_label_copies: number
  alert_missing_barcodes: boolean
  fx_stale_days: number
  updated_by: string | null
  updated_at: string
}
