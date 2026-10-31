import { describe, expect, it } from 'vitest'
import { date, fortalezaDate, localDate, money } from './format'

describe('formatadores brasileiros', () => {
  it('formata valores em reais sem conversão de ponto flutuante', () => {
    expect(money('10.50')).toBe('R$ 10,50')
  })

  it('mantém datas de calendário no fuso de Fortaleza', () => {
    expect(date('2026-10-18')).toBe('18/10/2026')
  })

  it('retorna uma data ISO de calendário', () => {
    expect(localDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('converte registros com horário para o dia de Fortaleza', () => {
    expect(fortalezaDate('2026-10-18T01:30:00.000Z')).toBe('2026-10-17')
  })
})
