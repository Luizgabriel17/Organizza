export const money = (value: number | string | null | undefined) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value ?? 0))

export const date = (value: string | null | undefined) =>
  value ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Fortaleza' }).format(new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00-03:00` : value)) : '—'

export const localDate = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Fortaleza' }).format(new Date())

export const fortalezaDate = (value: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Fortaleza' }).format(new Date(value))

export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Não foi possível concluir a operação. Tente novamente.'
