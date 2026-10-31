import { createContext, useContext, useEffect, useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { Link, NavLink, Outlet, Route, Routes, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { zodResolver } from '@hookform/resolvers/zod'
import { useFieldArray, useForm } from 'react-hook-form'
import { z } from 'zod'
import {
  ArrowDownLeft, ArrowUpRight, BarChart3, CalendarDays, Check, ChevronRight, CircleAlert,
  ClipboardList, CreditCard, Eye, House, Menu, Plus, Search, Settings, ShoppingBag,
  Pencil, Trash2, Wallet, X,
} from 'lucide-react'
import { errorMessage, date, fortalezaDate, localDate, money } from './lib/format'
import { formatMonth, groupExpensesByMonth } from './lib/expenses'
import { db, dbConfigured, type TableName } from './lib/db'
import type { Category, Expense, Order, OrderItem, PaymentRecord, Sale } from './lib/types'

type AppState = {
  familyId: string
  familyName: string
  loading: boolean
  connectionError: string
}
const StateContext = createContext<AppState | null>(null)
const useAppState = () => {
  const value = useContext(StateContext)
  if (!value) throw new Error('Estado da aplicação indisponível')
  return value
}
const categoryPalette = ['#4F7CAC', '#7B61A8', '#C46B35', '#2F855A', '#B3475B', '#218C8C', '#9A6B18', '#4F5FA8', '#A34D8F', '#657B42']

export default function App() {
  const [familyId, setFamilyId] = useState('')
  const [familyName, setFamilyName] = useState('')
  const [loading, setLoading] = useState(true)
  const [connectionError, setConnectionError] = useState('')

  useEffect(() => {
    const client = db
    let active = true
    const loadFamily = async () => {
      const { data, error } = await client.from('families')
        .select('id,name')
        .eq('id', import.meta.env.VITE_FAMILY_ID)
        .single()
      if (error) throw error
      if (!data) throw new Error('Família não encontrada.')
      if (!active) return
      setFamilyId(data.id)
      setFamilyName(data.name)
      setLoading(false)
    }
    void loadFamily().catch((error: unknown) => {
      if (active) {
        console.error('Falha ao carregar o espaço da família', error)
        setConnectionError(errorMessage(error))
        setLoading(false)
      }
    })
    return () => { active = false }
  }, [])

  const state = useMemo(() => ({ familyId, familyName, loading, connectionError }), [familyId, familyName, loading, connectionError])
  if (!dbConfigured) return <SetupNotice />
  return (
    <StateContext.Provider value={state}>
      {loading ? <div className="full-state">Conectando ao banco de dados...</div>
        : connectionError ? <main className="full-state"><ErrorBanner message={connectionError} /></main>
          : <Routes>
            <Route element={<AppLayout />}>
              <Route index element={<DashboardPage />} />
              <Route path="vendas" element={<SalesPage />} />
              <Route path="contas" element={<ExpensesPage />} />
              <Route path="encomendas" element={<OrdersPage />} />
              <Route path="relatorios" element={<ReportsPage />} />
              <Route path="configuracoes" element={<SettingsPage />} />
            </Route>
            <Route path="*" element={<NotFoundPage />} />
          </Routes>}
    </StateContext.Provider>
  )
}

function SetupNotice() {
  return <main className="setup-screen"><section className="setup-card">
    <div className="brand-mark"><House size={23} /></div><p className="eyebrow">ORGANIZA FAMÍLIA</p>
    <h1>Vamos configurar seu espaço</h1>
    <p>Configure as variáveis do banco de dados no README para conectar esta família.</p>
    <code>VITE_FAMILY_ID</code>
  </section></main>
}

const navItems = [
  { to: '/', label: 'Início', icon: House, end: true },
  { to: '/vendas', label: 'Vendas', icon: ShoppingBag },
  { to: '/contas', label: 'Contas', icon: Wallet },
  { to: '/encomendas', label: 'Encomendas', icon: ClipboardList },
]

function AppLayout() {
  const { familyName } = useAppState()
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])
  useEffect(() => {
    if (!menuOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [menuOpen])
  const titles: Record<string, string> = { '/': 'Início', '/vendas': 'Vendas', '/contas': 'Contas', '/encomendas': 'Encomendas', '/relatorios': 'Relatórios', '/configuracoes': 'Configurações', '/configuracoes/usuarios': 'Acessos da família' }
  const title = titles[location.pathname] ?? 'Organiza Família'
  const moreActive = ['/relatorios', '/configuracoes'].some((path) => location.pathname === path || location.pathname.startsWith(`${path}/`))
  return <div className="app-shell">
    <aside className="sidebar"><Link className="brand" to="/"><span className="brand-mark"><House size={21} /></span><span><strong>Organiza</strong><small>Família</small></span></Link>
      <p className="nav-caption">MENU</p><nav>{navItems.map((item) => <NavItem key={item.to} {...item} />)}<NavLink className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} to="/relatorios"><BarChart3 size={19} /><span>Relatórios</span></NavLink><NavLink className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} to="/configuracoes"><Settings size={19} /><span>Configurações</span></NavLink></nav>
      <div className="sidebar-family"><span className="sidebar-family-icon"><House size={17} /></span><span><strong>{familyName || 'Espaço da família'}</strong><small>Dados compartilhados</small></span></div>
    </aside>
    <main className="main-area"><header className="topbar"><button className="mobile-menu" aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'} aria-expanded={menuOpen} aria-controls="mobile-navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</button><div><p className="eyebrow">{familyName || 'ESPAÇO DA FAMÍLIA'}</p><h1>{title}</h1></div><GlobalSearch /><span className="muted">Sem login</span></header>
      {menuOpen && <>
        <button className="mobile-menu-backdrop" aria-label="Fechar menu" onClick={() => setMenuOpen(false)} />
        <nav className="mobile-menu-panel" id="mobile-navigation" aria-label="Navegação principal">
          {navItems.map((item) => <NavItem key={item.to} {...item} onClick={() => setMenuOpen(false)} />)}
          <NavLink className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} to="/relatorios" onClick={() => setMenuOpen(false)}><BarChart3 size={19} /><span>Relatórios</span></NavLink>
          <NavLink className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} to="/configuracoes" onClick={() => setMenuOpen(false)}><Settings size={19} /><span>Configurações</span></NavLink>
        </nav>
      </>}
      <div className="page-content"><Outlet /></div>
    </main>
    <nav className="bottom-nav" aria-label="Navegação inferior">{navItems.map((item) => <NavItem key={item.to} {...item} />)}<button type="button" className={`bottom-link ${menuOpen || moreActive ? 'active' : ''}`} aria-expanded={menuOpen} aria-controls="mobile-navigation" onClick={() => setMenuOpen(!menuOpen)}><Menu size={19} /><span>Mais</span></button></nav>
  </div>
}

function NavItem({ to, label, icon: Icon, end, onClick }: { to: string; label: string; icon: typeof House; end?: boolean; onClick?: () => void }) {
  return <NavLink end={end} onClick={onClick} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} to={to}><Icon size={19} /><span>{label}</span></NavLink>
}

type SearchResult = { id: string; label: string; detail: string; to: string }
function GlobalSearch() {
  const { familyId } = useAppState()
  const navigate = useNavigate()
  const [term, setTerm] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const queryText = term.trim()
    if (!familyId || queryText.length < 2) {
      setResults([])
      setLoading(false)
      setError('')
      return
    }
    let active = true
    const timer = window.setTimeout(async () => {
      setLoading(true); setError('')
      const pattern = `%${queryText.replaceAll('%', '\\%').replaceAll('_', '\\_')}%`
      const [sales, expenses, customers, descriptions] = await Promise.all([
        db.from('sales').select('id,product_name').eq('family_id', familyId).is('deleted_at', null).ilike('product_name', pattern).limit(4),
        db.from('expenses').select('id,description').eq('family_id', familyId).is('deleted_at', null).ilike('description', pattern).limit(4),
        db.from('orders').select('id,customer_name,description').eq('family_id', familyId).is('deleted_at', null).ilike('customer_name', pattern).limit(4),
        db.from('orders').select('id,customer_name,description').eq('family_id', familyId).is('deleted_at', null).ilike('description', pattern).limit(4),
      ])
      if (!active) return
      const failures = [sales.error, expenses.error, customers.error, descriptions.error].filter(Boolean)
      if (failures.length) setError(errorMessage(failures[0]))
      const seenOrders = new Set<string>()
      const orderRows = [...(customers.data ?? []), ...(descriptions.data ?? [])].filter((row) => {
        if (seenOrders.has(row.id)) return false
        seenOrders.add(row.id)
        return true
      })
      setResults([
        ...(sales.data ?? []).map((row) => ({ id: row.id, label: row.product_name, detail: 'Venda', to: `/vendas?open=${row.id}` })),
        ...(expenses.data ?? []).map((row) => ({ id: row.id, label: row.description, detail: 'Conta', to: `/contas?open=${row.id}` })),
        ...orderRows.map((row) => ({ id: row.id, label: row.customer_name, detail: row.description, to: `/encomendas?open=${row.id}` })),
      ])
      setLoading(false)
    }, 250)
    return () => { active = false; window.clearTimeout(timer) }
  }, [term, familyId])
  return <div className="global-search">
    <label className="search-input"><Search size={17} /><input aria-label="Buscar em vendas, contas e encomendas" placeholder="Buscar em tudo" value={term} onFocus={() => setOpen(true)} onChange={(event) => { setTerm(event.target.value); setOpen(true) }} onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false) }} /></label>
    {open && term.trim().length >= 2 && <div className="search-results" role="listbox">
      {loading && <p>Buscando...</p>}{error && <p className="form-error">{error}</p>}
      {!loading && !error && results.length === 0 && <p>Nenhum registro encontrado.</p>}
      {results.map((result) => <button key={`${result.to}-${result.id}`} onClick={() => { setOpen(false); setTerm(''); navigate(result.to) }}><span><strong>{result.label}</strong><small>{result.detail}</small></span><ChevronRight size={16} /></button>)}
    </div>}
  </div>
}

function useFamilyRows<T>(table: TableName, columns = '*') {
  const { familyId } = useAppState()
  const [rows, setRows] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const reload = () => setRevision((value) => value + 1)
  useEffect(() => {
    let active = true
    const fetchRows = async () => {
      if (!familyId) return
      setLoading(true); setError('')
      if (table === 'expenses') {
        const { error: recurringError } = await db.rpc('generate_recurring_expenses', { target_family: familyId })
        if (!active) return
        if (recurringError) {
          setError(errorMessage(recurringError))
          setLoading(false)
          return
        }
      }
      const pageSize = 500
      const allRows: T[] = []
      for (let offset = 0; ; offset += pageSize) {
        let query = db.from(table).select(columns).eq('family_id', familyId)
        if (['sales', 'expenses', 'orders'].includes(table)) query = query.is('deleted_at', null)
        const { data, error: queryError } = await query.order('created_at', { ascending: false }).range(offset, offset + pageSize - 1)
        if (!active) return
        if (queryError) {
          setError(errorMessage(queryError))
          setLoading(false)
          return
        }
        allRows.push(...((data ?? []) as T[]))
        if (!data || data.length < pageSize) break
      }
      if (!active) return
      setRows(allRows)
      setLoading(false)
    }
    void fetchRows()
    return () => { active = false }
  }, [familyId, table, columns, revision])
  return { rows, loading, error, reload }
}

function DashboardPage() {
  const { familyId } = useAppState()
  const sales = useFamilyRows<Sale>('sales')
  const expenses = useFamilyRows<Expense>('expenses')
  const orders = useFamilyRows<Order>('orders')
  const today = localDate()
  const month = today.slice(0, 7)
  const todayTotal = sales.rows.filter((row) => fortalezaDate(row.sold_at) === today).reduce((sum, row) => sum + Number(row.total_amount), 0)
  const monthTotal = sales.rows.filter((row) => fortalezaDate(row.sold_at).slice(0, 7) === month).reduce((sum, row) => sum + Number(row.total_amount), 0)
  const monthExpenses = groupExpensesByMonth(expenses.rows).find((item) => item.month === month)
  const pendingExpenses = expenses.rows.filter((row) => row.status === 'pending')
  const overdue = pendingExpenses.filter((row) => row.due_date < today)
  const openOrders = orders.rows.filter((row) => ['todo', 'in_progress', 'ready'].includes(row.status))
  const attentionOrders = openOrders.filter((row) => row.status === 'ready' || row.due_date < today || (row.due_date >= today && row.due_date <= addDays(today, 7)))
  const orderIds = orders.rows.filter((row) => row.status !== 'cancelled').map((row) => row.id)
  const [received, setReceived] = useState<Record<string, number>>({})
  useEffect(() => {
    if (!familyId || orderIds.length === 0) { setReceived({}); return }
    let active = true
    void db.from('payment_records').select('order_id,amount').in('order_id', orderIds).then(({ data, error }) => {
      if (error) { console.error('Falha ao carregar recebimentos', error); return }
      if (!active) return
      const totals: Record<string, number> = {}
      for (const payment of data ?? []) {
        if (payment.order_id) totals[payment.order_id] = (totals[payment.order_id] ?? 0) + Number(payment.amount)
      }
      setReceived(totals)
    })
    return () => { active = false }
  }, [familyId, orders.rows])
  const toReceive = orders.rows.filter((order) => order.status !== 'cancelled')
    .reduce((sum, order) => sum + Math.max(Number(order.total_amount) - (received[order.id] ?? 0), 0), 0)
  const busy = sales.loading || expenses.loading || orders.loading
  const errors = [sales.error, expenses.error, orders.error].filter(Boolean)
  return <div className="page-stack">
    <div className="welcome-row"><div><h2>Olá! Veja como está a organização da família.</h2><p className="muted">Resumo atualizado com os registros compartilhados.</p></div></div>
    <section className="quick-actions" aria-label="Ações rápidas">
      <Link className="quick-action" to="/vendas"><span className="quick-action-icon green"><ShoppingBag size={18} /></span><span><strong>Registrar venda</strong><small>Adicionar ao caixa</small></span><ChevronRight size={17} /></Link>
      <Link className="quick-action" to="/contas"><span className="quick-action-icon orange"><Wallet size={18} /></span><span><strong>Cadastrar conta</strong><small>Organizar vencimentos</small></span><ChevronRight size={17} /></Link>
      <Link className="quick-action" to="/encomendas"><span className="quick-action-icon blue"><ClipboardList size={18} /></span><span><strong>Nova encomenda</strong><small>Acompanhar um pedido</small></span><ChevronRight size={17} /></Link>
    </section>
    {errors.map((error) => <ErrorBanner key={error} message={error} />)}
    {busy ? <Loading /> : <>
      <section className="stats-grid">
        <StatCard icon={ArrowUpRight} label="Vendas de hoje" value={money(todayTotal)} detail={`${sales.rows.filter((row) => fortalezaDate(row.sold_at) === today).length} registros`} tone="green" />
        <StatCard icon={ShoppingBag} label="Vendas deste mês" value={money(monthTotal)} detail="Total bruto registrado" tone="blue" />
        <StatCard icon={CreditCard} label="Contas do mês" value={money(monthExpenses?.total ?? 0)} detail={`${monthExpenses?.count ?? 0} contas · ${money(monthExpenses?.pending ?? 0)} pendentes`} tone="orange" />
        <StatCard icon={CircleAlert} label="Contas atrasadas" value={String(overdue.length)} detail={overdue.length ? money(overdue.reduce((sum, row) => sum + Number(row.amount), 0)) : 'Tudo em dia'} tone={overdue.length ? 'red' : 'green'} />
        <StatCard icon={ClipboardList} label="Encomendas em andamento" value={String(openOrders.length)} detail={`${orders.rows.filter((row) => row.status === 'ready').length} prontas para entregar`} tone="blue" />
        <StatCard icon={ArrowDownLeft} label="Falta receber" value={money(toReceive)} detail="Saldo de encomendas abertas" tone="green" />
      </section>
      <section className="panel month-expense-summary">
        <div className="panel-heading"><div><h2>Contas com vencimento em {formatMonth(month)}</h2><p className="muted">{monthExpenses?.count ?? 0} contas ativas no mês</p></div><Link className="text-link" to="/contas">Ver contas <ChevronRight size={16} /></Link></div>
        <div className="month-expense-values">
          <div><span>Total do mês</span><strong>{money(monthExpenses?.total ?? 0)}</strong></div>
          <div><span>Pendentes</span><strong>{money(monthExpenses?.pending ?? 0)}</strong></div>
          <div><span>Pagas</span><strong>{money(monthExpenses?.paid ?? 0)}</strong></div>
        </div>
      </section>
      <div className="content-grid">
        <section className="panel"><div className="panel-heading"><div><h2>Contas que precisam de atenção</h2><p className="muted">Vencidas e próximas do vencimento</p></div><Link className="text-link" to="/contas">Ver contas <ChevronRight size={16} /></Link></div>
          {[...overdue, ...pendingExpenses.filter((row) => row.due_date >= today && row.due_date <= addDays(today, 7))].slice(0, 5).map((item) => <Link to={`/contas?open=${item.id}`} className="list-row" key={item.id}><div className={`status-dot ${item.due_date < today ? 'red' : 'orange'}`} /><div className="row-main"><strong>{item.description}</strong><small>Vencimento: {date(item.due_date)}</small></div><strong>{money(item.amount)}</strong></Link>)}
          {overdue.length === 0 && pendingExpenses.filter((row) => row.due_date >= today && row.due_date <= addDays(today, 7)).length === 0 && <EmptyState title="Tudo em dia!" text="Nenhuma conta urgente nos próximos sete dias." />}
        </section>
        <section className="panel"><div className="panel-heading"><div><h2>Encomendas</h2><p className="muted">Prazos próximos e entregas pendentes</p></div><Link className="text-link" to="/encomendas">Ver todas <ChevronRight size={16} /></Link></div>
          {attentionOrders.slice(0, 5).map((order) => <Link to={`/encomendas?open=${order.id}`} className="list-row" key={order.id}><div className={`status-dot ${order.due_date < today ? 'red' : 'orange'}`} /><div className="row-main"><strong>{order.customer_name}</strong><small>{order.status === 'ready' ? 'Pronta, aguardando entrega' : order.due_date < today ? `Atrasada · prazo ${date(order.due_date)}` : `Prazo: ${date(order.due_date)}`}</small></div><strong>{money(order.total_amount)}</strong></Link>)}
          {attentionOrders.length === 0 && <EmptyState title="Sem encomendas urgentes" text="Nenhuma encomenda precisa de atenção agora." />}
        </section>
      </div>
      {busy && null}
    </>}
  </div>
}

function SalesPage() {
  const { familyId } = useAppState()
  const { rows, loading, error, reload } = useFamilyRows<Sale>('sales')
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Sale | null>(null)
  const [selected, setSelected] = useState<Sale | null>(null)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [paymentFilter, setPaymentFilter] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const schema = z.object({ product_name: z.string().trim().min(1, 'Informe o produto.').max(160), quantity: z.coerce.number().int().positive('A quantidade deve ser maior que zero.'), unit_price: z.coerce.number().min(0, 'O preço não pode ser negativo.'), payment_method: z.enum(['cash', 'pix', 'other']), notes: z.string().optional() })
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { product_name: '', quantity: 1, unit_price: 0, payment_method: 'cash' as const, notes: '' } })
  const filtered = rows.filter((row) => {
    const day = fortalezaDate(row.sold_at)
    return row.product_name.toLowerCase().includes(search.toLowerCase())
      && (!fromDate || day >= fromDate) && (!toDate || day <= toDate)
      && (!paymentFilter || row.payment_method === paymentFilter)
  })
  useEffect(() => {
    const id = searchParams.get('open')
    const match = rows.find((row) => row.id === id)
    if (match) { setSelected(match); setSearchParams({}, { replace: true }) }
  }, [rows, searchParams, setSearchParams])
  const submit = form.handleSubmit(async (values) => {
    if (!familyId) return
    setSaving(true); setSaveError('')
    const result = editing
      ? await db.from('sales').update(values).eq('id', editing.id)
      : await db.from('sales').insert({ ...values, family_id: familyId })
    if (result.error) setSaveError(errorMessage(result.error))
    else { form.reset(); setEditing(null); setShowForm(false); reload() }
    setSaving(false)
  })
  const edit = (row: Sale) => {
    setEditing(row)
    form.reset({ product_name: row.product_name, quantity: row.quantity, unit_price: Number(row.unit_price), payment_method: row.payment_method, notes: row.notes ?? '' })
    setShowForm(true)
  }
  const closeForm = () => { setShowForm(false); setEditing(null); form.reset() }
  const remove = async (id: string) => {
    if (!window.confirm('Deseja excluir esta venda? O registro será preservado no histórico.')) return
    const { error: updateError } = await db.from('sales').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    if (updateError) alert(errorMessage(updateError)); else reload()
  }
  const today = localDate()
  const totalToday = rows.filter((row) => fortalezaDate(row.sold_at) === today).reduce((sum, row) => sum + Number(row.total_amount), 0)
  const todayRows = rows.filter((row) => fortalezaDate(row.sold_at) === today)
  return <div className="page-stack"><PageHeading title="Vendas" description="Registre e acompanhe as vendas da família." action={<button className="button primary" onClick={() => setShowForm(!showForm)}><Plus size={18} />Registrar venda</button>} />
    <div className="summary-strip"><div><span>Total de hoje</span><strong>{money(totalToday)}</strong></div><div><span>Vendas hoje</span><strong>{todayRows.length}</strong></div><div><span>Total neste mês</span><strong>{money(rows.filter((row) => fortalezaDate(row.sold_at).slice(0, 7) === today.slice(0, 7)).reduce((sum, row) => sum + Number(row.total_amount), 0))}</strong></div><div><span>Dinheiro</span><strong>{money(todayRows.filter((row) => row.payment_method === 'cash').reduce((sum, row) => sum + Number(row.total_amount), 0))}</strong></div><div><span>Pix</span><strong>{money(todayRows.filter((row) => row.payment_method === 'pix').reduce((sum, row) => sum + Number(row.total_amount), 0))}</strong></div><div><span>Outros</span><strong>{money(todayRows.filter((row) => row.payment_method === 'other').reduce((sum, row) => sum + Number(row.total_amount), 0))}</strong></div><p>Fechamento dos registros cadastrados; não representa conferência do dinheiro físico.</p></div>
    {showForm && <section className="panel form-panel"><div className="panel-heading"><div><h2>{editing ? 'Editar venda' : 'Registrar venda'}</h2><p className="muted">Total calculado automaticamente.</p></div><button className="icon-button" onClick={closeForm} aria-label="Fechar formulário"><X /></button></div>
      <form onSubmit={submit} className="form-grid"><Field label="Produto" error={form.formState.errors.product_name?.message}><input autoFocus {...form.register('product_name')} /></Field><Field label="Quantidade" error={form.formState.errors.quantity?.message}><input type="number" min="1" {...form.register('quantity')} /></Field><Field label="Preço unitário (R$)" error={form.formState.errors.unit_price?.message}><input type="number" min="0" step="0.01" {...form.register('unit_price')} /></Field><Field label="Forma de pagamento"><select {...form.register('payment_method')}><PaymentOptions /></select></Field><Field label="Observações"><input {...form.register('notes')} /></Field><div className="form-total"><span>Total da venda</span><strong>{money(Number(form.watch('quantity')) * Number(form.watch('unit_price')))}</strong></div>
        {saveError && <p className="form-error full-span">{saveError}</p>}<div className="form-actions full-span"><button type="button" className="button secondary" onClick={closeForm}>Cancelar</button><button className="button primary" disabled={saving}>{saving ? 'Salvando...' : 'Salvar venda'}</button></div></form></section>}
    <SearchInput value={search} onChange={setSearch} placeholder="Buscar pelo nome do produto" /><div className="sale-filters"><Field label="De"><input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></Field><Field label="Até"><input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></Field><Field label="Forma de pagamento"><select value={paymentFilter} onChange={(event) => setPaymentFilter(event.target.value)}><option value="">Todas</option><PaymentOptions /></select></Field></div>{error && <ErrorBanner message={error} />}{loading ? <Loading /> : <section className="panel table-panel"><div className="table-scroll"><table><thead><tr><th>Produto</th><th>Data</th><th>Quantidade</th><th>Pagamento</th><th>Total</th><th>Ações</th></tr></thead><tbody>{filtered.map((row) => <tr key={row.id}><td><strong>{row.product_name}</strong>{row.notes && <small>{row.notes}</small>}</td><td>{date(row.sold_at)}</td><td>{row.quantity}</td><td>{paymentLabel(row.payment_method)}</td><td className="amount">{money(row.total_amount)}</td><td className="actions-cell"><button className="icon-button" aria-label={`Detalhes da venda ${row.product_name}`} onClick={() => setSelected(row)}><Eye size={17} /></button><button className="icon-button" aria-label={`Editar venda ${row.product_name}`} onClick={() => edit(row)}><Pencil size={17} /></button><button className="icon-button danger" aria-label={`Excluir venda ${row.product_name}`} onClick={() => void remove(row.id)}><Trash2 size={17} /></button></td></tr>)}</tbody></table>{filtered.length === 0 && <EmptyState title="Nenhuma venda encontrada" text="Registre a primeira venda ou tente outra busca." />}</div></section>}
    {selected && <RecordDialog title="Detalhes da venda" onClose={() => setSelected(null)}><DetailLine label="Produto" value={selected.product_name} /><DetailLine label="Data e hora" value={new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Fortaleza' }).format(new Date(selected.sold_at))} /><DetailLine label="Quantidade" value={String(selected.quantity)} /><DetailLine label="Preço unitário" value={money(selected.unit_price)} /><DetailLine label="Total" value={money(selected.total_amount)} /><DetailLine label="Pagamento" value={paymentLabel(selected.payment_method)} /><DetailLine label="Observações" value={selected.notes || 'Sem observações'} /></RecordDialog>}
  </div>
}

function ExpensesPage() {
  const { familyId } = useAppState()
  const { rows, loading, error, reload } = useFamilyRows<Expense>('expenses')
  const categories = useFamilyRows<Category>('categories')
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Expense | null>(null)
  const [selected, setSelected] = useState<Expense | null>(null)
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [filter, setFilter] = useState<'all' | 'pending' | 'paid' | 'overdue' | 'cancelled'>('all')
  const [paymentTarget, setPaymentTarget] = useState<Expense | null>(null)
  const [paymentError, setPaymentError] = useState('')
  const [paymentSaving, setPaymentSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)
  const [period, setPeriod] = useState('')
  const schema = z.object({ description: z.string().trim().min(1, 'Informe o nome da conta.').max(160), amount: z.coerce.number().positive('O valor deve ser maior que zero.'), due_date: z.string().min(1, 'Informe o vencimento.'), category_id: z.string().optional(), is_recurring: z.boolean(), notes: z.string().optional() })
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { description: '', amount: 0, due_date: localDate(), category_id: '', is_recurring: false, notes: '' } })
  useEffect(() => {
    const match = rows.find((row) => row.id === searchParams.get('open'))
    if (match) { setSelected(match); setSearchParams({}, { replace: true }) }
  }, [rows, searchParams, setSearchParams])
  useEffect(() => {
    if (!selected) { setPayments([]); return }
    let active = true
    void db.from('payment_records').select('*').eq('expense_id', selected.id).order('paid_at', { ascending: false }).then(({ data, error: queryError }) => {
      if (!active) return
      if (queryError) setSaveError(errorMessage(queryError))
      else setPayments((data ?? []) as PaymentRecord[])
    })
    return () => { active = false }
  }, [selected])
  const submit = form.handleSubmit(async (values) => {
    if (!familyId) return
    setSaveError(''); setSaving(true)
    const dueDay = Number(values.due_date.slice(-2))
    const payload = {
      description: values.description, amount: values.amount, due_date: values.due_date,
      category_id: values.category_id || null, is_recurring: values.is_recurring,
      recurrence_frequency: values.is_recurring ? 'monthly' : null,
      recurrence_day: values.is_recurring ? dueDay : null, notes: values.notes || null,
    }
    const result = editing
      ? await db.from('expenses').update(payload).eq('id', editing.id)
      : await db.from('expenses').insert({ ...payload, family_id: familyId })
    if (result.error) setSaveError(errorMessage(result.error))
    else { form.reset(); setEditing(null); setShowForm(false); reload() }
    setSaving(false)
  })
  const editExpense = (row: Expense) => {
    setEditing(row)
    form.reset({
      description: row.description, amount: Number(row.amount), due_date: row.due_date,
      category_id: row.category_id ?? '', is_recurring: row.is_recurring && !row.recurrence_anchor_id,
      notes: row.notes ?? '',
    })
    setShowForm(true)
  }
  const closeExpenseForm = () => { setShowForm(false); setEditing(null); form.reset() }
  const today = localDate()
  const normalizedSearch = search.trim().toLocaleLowerCase('pt-BR')
  const visible = rows.filter((row) =>
    (!normalizedSearch || row.description.toLocaleLowerCase('pt-BR').includes(normalizedSearch))
    && (!period || row.due_date.startsWith(period))
    && (filter === 'all' || row.status === filter || (filter === 'overdue' && row.status === 'pending' && row.due_date < today)),
  )
  const monthlyTotals = groupExpensesByMonth(rows)
  const recordExpensePayment = async (values: PaymentFormValues) => {
    if (!paymentTarget) return
    setPaymentSaving(true)
    setPaymentError('')
    try {
      const { error: paymentRequestError } = await db.rpc('record_expense_payment', {
        target_expense: paymentTarget.id,
        payment_amount: paymentTarget.amount,
        method: values.method,
        payment_time: values.paymentTime,
        payment_note: values.note,
      })
      if (paymentRequestError) {
        setPaymentError(errorMessage(paymentRequestError))
        return
      }
      setPaymentTarget(null)
      reload()
    } catch (requestError) {
      setPaymentError(errorMessage(requestError))
    } finally {
      setPaymentSaving(false)
    }
  }
  const remove = async (row: Expense) => {
    if (!window.confirm(`Excluir "${row.description}"? O registro será preservado no histórico.`)) return
    const { error: removeError } = await db.from('expenses').update({ deleted_at: new Date().toISOString() }).eq('id', row.id)
    if (removeError) alert(errorMessage(removeError)); else reload()
  }
  const cancel = async (row: Expense) => {
    if (!window.confirm(`Cancelar a conta "${row.description}"?`)) return
    const { error: cancelError } = await db.rpc('cancel_pending_expense', { target_expense: row.id })
    if (cancelError) alert(errorMessage(cancelError)); else reload()
  }
  return <div className="page-stack"><PageHeading title="Contas" description="Acompanhe vencimentos e pagamentos da família." action={<button className="button primary" onClick={() => setShowForm(!showForm)}><Plus size={18} />Cadastrar conta</button>} />
    <div className="filter-row"><div className="filter-tabs" aria-label="Filtrar contas">{[['all', 'Todas'], ['overdue', 'Atrasadas'], ['pending', 'Pendentes'], ['paid', 'Pagas'], ['cancelled', 'Canceladas']].map(([key, label]) => <button key={key} className={filter === key ? 'selected' : ''} onClick={() => setFilter(key as typeof filter)}>{label}</button>)}</div><SearchInput value={search} onChange={setSearch} placeholder="Buscar conta" /><Field label="Mês de vencimento"><input aria-label="Mês de vencimento" type="month" value={period} onChange={(event) => setPeriod(event.target.value)} /></Field></div>
    {showForm && <section className="panel form-panel"><div className="panel-heading"><div><h2>{editing ? 'Editar conta' : 'Nova conta'}</h2><p className="muted">As próximas ocorrências mensais são criadas sem duplicidade; dias inexistentes usam o último dia do mês.</p></div><button className="icon-button" onClick={closeExpenseForm} aria-label="Fechar formulário"><X /></button></div>
      <form onSubmit={submit} className="form-grid"><Field label="Nome da conta" error={form.formState.errors.description?.message}><input {...form.register('description')} /></Field><Field label="Valor (R$)" error={form.formState.errors.amount?.message}><input type="number" min="0.01" step="0.01" {...form.register('amount')} /></Field><Field label="Vencimento" error={form.formState.errors.due_date?.message}><input type="date" {...form.register('due_date')} /></Field><Field label="Categoria"><select {...form.register('category_id')}><option value="">Sem categoria</option>{categories.rows.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></Field><label className="checkbox-field"><input type="checkbox" {...form.register('is_recurring')} /> Conta mensal recorrente</label><Field label="Observações"><input {...form.register('notes')} /></Field>
        {saveError && <p className="form-error full-span">{saveError}</p>}<div className="form-actions full-span"><button type="button" className="button secondary" onClick={closeExpenseForm}>Cancelar</button><button className="button primary" disabled={saving}>{saving ? 'Salvando...' : 'Salvar conta'}</button></div></form></section>}
    {monthlyTotals.length > 0 && <section className="panel"><div className="panel-heading"><div><h2>Totais por mês</h2><p className="muted">Soma das contas por vencimento; contas canceladas não entram.</p></div></div><div className="monthly-totals">{monthlyTotals.map((summary) => <article className={`monthly-total-card ${summary.month === today.slice(0, 7) ? 'current' : ''}`} key={summary.month}><div className="monthly-total-heading"><strong>{formatMonth(summary.month)}</strong><span>{summary.count} {summary.count === 1 ? 'conta' : 'contas'}</span></div><strong className="monthly-total-amount">{money(summary.total)}</strong><div className="monthly-total-breakdown"><span>Pendente <b>{money(summary.pending)}</b></span><span>Paga <b>{money(summary.paid)}</b></span></div></article>)}</div></section>}
    {error && <ErrorBanner message={error} />}{loading ? <Loading /> : <section className="panel table-panel"><div className="table-scroll"><table><thead><tr><th>Conta</th><th>Vencimento</th><th>Status</th><th>Valor</th><th>Ações</th></tr></thead><tbody>{visible.map((row) => { const overdue = row.status === 'pending' && row.due_date < today; const category = categories.rows.find((item) => item.id === row.category_id); return <tr key={row.id}><td><strong>{row.description}</strong><small>{row.is_recurring ? 'Recorrente' : 'Única'}</small><CategoryBadge category={category} /></td><td>{date(row.due_date)}</td><td><StatusBadge tone={row.status === 'paid' ? 'green' : overdue ? 'red' : row.status === 'cancelled' ? 'neutral' : 'orange'}>{row.status === 'paid' ? 'Paga' : overdue ? 'Atrasada' : row.status === 'cancelled' ? 'Cancelada' : 'Pendente'}</StatusBadge></td><td className="amount">{money(row.amount)}</td><td className="actions-cell"><button className="icon-button" aria-label={`Detalhes da conta ${row.description}`} onClick={() => setSelected(row)}><Eye size={17} /></button>{row.status === 'pending' && <button className="button small success" disabled={paymentSaving} onClick={() => { setPaymentError(''); setPaymentTarget(row) }}><Check size={15} />Marcar paga</button>}{row.status === 'pending' && <><button className="icon-button" aria-label={`Editar conta ${row.description}`} onClick={() => editExpense(row)}><Pencil size={17} /></button><button className="button small danger-text" onClick={() => void cancel(row)}>Cancelar</button></> }<button className="icon-button danger" aria-label={`Excluir conta ${row.description}`} onClick={() => void remove(row)}><Trash2 size={17} /></button></td></tr>})}</tbody></table>{visible.length === 0 && <EmptyState title="Nenhuma conta encontrada" text={normalizedSearch || period || filter !== 'all' ? 'Tente ajustar a busca ou os filtros.' : 'Cadastre uma conta para começar.'} />}</div></section>}
    {paymentTarget && <PaymentDialog title={`Registrar pagamento · ${paymentTarget.description}`} maximum={Number(paymentTarget.amount)} fixedAmount={Number(paymentTarget.amount)} error={paymentError} saving={paymentSaving} onClose={() => setPaymentTarget(null)} onSubmit={recordExpensePayment} />}
    {selected && <RecordDialog title="Detalhes da conta" onClose={() => setSelected(null)}><DetailLine label="Conta" value={selected.description} /><div className="detail-line"><span>Categoria</span><CategoryBadge category={categories.rows.find((category) => category.id === selected.category_id)} /></div><DetailLine label="Valor" value={money(selected.amount)} /><DetailLine label="Vencimento" value={date(selected.due_date)} /><DetailLine label="Status" value={selected.status === 'paid' ? `Paga em ${date(selected.paid_at)}` : selected.status === 'cancelled' ? 'Cancelada' : selected.due_date < today ? 'Atrasada (continua pendente)' : 'Pendente'} /><DetailLine label="Observações" value={selected.notes || 'Sem observações'} /><h3>Histórico de pagamento</h3>{payments.length ? payments.map((payment) => <div className="list-row" key={payment.id}><div className="row-main"><strong>{money(payment.amount)} · {paymentLabel(payment.payment_method)}</strong><small>{date(payment.paid_at)}{payment.notes ? ` · ${payment.notes}` : ''}</small></div></div>) : <p className="muted">Nenhum pagamento registrado.</p>}{saveError && <p className="form-error">{saveError}</p>}</RecordDialog>}
  </div>
}

function OrdersPage() {
  const { familyId } = useAppState()
  const { rows, loading, error, reload } = useFamilyRows<Order>('orders')
  const [searchParams, setSearchParams] = useSearchParams()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Order | null>(null)
  const [selected, setSelected] = useState<Order | null>(null)
  const [detailItems, setDetailItems] = useState<OrderItem[]>([])
  const [detailPayments, setDetailPayments] = useState<PaymentRecord[]>([])
  const [detailError, setDetailError] = useState('')
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [received, setReceived] = useState<Record<string, number>>({})
  const [paymentTarget, setPaymentTarget] = useState<Order | null>(null)
  const [paymentError, setPaymentError] = useState('')
  const [paymentSaving, setPaymentSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saving, setSaving] = useState(false)
  const schema = z.object({
    customer_name: z.string().trim().min(1, 'Informe o nome do cliente.').max(160),
    customer_phone: z.string().optional(),
    items: z.array(z.object({
      product_name: z.string().trim().min(1, 'Informe o produto.').max(160),
      quantity: z.coerce.number().int().positive('A quantidade deve ser maior que zero.'),
      unit_price: z.coerce.number().min(0, 'O preço não pode ser negativo.'),
    })).min(1).max(30),
    due_date: z.string().min(1, 'Informe o prazo.'),
    notes: z.string().optional(),
  })
  const form = useForm({ resolver: zodResolver(schema), defaultValues: { customer_name: '', customer_phone: '', items: [{ product_name: '', quantity: 1, unit_price: 0 }], due_date: localDate(), notes: '' } })
  const itemFields = useFieldArray({ control: form.control, name: 'items' })
  useEffect(() => {
    const match = rows.find((row) => row.id === searchParams.get('open'))
    if (match) { setSelected(match); setSearchParams({}, { replace: true }) }
  }, [rows, searchParams, setSearchParams])
  useEffect(() => {
    if (!selected) { setDetailItems([]); setDetailPayments([]); return }
    let active = true
    setDetailError('')
    void Promise.all([
      db.from('order_items').select('id,product_name,quantity,unit_price,subtotal').eq('order_id', selected.id).order('created_at'),
      db.from('payment_records').select('*').eq('order_id', selected.id).order('paid_at', { ascending: false }),
    ]).then(([itemsResult, paymentsResult]) => {
      if (!active) return
      const loadError = itemsResult.error ?? paymentsResult.error
      if (loadError) setDetailError(errorMessage(loadError))
      else {
        setDetailItems((itemsResult.data ?? []) as OrderItem[])
        setDetailPayments((paymentsResult.data ?? []) as PaymentRecord[])
      }
    })
    return () => { active = false }
  }, [selected])
  useEffect(() => {
    if (!familyId || rows.length === 0) { setReceived({}); return }
    let active = true
    void db.from('payment_records').select('order_id,amount').in('order_id', rows.map((row) => row.id)).then(({ data, error: paymentError }) => {
      if (paymentError) { console.error('Falha ao consultar pagamentos', paymentError); return }
      if (!active) return
      const totals: Record<string, number> = {}
      for (const row of data ?? []) {
        if (row.order_id) totals[row.order_id] = (totals[row.order_id] ?? 0) + Number(row.amount)
      }
      setReceived(totals)
    })
    return () => { active = false }
  }, [rows, familyId])
  const submit = form.handleSubmit(async (values) => {
    if (!familyId) return
    setSaving(true); setSaveError('')
    const result = editing
      ? await db.rpc('update_order_with_items', {
          target_order: editing.id, customer: values.customer_name, phone: values.customer_phone ?? '',
          deadline: values.due_date, order_notes: values.notes ?? '', items: values.items,
        })
      : await db.rpc('create_order_with_items', {
          target_family: familyId, customer: values.customer_name, phone: values.customer_phone ?? '',
          deadline: values.due_date, order_notes: values.notes ?? '', items: values.items,
        })
    const insertError = result.error
    if (insertError) setSaveError(errorMessage(insertError))
    else { form.reset(); setShowForm(false); reload() }
    setSaving(false)
  })
  const editOrder = async (order: Order) => {
    if (!familyId) return
    setSaveError('')
    const { data, error: itemsError } = await db.from('order_items').select('product_name,quantity,unit_price').eq('order_id', order.id).order('created_at')
    if (itemsError) { setSaveError(errorMessage(itemsError)); return }
    setEditing(order)
    form.reset({
      customer_name: order.customer_name,
      customer_phone: order.customer_phone ?? '',
      items: (data ?? []).map((item) => ({ product_name: item.product_name, quantity: item.quantity, unit_price: Number(item.unit_price) })),
      due_date: order.due_date,
      notes: order.notes ?? '',
    })
    setShowForm(true)
  }
  const closeOrderForm = () => { setShowForm(false); setEditing(null); setSaveError(''); form.reset() }
  const nextStatus: Record<Order['status'], Order['status'] | null> = { todo: 'in_progress', in_progress: 'ready', ready: 'delivered', delivered: null, cancelled: null }
  const advance = async (order: Order) => {
    const status = nextStatus[order.status]
    if (!status) return
    const { error: statusError } = await db.from('orders').update({ status, ...(status === 'delivered' ? { delivery_date: localDate() } : {}) }).eq('id', order.id)
    if (statusError) alert(errorMessage(statusError)); else reload()
  }
  const cancelOrder = async (order: Order) => {
    if (!window.confirm(`Cancelar a encomenda de ${order.customer_name}? O histórico de pagamentos será preservado.`)) return
    const { error: statusError } = await db.from('orders').update({ status: 'cancelled' }).eq('id', order.id)
    if (statusError) alert(errorMessage(statusError)); else reload()
  }
  const reactivateOrder = async (order: Order) => {
    if (!window.confirm(`Reativar a encomenda de ${order.customer_name}?`)) return
    const { error: statusError } = await db.from('orders').update({ status: 'todo' }).eq('id', order.id)
    if (statusError) alert(errorMessage(statusError)); else reload()
  }
  const recordOrderPayment = async (values: PaymentFormValues) => {
    if (!paymentTarget) return
    setPaymentSaving(true)
    setPaymentError('')
    try {
      const { error: paymentRequestError } = await db.rpc('record_order_payment', {
        target_order: paymentTarget.id,
        payment_amount: values.amount,
        method: values.method,
        payment_time: values.paymentTime,
        payment_note: values.note,
      })
      if (paymentRequestError) {
        setPaymentError(errorMessage(paymentRequestError))
        return
      }
      setPaymentTarget(null)
      reload()
    } catch (requestError) {
      setPaymentError(errorMessage(requestError))
    } finally {
      setPaymentSaving(false)
    }
  }
  const normalizedSearch = search.trim().toLocaleLowerCase('pt-BR')
  const visible = rows.filter((row) =>
    (filter === 'all' || row.status === filter)
    && (!normalizedSearch || [row.customer_name, row.customer_phone ?? '', row.description]
      .some((value) => value.toLocaleLowerCase('pt-BR').includes(normalizedSearch))),
  )
  return <div className="page-stack"><PageHeading title="Encomendas" description="Acompanhe o andamento, os prazos e os valores a receber." action={<button className="button primary" onClick={() => setShowForm(!showForm)}><Plus size={18} />Nova encomenda</button>} />
    <div className="filter-row"><div className="filter-tabs">{[['all', 'Todas'], ['todo', 'A fazer'], ['in_progress', 'Em andamento'], ['ready', 'Prontas'], ['delivered', 'Entregues'], ['cancelled', 'Canceladas']].map(([key, label]) => <button key={key} onClick={() => setFilter(key)} className={filter === key ? 'selected' : ''}>{label}</button>)}</div><SearchInput value={search} onChange={setSearch} placeholder="Buscar cliente, telefone ou produto" /></div>
    {showForm && <section className="panel form-panel"><div className="panel-heading"><div><h2>{editing ? 'Editar encomenda' : 'Cadastrar encomenda'}</h2><p className="muted">O total é calculado pelos itens e não conta como valor recebido.</p></div><button className="icon-button" onClick={closeOrderForm} aria-label="Fechar formulário"><X /></button></div>
      <form onSubmit={submit} className="form-grid"><Field label="Nome do cliente" error={form.formState.errors.customer_name?.message}><input {...form.register('customer_name')} /></Field><Field label="Telefone (opcional)"><input type="tel" {...form.register('customer_phone')} /></Field>
        <div className="full-span item-editor"><div className="item-editor-heading"><strong>Produtos da encomenda</strong><button type="button" className="button secondary small" onClick={() => itemFields.append({ product_name: '', quantity: 1, unit_price: 0 })}><Plus size={15} />Adicionar produto</button></div>
          {itemFields.fields.map((item, index) => <div className="item-fields" key={item.id}><Field label="Produto" error={form.formState.errors.items?.[index]?.product_name?.message}><input {...form.register(`items.${index}.product_name`)} /></Field><Field label="Quantidade" error={form.formState.errors.items?.[index]?.quantity?.message}><input type="number" min="1" {...form.register(`items.${index}.quantity`)} /></Field><Field label="Preço unitário (R$)" error={form.formState.errors.items?.[index]?.unit_price?.message}><input type="number" min="0" step="0.01" {...form.register(`items.${index}.unit_price`)} /></Field>{itemFields.fields.length > 1 && <button type="button" className="icon-button danger" aria-label={`Remover produto ${index + 1}`} onClick={() => itemFields.remove(index)}><Trash2 size={17} /></button>}</div>)}
          <div className="form-total"><span>Total da encomenda</span><strong>{money((form.watch('items') ?? []).reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.unit_price || 0), 0))}</strong></div>
        </div>
        <Field label="Prazo" error={form.formState.errors.due_date?.message}><input type="date" {...form.register('due_date')} /></Field><Field label="Observações"><input {...form.register('notes')} /></Field>
        {saveError && <p className="form-error full-span">{saveError}</p>}<div className="form-actions full-span"><button type="button" className="button secondary" onClick={closeOrderForm}>Cancelar</button><button className="button primary" disabled={saving}>{saving ? 'Salvando...' : 'Salvar encomenda'}</button></div></form></section>}
    {error && <ErrorBanner message={error} />}{loading ? <Loading /> : visible.length === 0 ? <section className="panel"><EmptyState title="Nenhuma encomenda encontrada" text={normalizedSearch || filter !== 'all' ? 'Tente ajustar a busca ou o filtro de status.' : 'Cadastre uma encomenda para acompanhar sua produção.'} /></section> : <div className="orders-grid">{visible.map((order) => <OrderCard key={order.id} order={order} received={received[order.id] ?? 0} onOpen={() => setSelected(order)} onEdit={() => void editOrder(order)} onAdvance={() => void advance(order)} onPayment={() => { setPaymentError(''); setPaymentTarget(order) }} onCancel={() => void cancelOrder(order)} onReactivate={() => void reactivateOrder(order)} />)}</div>}
    {paymentTarget && <PaymentDialog title={`Registrar recebimento · ${paymentTarget.customer_name}`} maximum={Math.max(Number(paymentTarget.total_amount) - (received[paymentTarget.id] ?? 0), 0)} error={paymentError} saving={paymentSaving} onClose={() => setPaymentTarget(null)} onSubmit={recordOrderPayment} />}
    {selected && <RecordDialog title={`Encomenda de ${selected.customer_name}`} onClose={() => setSelected(null)}><DetailLine label="Descrição" value={selected.description} /><DetailLine label="Telefone" value={selected.customer_phone || 'Não informado'} /><DetailLine label="Status" value={orderStatusLabel(selected.status)} /><DetailLine label="Data do pedido" value={date(selected.order_date)} /><DetailLine label="Prazo" value={date(selected.due_date)} /><DetailLine label="Total" value={money(selected.total_amount)} /><DetailLine label="Recebido" value={money(received[selected.id] ?? 0)} /><DetailLine label="Saldo" value={money(Math.max(Number(selected.total_amount) - (received[selected.id] ?? 0), 0))} /><DetailLine label="Observações" value={selected.notes || 'Sem observações'} /><h3>Produtos</h3>{detailItems.map((item) => <div className="list-row" key={item.id}><div className="row-main"><strong>{item.quantity} × {item.product_name}</strong><small>{money(item.unit_price)} cada</small></div><strong>{money(item.subtotal)}</strong></div>)}<h3>Histórico de recebimentos</h3>{detailPayments.length ? detailPayments.map((payment) => <div className="list-row" key={payment.id}><div className="row-main"><strong>{money(payment.amount)} · {paymentLabel(payment.payment_method)}</strong><small>{date(payment.paid_at)}{payment.notes ? ` · ${payment.notes}` : ''}</small></div></div>) : <p className="muted">Nenhum recebimento registrado.</p>}{detailError && <ErrorBanner message={detailError} />}</RecordDialog>}
  </div>
}

function OrderCard({ order, received, onOpen, onEdit, onAdvance, onPayment, onCancel, onReactivate }: { order: Order; received: number; onOpen: () => void; onEdit: () => void; onAdvance: () => void; onPayment: () => void; onCancel: () => void; onReactivate: () => void }) {
  const today = localDate()
  const overdue = order.due_date < today && !['delivered', 'cancelled'].includes(order.status)
  const remaining = Math.max(Number(order.total_amount) - received, 0)
  const label: Record<Order['status'], string> = { todo: 'A fazer', in_progress: 'Em andamento', ready: 'Pronta', delivered: 'Entregue', cancelled: 'Cancelada' }
  const next: Record<Order['status'], string> = { todo: 'Iniciar produção', in_progress: 'Marcar como pronta', ready: 'Marcar entregue', delivered: '', cancelled: '' }
  return <article className="panel order-card"><div className="order-card-top"><StatusBadge tone={overdue ? 'red' : order.status === 'ready' ? 'green' : 'blue'}>{label[order.status]}</StatusBadge><span className="muted">{overdue ? 'Prazo vencido' : `Prazo ${date(order.due_date)}`}</span></div><h2>{order.customer_name}</h2><p>{order.description}</p><div className="order-money"><div><small>Total</small><strong>{money(order.total_amount)}</strong></div><div><small>Recebido</small><strong>{money(received)}</strong></div><div><small>Falta receber</small><strong>{money(remaining)}</strong></div></div>
    <div className="order-card-actions"><button className="button secondary small" onClick={onOpen}><Eye size={15} />Detalhes</button><button className="button secondary small" onClick={onEdit}><Pencil size={15} />Editar</button>{remaining > 0 && order.status !== 'cancelled' && <button className="button secondary small" onClick={onPayment}>Registrar recebimento</button>}{next[order.status] && <button className="button primary small" onClick={onAdvance}>{next[order.status]}</button>}{order.status === 'cancelled' && <button className="button success small" onClick={onReactivate}>Reativar</button>}{!['cancelled', 'delivered'].includes(order.status) && <button className="button small danger-text" onClick={onCancel}>Cancelar</button>}</div>
  </article>
}

function ReportsPage() {
  const sales = useFamilyRows<Sale>('sales')
  const expenses = useFamilyRows<Expense>('expenses')
  const orders = useFamilyRows<Order>('orders')
  const paymentRows = useFamilyRows<PaymentRecord>('payment_records')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const payments = paymentRows.rows
  const inRange = (value: string) => {
    const day = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fortalezaDate(value)
    return (!fromDate || day >= fromDate) && (!toDate || day <= toDate)
  }
  const rangedSales = sales.rows.filter((row) => inRange(row.sold_at))
  const rangedExpenses = expenses.rows.filter((row) => inRange(row.due_date))
  const rangedOrders = orders.rows.filter((row) => inRange(row.order_date))
  const rangedPayments = payments.filter((payment) => inRange(payment.paid_at))
  const receivedPayments = rangedPayments.filter((payment) => payment.payment_type === 'order')
  const expensePayments = rangedPayments.filter((payment) => payment.payment_type === 'expense')
  const received = receivedPayments.reduce((sum, row) => sum + Number(row.amount), 0)
  const paid = expensePayments.reduce((sum, row) => sum + Number(row.amount), 0)
  const salesTotal = rangedSales.reduce((sum, row) => sum + Number(row.total_amount), 0)
  const unpaid = rangedExpenses.filter((row) => row.status === 'pending').reduce((sum, row) => sum + Number(row.amount), 0)
  const ordersInRangeIds = new Set(rangedOrders.filter((row) => row.status !== 'cancelled').map((row) => row.id))
  const orderReceived = payments.filter((payment) => payment.payment_type === 'order' && payment.order_id && ordersInRangeIds.has(payment.order_id))
    .reduce((sum, row) => sum + Number(row.amount), 0)
  const toReceive = rangedOrders.filter((row) => row.status !== 'cancelled').reduce((sum, row) => sum + Number(row.total_amount), 0) - orderReceived
  const exportCsv = () => {
    const lines = [['Tipo', 'Descrição', 'Data', 'Valor'], ...rangedSales.map((row) => ['Venda', row.product_name, row.sold_at, String(row.total_amount)]), ...rangedExpenses.map((row) => ['Conta', row.description, row.due_date, String(row.amount)]), ...rangedOrders.map((row) => ['Encomenda', `${row.customer_name} - ${row.description}`, row.due_date, String(row.total_amount)]), ...rangedPayments.map((row) => [row.payment_type === 'order' ? 'Recebimento' : 'Pagamento de conta', row.notes ?? '', row.paid_at, String(row.amount)])]
    const csv = lines.map((line) => line.map((cell) => `"${safeCsv(cell)}"`).join(';')).join('\r\n')
    const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a'); link.href = url; link.download = 'relatorio-organiza-familia.csv'; link.click(); URL.revokeObjectURL(url)
  }
  const products = new Map<string, number>()
  for (const row of rangedSales) products.set(row.product_name, (products.get(row.product_name) ?? 0) + row.quantity)
  const topProducts = [...products].sort((a, b) => b[1] - a[1]).slice(0, 5)
  const reportLoading = sales.loading || expenses.loading || orders.loading
  return <div className="page-stack"><PageHeading title="Relatórios" description="Veja os valores registrados sem misturar vendas, recebimentos e contas." action={<button className="button secondary" onClick={exportCsv}><ArrowDownLeft size={18} />Exportar CSV</button>} />
    <div className="report-filters"><Field label="De"><input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></Field><Field label="Até"><input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></Field><button className="button secondary small" onClick={() => { setFromDate(''); setToDate('') }}>Todo o período</button></div>
    {[sales.error, expenses.error, orders.error, paymentRows.error].filter(Boolean).map((message) => <ErrorBanner key={message} message={message} />)}
    {reportLoading || paymentRows.loading ? <Loading /> : <>
      <div className="report-warning"><CircleAlert size={19} /><span>Vendas brutas não representam lucro. O saldo a receber considera pagamentos registrados de encomendas.</span></div>
      <section className="stats-grid report-stats"><StatCard icon={ArrowUpRight} label="Vendas brutas" value={money(salesTotal)} detail={`${rangedSales.length} registros`} tone="blue" /><StatCard icon={ArrowDownLeft} label="Recebimentos de encomendas" value={money(received)} detail="Pagamentos no período" tone="green" /><StatCard icon={Wallet} label="Contas efetivamente pagas" value={money(paid)} detail="Pagamentos no período" tone="green" /><StatCard icon={CreditCard} label="Contas pendentes" value={money(unpaid)} detail={`${rangedExpenses.filter((row) => row.status === 'pending').length} contas`} tone="orange" /><StatCard icon={ClipboardList} label="Encomendas a receber" value={money(Math.max(0, toReceive))} detail="Por data do pedido selecionado" tone="blue" /></section>
      <section className="panel"><h2>Encomendas por etapa</h2><div className="status-counts">{[['A fazer', 'todo'], ['Em andamento', 'in_progress'], ['Prontas', 'ready'], ['Entregues', 'delivered'], ['Canceladas', 'cancelled']].map(([label, status]) => <div key={status}><span>{label}</span><strong>{rangedOrders.filter((row) => row.status === status).length}</strong></div>)}</div></section>
      <section className="panel"><h2>Produtos mais vendidos</h2>{topProducts.length ? <div className="status-counts product-counts">{topProducts.map(([name, quantity]) => <div key={name}><span>{name}</span><strong>{quantity} un.</strong></div>)}</div> : <p className="muted">Ainda não há vendas suficientes para este período.</p>}</section>
    </>}</div>
}

function SettingsPage() {
  const { familyId, familyName } = useAppState()
  const { rows, loading, error, reload } = useFamilyRows<Category>('categories')
  const [name, setName] = useState('')
  const [newCategoryColor, setNewCategoryColor] = useState(categoryPalette[0])
  const [categoryEdit, setCategoryEdit] = useState<{ id: string; name: string; color: string } | null>(null)
  const [message, setMessage] = useState('')
  const [backupBusy, setBackupBusy] = useState(false)
  const [backupError, setBackupError] = useState('')
  useEffect(() => {
    setNewCategoryColor(categoryPalette[rows.length % categoryPalette.length])
  }, [rows.length])
  const addCategory = async (event: FormEvent) => {
    event.preventDefault()
    if (!familyId || !name.trim()) return
    const { error: insertError } = await db.from('categories').insert({ name: name.trim(), color: newCategoryColor, family_id: familyId })
    if (insertError) setMessage(errorMessage(insertError))
    else { setName(''); setNewCategoryColor(categoryPalette[(rows.length + 1) % categoryPalette.length]); setMessage('Categoria adicionada.'); reload() }
  }
  const saveCategory = async (event: FormEvent) => {
    event.preventDefault()
    if (!categoryEdit || !categoryEdit.name.trim()) return
    const { error: updateError } = await db.from('categories').update({ name: categoryEdit.name.trim(), color: categoryEdit.color }).eq('id', categoryEdit.id)
    if (updateError) setMessage(errorMessage(updateError))
    else { setCategoryEdit(null); setMessage('Categoria atualizada.'); reload() }
  }
  const removeCategory = async (category: Category) => {
    if (!window.confirm(`Excluir a categoria "${category.name}"? Contas que a utilizam podem impedir a exclusão.`)) return
    const { error: deleteError } = await db.from('categories').delete().eq('id', category.id)
    if (deleteError) setMessage(errorMessage(deleteError))
    else { setMessage('Categoria excluída.'); reload() }
  }
  const exportBackup = async () => {
    if (!familyId) return
    setBackupBusy(true); setBackupError('')
    try {
      const [sales, expenses, orders, orderItems, payments, familyCategories] = await Promise.all([
        fetchFamilyPages('sales', familyId),
        fetchFamilyPages('expenses', familyId),
        fetchFamilyPages('orders', familyId),
        fetchFamilyPages('order_items', familyId),
        fetchFamilyPages('payment_records', familyId),
        fetchFamilyPages('categories', familyId),
      ])
      const backup = {
        format: 'organiza-familia-export-v1',
        generated_at: new Date().toISOString(),
        family: { id: familyId, name: familyName },
        tables: {
          sales, expenses, orders, order_items: orderItems, payment_records: payments, categories: familyCategories,
        },
        note: 'Exportação JSON dos registros visíveis. Não inclui os logs de auditoria nem substitui backup restaurável do PostgreSQL.',
      }
      downloadJson(backup, `organiza-familia-${localDate()}-export.json`)
    } catch (exportError) {
      setBackupError(errorMessage(exportError))
    } finally {
      setBackupBusy(false)
    }
  }
  return <div className="page-stack"><PageHeading title="Configurações" description="Gerencie categorias e exporte os dados da família." />
    <section className="panel"><div className="panel-heading"><div><h2>Espaço da família</h2><p className="muted">Este espaço está aberto publicamente e não exige login.</p></div><span className="status-badge orange">{familyName}</span></div><div className="settings-links"><a href="#categorias"><Settings /><span><strong>Categorias de contas</strong><small>Organize as despesas</small></span><ChevronRight /></a></div></section>
    <section className="panel" id="categorias"><h2>Categorias de contas</h2><p className="muted">Escolha uma cor para identificar cada categoria nas contas.</p>{error && <ErrorBanner message={error} />}{loading ? <Loading /> : <div className="category-list">{rows.map((category) => <span className="category-chip" key={category.id} style={{ '--category-color': category.color } as CSSProperties}>{category.name}<button aria-label={`Editar categoria ${category.name}`} onClick={() => setCategoryEdit({ id: category.id, name: category.name, color: category.color })}><Pencil size={13} /></button><button aria-label={`Excluir categoria ${category.name}`} onClick={() => void removeCategory(category)}><X size={13} /></button></span>)}{rows.length === 0 && <p className="muted">Ainda não há categorias cadastradas.</p>}</div>}
      {categoryEdit && <form className="inline-form category-form" onSubmit={(event) => void saveCategory(event)}><Field label="Editar categoria"><input value={categoryEdit.name} onChange={(event) => setCategoryEdit({ ...categoryEdit, name: event.target.value })} maxLength={80} required /></Field><Field label="Cor"><input aria-label="Cor da categoria" type="color" value={categoryEdit.color} onChange={(event) => setCategoryEdit({ ...categoryEdit, color: event.target.value })} /></Field><button className="button primary">Salvar</button><button type="button" className="button secondary" onClick={() => setCategoryEdit(null)}>Cancelar</button></form>}
      <form className="inline-form category-form" onSubmit={(event) => void addCategory(event)}><Field label="Nova categoria"><input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required /></Field><Field label="Cor"><input aria-label="Cor da nova categoria" type="color" value={newCategoryColor} onChange={(event) => setNewCategoryColor(event.target.value)} /></Field><button className="button secondary"><Plus size={17} />Adicionar</button></form>{message && <p className={/adicionada|atualizada|excluída/.test(message) ? 'success-message' : 'form-error'}>{message}</p>}
    </section><section className="panel"><h2>Exportação dos dados</h2><p className="muted">Baixe um JSON com os registros da família e seus relacionamentos para consulta/portabilidade. Guarde o arquivo em local privado. A exportação não inclui logs de auditoria e não substitui um backup restaurável do PostgreSQL.</p><button className="button secondary" onClick={() => void exportBackup()} disabled={backupBusy}><ArrowDownLeft size={17} />{backupBusy ? 'Preparando exportação...' : 'Exportar dados da família (JSON)'}</button>{backupError && <ErrorBanner message={backupError} />}</section><section className="panel"><h2>Backup e recuperação</h2><p className="muted">Configure backups do PostgreSQL no painel Neon e teste a restauração periodicamente. Nunca compartilhe a variável privada DATABASE_URL.</p></section>
  </div>
}

function PageHeading({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="page-heading"><div><h2>{title}</h2><p className="muted">{description}</p></div>{action}</div>
}
function CategoryBadge({ category }: { category: Category | undefined }) {
  if (!category) return <span className="category-badge uncategorized">Sem categoria</span>
  return <span className="category-badge" style={{ '--category-color': category.color } as CSSProperties}>{category.name}</span>
}
function StatCard({ icon: Icon, label, value, detail, tone }: { icon: typeof House; label: string; value: string; detail: string; tone: string }) {
  return <article className="stat-card"><div className={`stat-icon ${tone}`}><Icon size={20} /></div><div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div></article>
}
function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return <label className="field"><span>{label}</span>{children}{error && <small className="field-error">{error}</small>}</label>
}
function StatusBadge({ tone, children }: { tone: string; children: ReactNode }) { return <span className={`status-badge ${tone}`}>{children}</span> }
function EmptyState({ title, text }: { title: string; text: string }) { return <div className="empty-state"><div className="empty-icon"><CalendarDays size={21} /></div><strong>{title}</strong><p>{text}</p></div> }
function Loading() { return <div className="loading-state" role="status">Carregando dados...</div> }
function ErrorBanner({ message }: { message: string }) { return <div className="error-banner" role="alert"><CircleAlert size={18} />{message}</div> }
function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="search-input"><Search size={18} /><input aria-label={placeholder} placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} /></label>
}
type PaymentFormValues = {
  amount: number
  method: 'cash' | 'pix' | 'other'
  paymentTime: string
  note: string | null
}
function PaymentDialog({ title, maximum, fixedAmount, error, saving, onClose, onSubmit }: {
  title: string
  maximum: number
  fixedAmount?: number
  error: string
  saving: boolean
  onClose: () => void
  onSubmit: (values: PaymentFormValues) => Promise<void>
}) {
  const schema = z.object({
    amount: z.coerce.number().positive('Informe um valor maior que zero.'),
    method: z.enum(['cash', 'pix', 'other']),
    paid_at: z.string().min(1, 'Informe a data do pagamento.'),
    note: z.string().max(500, 'Use até 500 caracteres.'),
  })
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      amount: fixedAmount ?? maximum,
      method: 'cash' as const,
      paid_at: localDateTime(),
      note: '',
    },
  })
  const submit = form.handleSubmit(async (values) => {
    if (values.amount > maximum) {
      form.setError('amount', { message: `O valor não pode ultrapassar ${money(maximum)}.` })
      return
    }
    if (fixedAmount !== undefined && values.amount !== fixedAmount) {
      form.setError('amount', { message: `A conta deve ser quitada integralmente: ${money(fixedAmount)}.` })
      return
    }
    const paidAt = new Date(values.paid_at)
    if (Number.isNaN(paidAt.getTime())) {
      form.setError('paid_at', { message: 'Informe uma data válida.' })
      return
    }
    await onSubmit({
      amount: values.amount,
      method: values.method,
      paymentTime: paidAt.toISOString(),
      note: values.note.trim() || null,
    })
  })
  return <RecordDialog title={title} onClose={onClose}>
    <DetailLine label={fixedAmount === undefined ? 'Saldo disponível' : 'Valor para quitação'} value={money(maximum)} />
    <form className="form-grid payment-form" onSubmit={(event) => void submit(event)}>
      <Field label="Valor recebido/pago (R$)" error={form.formState.errors.amount?.message}>
        <input type="number" min="0.01" max={maximum} step="0.01" readOnly={fixedAmount !== undefined} {...form.register('amount')} />
      </Field>
      <Field label="Forma de pagamento">
        <select {...form.register('method')}><PaymentOptions /></select>
      </Field>
      <Field label="Data e hora" error={form.formState.errors.paid_at?.message}>
        <input type="datetime-local" {...form.register('paid_at')} />
      </Field>
      <Field label="Observação (opcional)" error={form.formState.errors.note?.message}>
        <input maxLength={500} {...form.register('note')} />
      </Field>
      {error && <div className="full-span"><ErrorBanner message={error} /></div>}
      <div className="form-actions full-span">
        <button type="button" className="button secondary" onClick={onClose} disabled={saving}>Cancelar</button>
        <button className="button primary" disabled={saving}>{saving ? 'Salvando...' : 'Confirmar pagamento'}</button>
      </div>
    </form>
  </RecordDialog>
}
function RecordDialog({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])
  return <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="record-dialog" role="dialog" aria-modal="true" aria-label={title}>
      <header><h2>{title}</h2><button className="icon-button" aria-label="Fechar detalhes" onClick={onClose}><X /></button></header>
      <div className="dialog-content">{children}</div>
    </section>
  </div>
}
function DetailLine({ label, value }: { label: string; value: string }) {
  return <div className="detail-line"><span>{label}</span><strong>{value}</strong></div>
}
function PaymentOptions() { return <><option value="cash">Dinheiro</option><option value="pix">Pix</option><option value="other">Outro</option></> }
function paymentLabel(method: string) { return method === 'cash' ? 'Dinheiro' : method === 'pix' ? 'Pix' : 'Outro' }
function orderStatusLabel(status: Order['status']) {
  const labels: Record<Order['status'], string> = { todo: 'A fazer', in_progress: 'Em andamento', ready: 'Pronta', delivered: 'Entregue', cancelled: 'Cancelada' }
  return labels[status]
}
function addDays(isoDate: string, days: number) {
  const dateValue = new Date(`${isoDate}T12:00:00-03:00`)
  dateValue.setDate(dateValue.getDate() + days)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Fortaleza' }).format(dateValue)
}
function localDateTime() {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}
function safeCsv(value: string) {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return safe.replaceAll('"', '""')
}
async function fetchFamilyPages(table: TableName, familyId: string): Promise<unknown[]> {
  const pageSize = 500
  const rows: unknown[] = []
  for (let start = 0; ; start += pageSize) {
    const { data, error } = await db.from(table).select('*').eq('family_id', familyId)
      .order('created_at', { ascending: true }).range(start, start + pageSize - 1)
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < pageSize) return rows
  }
}
function downloadJson(value: unknown, filename: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
function NotFoundPage() { return <main className="full-state"><h1>Página não encontrada</h1><p>Confira o endereço e tente novamente.</p><Link className="button primary" to="/">Voltar ao início</Link></main> }
