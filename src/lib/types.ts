export type Sale = {
  id: string
  sold_at: string
  product_name: string
  quantity: number
  unit_price: number
  total_amount: number
  payment_method: 'cash' | 'pix' | 'other'
  notes: string | null
}
export type Expense = {
  id: string
  description: string
  amount: number
  due_date: string
  status: 'pending' | 'paid' | 'cancelled'
  paid_at: string | null
  payment_method: string | null
  category_id: string | null
  is_recurring: boolean
  recurrence_frequency: 'monthly' | null
  recurrence_day: number | null
  recurrence_anchor_id: string | null
  notes: string | null
}
export type Order = {
  id: string
  customer_name: string
  customer_phone: string | null
  description: string
  quantity: number
  total_amount: number
  order_date: string
  due_date: string
  delivery_date: string | null
  status: 'todo' | 'in_progress' | 'ready' | 'delivered' | 'cancelled'
  notes: string | null
}
export type Category = { id: string; name: string; color: string }
export type PaymentRecord = {
  id: string
  amount: number
  payment_type: 'order' | 'expense'
  payment_method: 'cash' | 'pix' | 'other'
  paid_at: string
  notes: string | null
  order_id: string | null
  expense_id: string | null
}
export type OrderItem = {
  id: string
  product_name: string
  quantity: number
  unit_price: number
  subtotal: number
}
