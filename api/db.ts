import { neon } from '@neondatabase/serverless'
import type { VercelRequest, VercelResponse } from '@vercel/node'

type TableName = 'families' | 'categories' | 'sales' | 'expenses' | 'orders' | 'order_items' | 'payment_records'
type Filter = { column: string; operator: 'eq' | 'is' | 'ilike' | 'in'; value: unknown }
type QueryRequest = {
  action: 'select' | 'insert' | 'update' | 'delete'
  table: TableName
  columns?: string
  filters?: Filter[]
  order?: { column: string; ascending: boolean }
  offset?: number
  limit?: number
  values?: unknown
  single?: boolean
}
type ApiRequest = VercelRequest & { body: unknown }
type ApiResponse = VercelResponse
type JsonRecord = Record<string, unknown>

const columns: Record<TableName, readonly string[]> = {
  families: ['id', 'name', 'created_at', 'updated_at'],
  categories: ['id', 'family_id', 'name', 'color', 'created_at'],
  sales: ['id', 'family_id', 'sold_at', 'product_name', 'quantity', 'unit_price', 'total_amount', 'payment_method', 'notes', 'created_at', 'updated_at', 'deleted_at'],
  expenses: ['id', 'family_id', 'description', 'category_id', 'amount', 'due_date', 'status', 'paid_at', 'payment_method', 'is_recurring', 'recurrence_frequency', 'recurrence_day', 'recurrence_anchor_id', 'notes', 'created_at', 'updated_at', 'deleted_at'],
  orders: ['id', 'family_id', 'customer_name', 'customer_phone', 'description', 'quantity', 'total_amount', 'order_date', 'due_date', 'delivery_date', 'status', 'notes', 'created_at', 'updated_at', 'deleted_at'],
  order_items: ['id', 'family_id', 'order_id', 'product_name', 'quantity', 'unit_price', 'subtotal', 'created_at'],
  payment_records: ['id', 'family_id', 'order_id', 'expense_id', 'amount', 'payment_type', 'payment_method', 'paid_at', 'notes', 'created_at'],
}

const insertable: Partial<Record<TableName, readonly string[]>> = {
  categories: ['family_id', 'name', 'color'],
  sales: ['family_id', 'sold_at', 'product_name', 'quantity', 'unit_price', 'payment_method', 'notes'],
  expenses: ['family_id', 'description', 'category_id', 'amount', 'due_date', 'is_recurring', 'recurrence_frequency', 'recurrence_day', 'recurrence_anchor_id', 'notes'],
}

const updatable: Partial<Record<TableName, readonly string[]>> = {
  categories: ['name', 'color'],
  sales: ['sold_at', 'product_name', 'quantity', 'unit_price', 'payment_method', 'notes', 'deleted_at'],
  expenses: ['description', 'category_id', 'amount', 'due_date', 'status', 'paid_at', 'payment_method', 'is_recurring', 'recurrence_frequency', 'recurrence_day', 'notes', 'deleted_at'],
  orders: ['status', 'delivery_date', 'deleted_at'],
}

const rpcNames = new Set([
  'generate_recurring_expenses',
  'record_expense_payment',
  'cancel_pending_expense',
  'create_order_with_items',
  'update_order_with_items',
  'record_order_payment',
])

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asString(value: unknown, name: string) {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`Campo inválido: ${name}`)
  return value
}

function asNumber(value: unknown, name: string) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`Campo inválido: ${name}`)
  return value
}

function quoteColumn(table: TableName, column: string) {
  if (!columns[table].includes(column)) throw new Error(`Coluna inválida: ${column}`)
  return `"${column}"`
}

function queryRows(sql: ReturnType<typeof neon>, query: string, values: unknown[] = []) {
  return sql.query(query, values, { arrayMode: false, fullResults: false })
}

function makeWhere(table: TableName, familyId: string, filters: Filter[] = []) {
  const clauses: string[] = []
  const values: unknown[] = []
  const parameter = (value: unknown) => {
    values.push(value)
    return `$${values.length}`
  }
  const scopeColumn = table === 'families' ? 'id' : 'family_id'
  clauses.push(`${quoteColumn(table, scopeColumn)} = ${parameter(familyId)}`)

  if (!Array.isArray(filters) || filters.length > 30) throw new Error('Filtros inválidos')
  for (const filter of filters) {
    if (!isRecord(filter) || typeof filter.column !== 'string') throw new Error('Filtro inválido')
    const column = quoteColumn(table, filter.column)
    if (filter.operator === 'eq') clauses.push(`${column} = ${parameter(filter.value)}`)
    else if (filter.operator === 'is') {
      if (filter.value !== null) throw new Error('Somente filtros IS NULL são permitidos')
      clauses.push(`${column} IS NULL`)
    } else if (filter.operator === 'ilike' && typeof filter.value === 'string') {
      clauses.push(`${column} ILIKE ${parameter(filter.value)}`)
    } else if (filter.operator === 'in' && Array.isArray(filter.value) && filter.value.length <= 500) {
      if (filter.value.length === 0) clauses.push('FALSE')
      else clauses.push(`${column} IN (${filter.value.map(parameter).join(', ')})`)
    } else {
      throw new Error('Operador de filtro inválido')
    }
  }
  return { clause: clauses.join(' AND '), values, parameter }
}

async function runQuery(sql: ReturnType<typeof neon>, body: JsonRecord, familyId: string) {
  if (body.action === 'rpc') return runRpc(sql, body, familyId)
  const table = body.table
  if (typeof table !== 'string' || !Object.hasOwn(columns, table)) throw new Error('Tabela inválida')
  const tableName = table as TableName
  if (body.filters !== undefined && !Array.isArray(body.filters)) throw new Error('Filtros inválidos')
  const filters = (body.filters ?? []) as Filter[]

  if (body.action === 'select') {
    const selected = typeof body.columns === 'string' ? body.columns.split(',').map((column) => column.trim()) : ['*']
    if (selected.length === 0 || selected.some((column) => column !== '*' && !columns[tableName].includes(column))) {
      throw new Error('Colunas solicitadas inválidas')
    }
    const where = makeWhere(tableName, familyId, filters)
    let orderClause = ''
    if (body.order !== undefined) {
      if (!isRecord(body.order) || typeof body.order.column !== 'string') throw new Error('Ordenação inválida')
      const direction = body.order.ascending === false ? 'DESC' : 'ASC'
      orderClause = ` ORDER BY ${quoteColumn(tableName, body.order.column)} ${direction}`
    }
    const limit = typeof body.limit === 'number' ? body.limit : 500
    const offset = typeof body.offset === 'number' ? body.offset : 0
    if (!Number.isInteger(limit) || limit < 1 || limit > 500 || !Number.isInteger(offset) || offset < 0 || offset > 1_000_000) {
      throw new Error('Paginação inválida')
    }
    const result = await queryRows(sql,
      `SELECT ${selected[0] === '*' ? '*' : selected.map((column) => quoteColumn(tableName, column)).join(', ')} FROM public."${tableName}" WHERE ${where.clause}${orderClause} LIMIT ${where.parameter(limit)} OFFSET ${where.parameter(offset)}`,
      where.values,
    )
    if (body.single === true) {
      if (result.length !== 1) throw new Error('Esperado exatamente um registro')
      return result[0]
    }
    return result
  }

  if (body.action === 'insert') {
    const allowed = insertable[tableName]
    if (!allowed) throw new Error('Inclusão não permitida nesta tabela')
    const values = Array.isArray(body.values) ? body.values : [body.values]
    const rows = values.filter(isRecord)
    if (rows.length === 0 || rows.length > 50 || rows.length !== values.length) throw new Error('Registros inválidos')
    const originalKeys = Object.keys(rows[0])
    const keys = [...originalKeys]
    if (keys.some((key) => !allowed.includes(key)) || keys.length === 0) throw new Error('Campos de inclusão inválidos')
    if (!keys.includes('family_id')) keys.push('family_id')
    const whereValues: unknown[] = []
    const valueGroups = rows.map((row) => {
      if (row.family_id !== undefined && row.family_id !== familyId) throw new Error('Família inválida')
      if (Object.keys(row).length !== originalKeys.length || originalKeys.some((key) => !Object.hasOwn(row, key))) {
        throw new Error('Todos os registros devem ter os mesmos campos')
      }
      return `(${keys.map((key) => {
        const value = key === 'family_id' ? familyId : row[key]
        whereValues.push(value)
        return `$${whereValues.length}`
      }).join(', ')})`
    })
    const result = await queryRows(sql,
      `INSERT INTO public."${tableName}" (${keys.map((key) => quoteColumn(tableName, key)).join(', ')}) VALUES ${valueGroups.join(', ')} RETURNING id`,
      whereValues,
    )
    return result
  }

  const where = makeWhere(tableName, familyId, filters)
  if (body.action === 'update') {
    const allowed = updatable[tableName]
    if (!allowed || filters.length === 0 || !isRecord(body.values)) throw new Error('Atualização não permitida')
    const entries = Object.entries(body.values)
    if (entries.length === 0 || entries.some(([key]) => !allowed.includes(key))) throw new Error('Campos de atualização inválidos')
    const sets = entries.map(([key, value]) => `${quoteColumn(tableName, key)} = ${where.parameter(value)}`)
    const result = await queryRows(sql, `UPDATE public."${tableName}" SET ${sets.join(', ')} WHERE ${where.clause} RETURNING id`, where.values)
    return result
  }

  if (body.action === 'delete') {
    if (tableName !== 'categories' || filters.length === 0) throw new Error('Exclusão não permitida')
    return queryRows(sql, `DELETE FROM public."${tableName}" WHERE ${where.clause} RETURNING id`, where.values)
  }
  throw new Error('Ação inválida')
}

async function runRpc(sql: ReturnType<typeof neon>, body: JsonRecord, familyId: string) {
  const name = body.name
  const args = body.args
  if (typeof name !== 'string' || !rpcNames.has(name) || !isRecord(args)) throw new Error('Operação inválida')

  if (name === 'generate_recurring_expenses') {
    const rows = await queryRows(sql, 'SELECT public.generate_recurring_expenses($1::uuid) AS result', [familyId])
    return rows[0]?.result ?? null
  }
  if (name === 'create_order_with_items') {
    const items = args.items
    if (!Array.isArray(items)) throw new Error('Itens inválidos')
    const rows = await queryRows(sql,
      'SELECT public.create_order_with_items($1::uuid, $2::text, $3::text, $4::date, $5::text, $6::jsonb) AS result',
      [familyId, asString(args.customer, 'customer'), typeof args.phone === 'string' ? args.phone : '', asString(args.deadline, 'deadline'), typeof args.order_notes === 'string' ? args.order_notes : '', JSON.stringify(items)],
    )
    return rows[0]?.result ?? null
  }
  if (name === 'update_order_with_items') {
    const items = args.items
    if (!Array.isArray(items)) throw new Error('Itens inválidos')
    const targetOrder = asString(args.target_order, 'target_order')
    await assertFamilyRecord(sql, 'orders', targetOrder, familyId)
    const rows = await queryRows(sql,
      'SELECT public.update_order_with_items($1::uuid, $2::text, $3::text, $4::date, $5::text, $6::jsonb) AS result',
      [targetOrder, asString(args.customer, 'customer'), typeof args.phone === 'string' ? args.phone : '', asString(args.deadline, 'deadline'), typeof args.order_notes === 'string' ? args.order_notes : '', JSON.stringify(items)],
    )
    return rows[0]?.result ?? null
  }
  if (name === 'record_order_payment') {
    const targetOrder = asString(args.target_order, 'target_order')
    await assertFamilyRecord(sql, 'orders', targetOrder, familyId)
    const rows = await queryRows(sql,
      'SELECT public.record_order_payment($1::uuid, $2::numeric, $3::text, $4::timestamptz, $5::text) AS result',
      [targetOrder, asNumber(args.payment_amount, 'payment_amount'), asString(args.method, 'method'), asString(args.payment_time, 'payment_time'), typeof args.payment_note === 'string' ? args.payment_note : null],
    )
    return rows[0]?.result ?? null
  }
  if (name === 'record_expense_payment') {
    const targetExpense = asString(args.target_expense, 'target_expense')
    await assertFamilyRecord(sql, 'expenses', targetExpense, familyId)
    const rows = await queryRows(sql,
      'SELECT public.record_expense_payment($1::uuid, $2::numeric, $3::text, $4::timestamptz, $5::text) AS result',
      [targetExpense, asNumber(args.payment_amount, 'payment_amount'), asString(args.method, 'method'), asString(args.payment_time, 'payment_time'), typeof args.payment_note === 'string' ? args.payment_note : null],
    )
    return rows[0]?.result ?? null
  }
  const targetExpense = asString(args.target_expense, 'target_expense')
  await assertFamilyRecord(sql, 'expenses', targetExpense, familyId)
  const rows = await queryRows(sql, 'SELECT public.cancel_pending_expense($1::uuid) AS result', [targetExpense])
  return rows[0]?.result ?? null
}

async function assertFamilyRecord(sql: ReturnType<typeof neon>, table: 'orders' | 'expenses', id: string, familyId: string) {
  const rows = await queryRows(sql, `SELECT id FROM public."${table}" WHERE id = $1::uuid AND family_id = $2::uuid`, [id, familyId])
  if (rows.length === 0) throw new Error('Registro não encontrado nesta família')
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ data: null, error: { message: 'Método não permitido' } })
  const connectionString = process.env.DATABASE_URL
  const familyId = process.env.FAMILY_ID
  if (!connectionString || !familyId) return res.status(503).json({ data: null, error: { message: 'A API do banco não está configurada' } })

  try {
    if (!isRecord(req.body)) throw new Error('Corpo da requisição inválido')
    const data = await runQuery(neon(connectionString), req.body, familyId)
    return res.status(200).json({ data, error: null })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao executar a operação no banco'
    return res.status(400).json({ data: null, error: { message } })
  }
}
