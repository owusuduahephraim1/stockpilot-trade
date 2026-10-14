import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { History, PackagePlus, Plus, Search, ShoppingCart } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { CameraBarcodeButton } from '@/components/BarcodeScanner'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { supabase } from '@/lib/supabase'
import { formatDate, money } from '@/lib/utils'
import type { InventoryRow, StockMovement } from '@/types/database'

export function InventoryPage(){
 const navigate=useNavigate();const [q,setQ]=useState(''),[selected,setSelected]=useState<InventoryRow|null>(null)
 const inventory=useQuery({queryKey:['inventory'],queryFn:async()=>{const {data,error}=await supabase.from('product_inventory').select('*').order('name');if(error)throw error;return data as InventoryRow[]}})
 const movements=useQuery({queryKey:['stock-movements',selected?.product_id],enabled:!!selected,queryFn:async()=>{const {data,error}=await supabase.from('stock_movements').select('*').eq('product_id',selected!.product_id).order('movement_date',{ascending:false}).order('created_at',{ascending:false}).limit(100);if(error)throw error;return data as StockMovement[]}})
 const filtered=useMemo(()=>(inventory.data||[]).filter(x=>`${x.name} ${x.sku} ${x.barcode||''} ${x.category||''}`.toLowerCase().includes(q.toLowerCase())),[inventory.data,q])
 return <>
 <PageHeader title="Inventory control" description="Monitor stock on hand, value at cost and potential margin." actions={<><CameraBarcodeButton label="Scan barcode" onScan={value=>setQ(value)}/><Button onClick={()=>navigate('/products?new=1')} className="bg-emerald-700 hover:bg-emerald-800"><Plus className="h-4 w-4"/>Add product</Button></>}/>
 <div className="workspace-register">
  <div className="workspace-register-toolbar"><div><div className="workspace-register-title">Inventory register</div><div className="workspace-register-subtitle">{filtered.length} product{filtered.length===1?'':'s'} · prices remain in catalog currencies while stock value is normalized to GHS</div></div><div className="relative w-full max-w-sm"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/><Input className="pl-9" placeholder="Search product, SKU, barcode..." value={q} onChange={e=>setQ(e.target.value)}/></div></div>
  <div className="table-wrap"><table><thead><tr><th>Product</th><th>SKU / Barcode</th><th>Category</th><th>On hand</th><th>Value at cost</th><th>Selling price</th><th>Status</th><th>Actions</th></tr></thead><tbody>{filtered.map(x=><tr key={x.product_id}><td><button className="font-semibold hover:text-emerald-700 hover:underline" onClick={()=>setSelected(x)}>{x.name}</button><div className="text-xs text-slate-500">{x.manufacturer||'—'}</div></td><td><div className="font-mono font-semibold">{x.sku}</div><div className="font-mono text-xs text-slate-500">{x.barcode||'—'}</div></td><td>{x.category||'—'}</td><td className="font-semibold">{x.quantity_on_hand}</td><td>{money(x.total_invested,'GHS')}</td><td>{money(x.current_selling_price,x.currency)}</td><td><Badge className={x.is_low_stock?'bg-amber-100 text-amber-800':'bg-emerald-100 text-emerald-800'}>{x.quantity_on_hand<=0?'OUT OF STOCK':x.is_low_stock?'LOW STOCK':'IN STOCK'}</Badge></td><td><div className="flex gap-1"><Button variant="ghost" title="New sale" onClick={()=>navigate(`/sales?new=1&search=${encodeURIComponent(x.sku)}`)}><ShoppingCart className="h-4 w-4"/></Button><Button variant="ghost" title="New purchase" onClick={()=>navigate(`/purchases?new=1&search=${encodeURIComponent(x.sku)}`)}><PackagePlus className="h-4 w-4"/></Button><Button variant="ghost" title="Stock history" onClick={()=>setSelected(x)}><History className="h-4 w-4"/></Button></div></td></tr>)}{!filtered.length&&<tr><td colSpan={8} className="py-10 text-center text-sm text-slate-500">No inventory records match your search.</td></tr>}</tbody></table></div>
 </div>
 {selected&&<Card className="mt-5 overflow-hidden p-0"><div className="workspace-panel-head"><div><div className="flex items-center gap-2"><History className="h-4 w-4"/><h3>Stock movement history · {selected.name}</h3></div><p>Every purchase adds stock and every sale subtracts stock.</p></div><button className="text-xs font-semibold text-slate-600 hover:text-slate-900" onClick={()=>setSelected(null)}>Close history</button></div><div className="table-wrap !max-h-[360px] !rounded-none !border-0"><table><thead><tr><th>Date</th><th>Movement</th><th>Quantity</th><th>Original amount</th><th>GHS value</th><th>Notes</th></tr></thead><tbody>{(movements.data||[]).map(m=><tr key={`${m.movement_type}-${m.movement_id}`}><td>{formatDate(m.movement_date)}</td><td><Badge className={m.movement_type==='purchase'?'bg-blue-100 text-blue-800':'bg-violet-100 text-violet-800'}>{m.movement_type==='purchase'?'STOCK IN':'SALE OUT'}</Badge></td><td className={m.quantity>=0?'text-emerald-700':'text-red-700'}>{m.quantity>0?`+${m.quantity}`:m.quantity}</td><td>{money(m.total_amount,m.currency)}</td><td>{money(m.total_amount_ghs,'GHS')}</td><td>{m.notes||'—'}</td></tr>)}{!movements.data?.length&&<tr><td colSpan={6} className="py-8 text-center text-sm text-slate-500">No movements recorded for this product.</td></tr>}</tbody></table></div></Card>}
 </>
}
