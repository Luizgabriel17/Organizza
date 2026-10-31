import type { Category, Expense, Order, OrderItem, PaymentRecord, Sale } from './types'

export type TableName = 'families' | 'categories' | 'sales' | 'expenses' | 'orders' | 'order_items' | 'payment_records'
export type FamilyRow = { id: string; name: string }
type TableRows = {
  families: FamilyRow
  categories: Category & { family_id: string; created_at: string }
  sales: Sale & { family_id: string; created_at: string; updated_at: string; deleted_at: string | null }
  expenses: Expense & { family_id: string; created_at: string; updated_at: string; deleted_at: string | null }
  orders: Order & { family_id: string; created_at: string; updated_at: string; deleted_at: string | null }
  order_items: OrderItem & { family_id: string; order_id: string; created_at: string }
  payment_records: PaymentRecord & { family_id: string; created_at: string }
}

type Filter = { column: string; operator: 'eq' | 'is' | 'ilike' | 'in'; value: unknown }
type QueryRequest = {
  action: 'select' | 'insert' | 'update' | 'delete'
  table: TableName
  columns?: string
  filters: Filter[]
  order?: { column: string; ascending: boolean }
  offset?: number
  limit?: number
  values?: unknown
  single?: boolean
}
type DbError = { message: string }
type DbResult<T> = { data: T | null; error: DbError | null }

class DbQuery<Row, Result = Row[]> implements PromiseLike<DbResult<Result>> {
  constructor(private readonly request: QueryRequest) {}

  select(columns = '*') {
    this.request.columns = columns
    return this
  }

  eq(column: string, value: unknown) {
    this.request.filters.push({ column, operator: 'eq', value })
    return this
  }

  is(column: string, value: unknown) {
    this.request.filters.push({ column, operator: 'is', value })
    return this
  }

  ilike(column: string, value: string) {
    this.request.filters.push({ column, operator: 'ilike', value })
    return this
  }

  in(column: string, values: readonly unknown[]) {
    this.request.filters.push({ column, operator: 'in', value: values })
    return this
  }

  order(column: string, options: { ascending?: boolean } = {}) {
    this.request.order = { column, ascending: options.ascending ?? true }
    return this
  }

  range(from: number, to: number) {
    this.request.offset = from
    this.request.limit = to - from + 1
    return this
  }

  limit(limit: number) {
    this.request.limit = limit
    return this
  }

  single(): DbQuery<Row, Row> {
    this.request.single = true
    return new DbQuery<Row, Row>(this.request)
  }

  insert(values: unknown) {
    this.request.action = 'insert'
    this.request.values = values
    return this
  }

  update(values: unknown) {
    this.request.action = 'update'
    this.request.values = values
    return this
  }

  delete() {
    this.request.action = 'delete'
    return this
  }

  then<TResult1 = DbResult<Result>, TResult2 = never>(
    onfulfilled?: ((value: DbResult<Result>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected)
  }

  private async execute(): Promise<DbResult<Result>> {
    const response = await fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(this.request),
    })
    const result = await response.json() as DbResult<Result>
    return result
  }
}

type RpcName =
  | 'generate_recurring_expenses'
  | 'record_expense_payment'
  | 'cancel_pending_expense'
  | 'create_order_with_items'
  | 'update_order_with_items'
  | 'record_order_payment'

export const dbConfigured = Boolean(import.meta.env.VITE_FAMILY_ID)

export const db = {
  from<T extends TableName>(table: T): DbQuery<TableRows[T]> {
    return new DbQuery<TableRows[T]>({ action: 'select', table, filters: [] })
  },
  async rpc<T = unknown>(name: RpcName, args: Record<string, unknown>) {
    const response = await fetch('/api/db', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'rpc', name, args }),
    })
    return await response.json() as DbResult<T>
  },
}
