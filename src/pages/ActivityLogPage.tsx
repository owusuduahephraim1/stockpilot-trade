import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Boxes, CircleDollarSign, ContactRound, Download, PackagePlus, Search, Settings2, ShoppingCart, Trash2, Truck, UserRound, UsersRound } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { formatDateTime, money } from '@/lib/utils'
import type { ActivityLog, CurrencyCode } from '@/types/database'

type JsonRecord = Record<string, any>
type LookupRow = { id: string; name: string; sku?: string | null; manufacturer?: string | null }
type FeedItem = {
  id: string
  title: string
  reference?: string
  detail: string
  operator: string
  operatorEmail?: string
  when: string
  createdAt: string
  entityType: string
  action: string
  Icon: typeof ShoppingCart
  iconClass: string
  searchText: string
}

const record = (value: unknown): JsonRecord => value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}
const text = (value: unknown) => value == null ? '' : String(value)
const numeric = (value: unknown) => Number(value ?? 0)
const currency = (value: unknown): CurrencyCode => value === 'GBP' || value === 'USD' ? value : 'GHS'
const csvCell = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`
const RESET_PHRASE = 'DELETE ALL LOGS'

export function ActivityLogPage() {
  const { profile } = useAuth()
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [area, setArea] = useState('all')
  const [resetOpen, setResetOpen] = useState(false)
  const [resetPhrase, setResetPhrase] = useState('')
  const [resetMessage, setResetMessage] = useState('')
  const [resetError, setResetError] = useState('')

  const logs = useQuery({
    queryKey: ['activity-logs'],
    enabled: profile?.role === 'admin',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('id,user_id,action,entity_type,entity_id,details,created_at,profiles(full_name,email)')
        .order('created_at', { ascending: false })
        .limit(750)
      if (error) throw error
      return data as any as ActivityLog[]
    },
  })

  const lookups = useQuery({
    queryKey: ['activity-log-lookups'],
    enabled: profile?.role === 'admin',
    queryFn: async () => {
      const [products, suppliers, customers] = await Promise.all([
        supabase.from('products').select('id,name,sku,manufacturer'),
        supabase.from('suppliers').select('id,name'),
        supabase.from('customers').select('id,name'),
      ])
      if (products.error) throw products.error
      if (suppliers.error) throw suppliers.error
      if (customers.error) throw customers.error
      return {
        products: new Map((products.data || []).map((x: any) => [x.id, x as LookupRow])),
        suppliers: new Map((suppliers.data || []).map((x: any) => [x.id, x as LookupRow])),
        customers: new Map((customers.data || []).map((x: any) => [x.id, x as LookupRow])),
      }
    },
  })

  const resetAudit = useMutation({
    mutationFn: async () => {
      if (resetPhrase !== RESET_PHRASE) throw new Error(`Type ${RESET_PHRASE} exactly to continue.`)
      const { data, error } = await (supabase as any).rpc('reset_activity_logs', { confirm_phrase: resetPhrase })
      if (error) throw error
      return Number(data || 0)
    },
    onSuccess: async (deletedCount) => {
      setResetOpen(false)
      setResetPhrase('')
      setResetError('')
      setQ('')
      setArea('all')
      setResetMessage(`${deletedCount} audit event${deletedCount === 1 ? '' : 's'} permanently deleted. New operational activity will continue to be logged automatically.`)
      qc.setQueryData<ActivityLog[]>(['activity-logs'], [])
      await qc.invalidateQueries({ queryKey: ['activity-logs'] })
    },
    onError: (error: any) => setResetError(error?.message || 'The audit trail could not be reset.'),
  })

  const feed = useMemo<FeedItem[]>(() => {
    const maps = lookups.data
    return (logs.data || []).map(log => {
      const details = record(log.details)
      const before = record(details.before)
      const after = record(details.after)
      const data = log.action === 'delete' ? before : after
      const context = record(details.context)
      const actor = record(context.actor)
      const productContext = record(context.product)
      const supplierContext = record(context.supplier)
      const customerContext = record(context.customer)
      const currentProduct = maps?.products.get(text(data.product_id))
      const currentSupplier = maps?.suppliers.get(text(data.supplier_id))
      const currentCustomer = maps?.customers.get(text(data.customer_id))
      const productName = text(productContext.name) || currentProduct?.name || text(data.name) || 'Unknown product'
      const productSku = text(productContext.sku) || currentProduct?.sku || text(data.sku)
      const supplierName = text(supplierContext.name) || currentSupplier?.name || text(data.manufacturer) || 'Unassigned supplier'
      const customerName = text(customerContext.name) || currentCustomer?.name || text(data.customer_name) || 'Walk-in customer'
      const operator = text(actor.full_name) || log.profiles?.full_name || text(actor.email) || log.profiles?.email || 'System / removed user'
      const operatorEmail = text(actor.email) || log.profiles?.email || ''
      const action = log.action
      const entity = log.entity_type
      let title = `${entity.replaceAll('_',' ')} ${action}`
      let reference = ''
      let detail = log.entity_id ? `Record ${log.entity_id.slice(0,8)}…` : 'System event'
      let Icon = Settings2
      let iconClass = 'bg-slate-100 text-slate-600'

      if (entity === 'sales') {
        reference = text(data.sale_number)
        title = action === 'insert' ? 'Sale recorded' : action === 'delete' ? 'Sale deleted' : 'Sale updated'
        const payment = text(data.payment_method)
        detail = `${numeric(data.quantity)} × ${productName} · ${money(data.total_amount, currency(data.currency))} · ${customerName}${payment ? ` · ${payment}` : ''}`
        Icon = action === 'delete' ? Trash2 : ShoppingCart
        iconClass = action === 'delete' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'
      } else if (entity === 'purchases') {
        reference = text(data.purchase_number)
        title = action === 'insert' ? 'Purchase recorded' : action === 'delete' ? 'Purchase deleted' : 'Purchase updated'
        detail = `${numeric(data.quantity)} × ${productName} · ${money(data.total_cost, currency(data.currency))} · ${supplierName}`
        Icon = action === 'delete' ? Trash2 : Truck
        iconClass = action === 'delete' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-700'
      } else if (entity === 'products') {
        title = action === 'insert' ? 'Product added' : action === 'delete' ? 'Product deleted' : 'Product updated'
        reference = text(data.sku)
        if (action === 'update') {
          const changes: string[] = []
          if (before.low_stock_threshold !== after.low_stock_threshold) changes.push(`reorder ${text(before.low_stock_threshold)} → ${text(after.low_stock_threshold)}`)
          if (before.current_cost_price !== after.current_cost_price) changes.push(`cost ${money(before.current_cost_price, currency(after.currency || before.currency))} → ${money(after.current_cost_price, currency(after.currency || before.currency))}`)
          if (before.current_selling_price !== after.current_selling_price) changes.push(`sell ${money(before.current_selling_price, currency(after.currency || before.currency))} → ${money(after.current_selling_price, currency(after.currency || before.currency))}`)
          if (before.barcode !== after.barcode) changes.push('barcode changed')
          if (before.name !== after.name) changes.push(`${text(before.name)} → ${text(after.name)}`)
          detail = `${productName}${changes.length ? ` · ${changes.join(' · ')}` : productSku ? ` · ${productSku}` : ''}`
        } else detail = `${productName}${productSku ? ` · ${productSku}` : ''}`
        Icon = action === 'delete' ? Trash2 : Boxes
        iconClass = action === 'delete' ? 'bg-red-50 text-red-600' : 'bg-violet-50 text-violet-700'
      } else if (entity === 'exchange_rates') {
        const code = text(after.currency_code || before.currency_code)
        title = action === 'insert' ? 'Exchange rate set' : action === 'delete' ? 'Exchange rate removed' : 'Exchange rate updated'
        reference = code
        detail = action === 'update'
          ? `${code} rate changed from ${text(before.rate_to_ghs)} to ${text(after.rate_to_ghs)} GHS`
          : `${code} · ${text(data.rate_to_ghs)} GHS`
        Icon = CircleDollarSign
        iconClass = 'bg-amber-50 text-amber-700'
      } else if (entity === 'suppliers') {
        title = action === 'insert' ? 'Supplier added' : action === 'delete' ? 'Supplier removed' : 'Supplier updated'
        detail = `${text(data.name) || supplierName}${data.contact_person ? ` · ${text(data.contact_person)}` : ''}${data.phone ? ` · ${text(data.phone)}` : ''}`
        Icon = Truck
        iconClass = action === 'delete' ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-700'
      } else if (entity === 'customers') {
        title = action === 'insert' ? 'Customer added' : action === 'delete' ? 'Customer removed' : 'Customer updated'
        detail = `${text(data.name) || customerName}${data.phone ? ` · ${text(data.phone)}` : ''}${data.email ? ` · ${text(data.email)}` : ''}`
        Icon = ContactRound
        iconClass = action === 'delete' ? 'bg-red-50 text-red-600' : 'bg-cyan-50 text-cyan-700'
      } else if (entity === 'profiles') {
        title = action === 'insert' ? 'Staff user added' : action === 'delete' ? 'User removed' : 'User access updated'
        detail = `${text(data.full_name) || text(data.email)}${data.role ? ` · ${text(data.role)}` : ''}`
        Icon = action === 'delete' ? UserRound : UsersRound
        iconClass = action === 'delete' ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-700'
      } else if (entity === 'app_settings') {
        title = 'Business settings updated'
        detail = text(data.business_name) || 'Operational settings changed'
        Icon = Settings2
      } else if (entity.includes('purchase')) {
        Icon = PackagePlus
        iconClass = 'bg-blue-50 text-blue-700'
      }

      const when = formatDateTime(log.created_at)
      const searchText = [title, reference, detail, operator, operatorEmail, entity, action].join(' ').toLowerCase()
      return { id: log.id, title, reference, detail, operator, operatorEmail, when, createdAt: log.created_at, entityType: entity, action, Icon, iconClass, searchText }
    })
  }, [logs.data, lookups.data])

  const filtered = useMemo(() => feed.filter(item => {
    const matchesText = !q.trim() || item.searchText.includes(q.trim().toLowerCase())
    const matchesArea = area === 'all' || area === item.entityType || (area === 'transactions' && (item.entityType === 'sales' || item.entityType === 'purchases')) || (area === 'partners' && (item.entityType === 'customers' || item.entityType === 'suppliers'))
    return matchesText && matchesArea
  }), [feed, q, area])

  const exportLog = () => {
    const rows = [
      ['Timestamp','Operator','Operator email','Event','Reference','Operational detail','Area','Action'],
      ...filtered.map(x => [x.when,x.operator,x.operatorEmail,x.title,x.reference || '',x.detail,x.entityType,x.action]),
    ]
    const csv = rows.map(row => row.map(csvCell).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `stockpilot-audit-log-${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (profile?.role !== 'admin') return <><PageHeader title="Activity log" description="Administrative audit history."/><Card><p className="text-sm text-slate-600">Only an Admin/Owner can view the audit trail.</p></Card></>

  return <>
    <PageHeader title="Activity log" description="A traceable record of important changes and transactions." />
    <Card className="overflow-hidden p-0">
      <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="font-bold text-slate-950">Audit trail</h3>
          <p className="mt-1 text-xs text-slate-500">Protected operational history for owner oversight</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 sm:w-64"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/><Input className="pl-9" placeholder="Search audit trail..." value={q} onChange={e => setQ(e.target.value)} /></div>
          <select className="sm:w-44" value={area} onChange={e => setArea(e.target.value)}>
            <option value="all">All activity</option>
            <option value="transactions">Sales & purchases</option>
            <option value="sales">Sales only</option>
            <option value="purchases">Purchases only</option>
            <option value="products">Products</option>
            <option value="partners">Customers & suppliers</option>
            <option value="exchange_rates">Exchange rates</option>
          </select>
          <Button variant="secondary" onClick={exportLog} disabled={!filtered.length}><Download className="h-4 w-4"/>Export log</Button>
          <Button variant="danger" onClick={() => { setResetMessage(''); setResetError(''); setResetPhrase(''); setResetOpen(true) }} disabled={!feed.length}><Trash2 className="h-4 w-4"/>Delete all logs</Button>
        </div>
      </div>

      {resetMessage && <div className="border-b border-slate-200 bg-slate-50 px-5 py-2 text-xs font-medium text-slate-600">{resetMessage}</div>}

      <div className="bounded-list max-h-[calc(100dvh-270px)] divide-y divide-slate-100 !p-0">
        {filtered.map(item => {
          const Icon = item.Icon
          return <div key={item.id} className="grid gap-3 px-5 py-4 transition hover:bg-slate-50/70 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:gap-4">
            <div className={`grid h-10 w-10 place-items-center rounded-full ${item.iconClass}`}><Icon className="h-4.5 w-4.5"/></div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-slate-950">{item.title}</span>
                {item.reference && <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-700">{item.reference}</span>}
              </div>
              <p className="mt-1 truncate text-xs text-slate-500 sm:text-[13px]" title={item.detail}>{item.detail}</p>
            </div>
            <div className="pl-13 text-left sm:min-w-40 sm:pl-0 sm:text-right">
              <div className="text-xs font-semibold text-slate-700">{item.operator}</div>
              <div className="mt-1 text-[11px] text-slate-400">{item.when}</div>
            </div>
          </div>
        })}
        {!filtered.length && <div className="px-5 py-12 text-center text-sm text-slate-500">No matching operational activity yet.</div>}
      </div>
      <div className="border-t border-slate-200 bg-slate-50/70 px-5 py-3 text-xs text-slate-500">Showing {filtered.length} of {feed.length} retained audit events. New records are generated automatically by the database. Only an Owner/Admin can perform an explicit permanent audit reset.</div>
    </Card>

    <Modal
      open={resetOpen}
      onClose={() => { if (!resetAudit.isPending) { setResetOpen(false); setResetPhrase(''); setResetError('') } }}
      title="Permanently delete audit trail"
      description="Owner/Admin destructive reset. This action cannot be undone."
      size="md"
      footer={<><Button variant="secondary" onClick={() => { setResetOpen(false); setResetPhrase(''); setResetError('') }} disabled={resetAudit.isPending}>Cancel</Button><Button variant="danger" onClick={() => resetAudit.mutate()} disabled={resetAudit.isPending || resetPhrase !== RESET_PHRASE}>{resetAudit.isPending ? 'Deleting...' : 'Delete all logs permanently'}</Button></>}
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800">
          This permanently deletes the complete Activity Log currently stored in StockPilot. Product, purchase, sale, customer, supplier, inventory, user, and R2 document data are not deleted. New operational activity will start building a fresh audit history immediately after the reset.
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Export the audit log first if you need to retain a compliance or management copy.
        </div>
        {resetError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-800">{resetError}</div>}
        <div>
          <label>Type <span className="font-mono text-red-700">{RESET_PHRASE}</span> to confirm</label>
          <Input autoFocus value={resetPhrase} onChange={e => { setResetPhrase(e.target.value); if (resetError) setResetError('') }} placeholder={RESET_PHRASE} autoComplete="off" />
        </div>
      </div>
    </Modal>
  </>
}