import type { Expense } from './types'

export type MonthlyExpenseTotal = {
  month: string
  total: number
  pending: number
  paid: number
  count: number
}

export function groupExpensesByMonth(expenses: Expense[]): MonthlyExpenseTotal[] {
  const totals = new Map<string, MonthlyExpenseTotal>()

  for (const expense of expenses) {
    if (expense.status === 'cancelled') continue
    const month = expense.due_date.slice(0, 7)
    const summary = totals.get(month) ?? { month, total: 0, pending: 0, paid: 0, count: 0 }
    const amount = Number(expense.amount)
    summary.total += amount
    summary[expense.status] += amount
    summary.count += 1
    totals.set(month, summary)
  }

  return [...totals.values()].sort((a, b) => b.month.localeCompare(a.month))
}

export function formatMonth(month: string) {
  const [year, value] = month.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, value - 1, 1)))
}
