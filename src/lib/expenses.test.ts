import { describe, expect, it } from 'vitest'
import { formatMonth, groupExpensesByMonth } from './expenses'
import type { Expense } from './types'

const expense = (id: string, due_date: string, amount: number, status: Expense['status']): Expense => ({
  id,
  due_date,
  amount,
  status,
  description: id,
  paid_at: null,
  payment_method: null,
  category_id: null,
  is_recurring: false,
  recurrence_frequency: null,
  recurrence_day: null,
  recurrence_anchor_id: null,
  notes: null,
})

describe('resumos mensais de contas', () => {
  it('soma contas pagas e pendentes pelo mês de vencimento e ignora canceladas', () => {
    expect(groupExpensesByMonth([
      expense('energia', '2026-10-10', 100, 'paid'),
      expense('internet', '2026-10-31', 50.5, 'pending'),
      expense('cancelada', '2026-10-15', 900, 'cancelled'),
      expense('aluguel', '2026-11-05', 1200, 'pending'),
    ])).toEqual([
      { month: '2026-11', total: 1200, pending: 1200, paid: 0, count: 1 },
      { month: '2026-10', total: 150.5, pending: 50.5, paid: 100, count: 2 },
    ])
  })

  it('formata mês sem deslocar o dia por causa do fuso horário', () => {
    expect(formatMonth('2026-10')).toBe('outubro de 2026')
  })
})
