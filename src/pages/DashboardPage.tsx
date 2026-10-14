import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { ArrowDownLeft, ArrowUpRight, Banknote, Boxes, ChartNoAxesCombined, PackagePlus, ShoppingCart } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/PageHeader'
import { SalesPulseChart, InventoryMixChart } from '@/components/InteractiveCharts'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import { money, formatDate } from '@/lib/utils'
import type { InventoryRow } from '@/types/database'

const COLORS=['#167a68','#4675c7','#e3a22b','#94a3b8','#8b5cf6','#0ea5e9']

function greetingFor(date: Date){
 const hour=date.getHours()
 return hour<12?'Good morning':hour<18?'Good afternoon':'Good evening'
}

export function DashboardPage(){
 const navigate=useNavigate();const {profile}=useAuth()
 const [localNow,setLocalNow]=useState(()=>new Date())
 useEffect(()=>{
  let minuteTimer:number|undefined
  let alignmentTimer:number|undefined
  const syncClock=()=>setLocalNow(new Date())
  const startMinuteSync=()=>{
   syncClock()
   const delay=60_000-(Date.now()%60_000)+50
   alignmentTimer=window.setTimeout(()=>{
    syncClock()
    minuteTimer=window.setInterval(syncClock,60_000)
   },delay)
  }
  const syncWhenVisible=()=>{if(document.visibilityState==='visible')syncClock()}
  startMinuteSync()
  window.addEventListener('focus',syncClock)
  window.addEventListener('pageshow',syncClock)
  document.addEventListener('visibilitychange',syncWhenVisible)
  return()=>{
   if(alignmentTimer!==undefined)window.clearTimeout(alignmentTimer)
   if(minuteTimer!==undefined)window.clearInterval(minuteTimer)
   window.removeEventListener('focus',syncClock)
   window.removeEventListener('pageshow',syncClock)
   document.removeEventListener('visibilitychange',syncWhenVisible)
  }
 },[])
 const inv=useQuery({queryKey:['inventory'],queryFn:async()=>{const {data,error}=await supabase.from('product_inventory').select('*').order('name');if(error)throw error;return data as InventoryRow[]}})
 const recentSales=useQuery({queryKey:['sales','recent'],queryFn:async()=>{const {data,error}=await supabase.from('sales').select('id,sale_number,quantity,total_amount,total_amount_ghs,currency,sale_date,customer_name,customers(name),products(name,sku)').order('created_at',{ascending:false}).limit(6);if(error)throw error;return data as any[]}})
 const recentPurchases=useQuery({queryKey:['purchases','recent'],queryFn:async()=>{const {data,error}=await supabase.from('purchases').select('id,purchase_number,quantity,total_cost,total_cost_ghs,currency,purchase_date,manufacturer,suppliers(name),products(name,sku)').order('created_at',{ascending:false}).limit(6);if(error)throw error;return data as any[]}})
 const allSales=useQuery({queryKey:['sales','summary'],queryFn:async()=>{const {data,error}=await supabase.from('sales').select('total_amount_ghs,profit_ghs,sale_date,product_id,products(name)');if(error)throw error;return data as any[]}})
 const rows=inv.data||[]
 const metrics={units:rows.reduce((a,b)=>a+b.quantity_on_hand,0),investment:rows.reduce((a,b)=>a+Number(b.total_invested),0),revenue:(allSales.data||[]).reduce((a,b)=>a+Number(b.total_amount_ghs||0),0),profit:(allSales.data||[]).reduce((a,b)=>a+Number(b.profit_ghs||0),0),low:rows.filter(r=>r.is_low_stock).length}
 const margin=metrics.revenue>0?(metrics.profit/metrics.revenue)*100:0
 const greeting=greetingFor(localNow);const firstName=(profile?.full_name||profile?.email||'there').split(/[\s@]/)[0]

 const last7=useMemo(()=>{const days=Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-(6-i));return d.toISOString().slice(0,10)});const revenue=new Map(days.map(d=>[d,0]));const profit=new Map(days.map(d=>[d,0]));for(const s of allSales.data||[]){if(revenue.has(s.sale_date)){revenue.set(s.sale_date,(revenue.get(s.sale_date)||0)+Number(s.total_amount_ghs||0));profit.set(s.sale_date,(profit.get(s.sale_date)||0)+Number(s.profit_ghs||0))}}return days.map(d=>({label:new Intl.DateTimeFormat('en-GB',{weekday:'short'}).format(new Date(`${d}T00:00:00`)),date:d,revenue:revenue.get(d)||0,profit:profit.get(d)||0}))},[allSales.data])

 const mix=useMemo(()=>{const map=new Map<string,number>();for(const x of rows){const key=x.category||'Other';map.set(key,(map.get(key)||0)+Number(x.total_invested||0))}const total=[...map.values()].reduce((a,b)=>a+b,0)||1;return [...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,5).map(([name,value],i)=>({name,value,share:(value/total)*100,color:COLORS[i%COLORS.length]}))},[rows])

 const activity=useMemo(()=>[
  ...(recentSales.data||[]).map(x=>({id:`s-${x.id}`,type:'sale' as const,date:x.sale_date,name:x.products?.name||'Product',ref:x.sale_number||'Sale',party:x.customers?.name||x.customer_name||'Walk-in customer',amount:Number(x.total_amount_ghs||0),original:money(x.total_amount,x.currency)})),
  ...(recentPurchases.data||[]).map(x=>({id:`p-${x.id}`,type:'purchase' as const,date:x.purchase_date,name:x.products?.name||'Product',ref:x.purchase_number||'Purchase',party:x.suppliers?.name||x.manufacturer||'Supplier',amount:Number(x.total_cost_ghs||0),original:money(x.total_cost,x.currency)})),
 ].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,6),[recentSales.data,recentPurchases.data])

 return <>
  <PageHeader title={`${greeting}, ${firstName}`} description="Here is the live position of your business today." eyebrow="Operations workspace" />
  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
   <Card className="metric-card"><div className="flex items-start justify-between"><div><div className="metric-label">Units in stock</div><div className="metric-value">{metrics.units}</div></div><div className="metric-icon bg-blue-50 text-blue-700"><Boxes className="h-4 w-4"/></div></div></Card>
   <Card className="metric-card"><div className="flex items-start justify-between"><div><div className="metric-label">Stock investment</div><div className="metric-value">{money(metrics.investment,'GHS')}</div><div className="metric-note">Cost value in GHS</div></div><div className="metric-icon bg-emerald-50 text-emerald-700"><Banknote className="h-4 w-4"/></div></div></Card>
   <Card className="metric-card"><div className="flex items-start justify-between"><div><div className="metric-label">Sales revenue</div><div className="metric-value">{money(metrics.revenue,'GHS')}</div></div><div className="metric-icon bg-amber-50 text-amber-700"><ShoppingCart className="h-4 w-4"/></div></div></Card>
   <Card className="metric-card"><div className="flex items-start justify-between"><div><div className="metric-label">Gross profit</div><div className="metric-value">{money(metrics.profit,'GHS')}</div><div className="metric-note">{margin.toFixed(1)}% realized margin</div></div><div className="metric-icon bg-rose-50 text-rose-700"><ChartNoAxesCombined className="h-4 w-4"/></div></div></Card>
  </div>

  <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.75fr)_minmax(320px,.85fr)]">
   <Card className="overflow-hidden p-0"><div className="workspace-panel-head"><div><h3>Sales pulse</h3><p>Revenue and gross profit · last 7 days</p></div><button onClick={()=>navigate('/reports')} className="text-xs font-semibold text-slate-600 hover:text-emerald-700">Full report ↗</button></div><div className="p-4"><SalesPulseChart data={last7}/></div></Card>
   <Card className="overflow-hidden p-0"><div className="workspace-panel-head"><div><h3>Inventory mix</h3><p>Current value by category</p></div></div><InventoryMixChart data={mix}/></Card>
  </div>

  <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,.75fr)]">
   <Card className="overflow-hidden p-0"><div className="workspace-panel-head"><div><h3>Recent activity</h3><p>Purchases and sales across the workspace</p></div><button onClick={()=>navigate(profile?.role==='admin'?'/activity':'/sales')} className="text-xs font-semibold text-slate-600 hover:text-emerald-700">View all</button></div><div className="divide-y divide-slate-100">{activity.map(x=><div key={x.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3"><div className={`grid h-8 w-8 place-items-center rounded-full ${x.type==='sale'?'bg-emerald-50 text-emerald-700':'bg-blue-50 text-blue-700'}`}>{x.type==='sale'?<ArrowUpRight className="h-4 w-4"/>:<ArrowDownLeft className="h-4 w-4"/>}</div><div className="min-w-0"><div className="truncate text-sm font-semibold">{x.name}</div><div className="truncate text-[11px] text-slate-500">{x.ref} · {x.party}</div></div><div className="text-right"><div className={`text-xs font-bold ${x.type==='sale'?'text-emerald-700':'text-slate-800'}`}>{x.type==='sale'?'+':''}{x.original}</div><div className="mt-0.5 text-[10px] text-slate-400">{formatDate(x.date)}</div></div></div>)}{!activity.length&&<div className="px-4 py-10 text-center text-sm text-slate-500">No operational activity yet.</div>}</div></Card>
   <div className="space-y-5"><Card className="overflow-hidden border-slate-800 bg-[#102033] p-0 text-white"><div className="p-5"><div className="mb-4 flex items-center justify-between"><div className="grid h-9 w-9 place-items-center rounded-full bg-emerald-400 text-slate-950"><ChartNoAxesCombined className="h-4 w-4"/></div><span className="rounded-full border border-slate-600 px-2 py-1 text-[10px] font-semibold">Quick actions</span></div><h3 className="text-lg font-bold">Keep stock moving</h3><p className="mt-1 text-xs text-slate-300">Record activity as it happens to keep the owner view accurate.</p><div className="mt-5 grid grid-cols-2 gap-2"><Button onClick={()=>navigate('/sales?new=1')} className="justify-center bg-emerald-400 text-slate-950 hover:bg-emerald-300"><ShoppingCart className="h-4 w-4"/>Sale</Button><Button onClick={()=>navigate('/purchases?new=1')} variant="secondary" className="justify-center border-slate-500 bg-transparent text-white hover:bg-slate-800"><PackagePlus className="h-4 w-4"/>Purchase</Button></div></div></Card><Card className="overflow-hidden p-0"><div className="workspace-panel-head"><div><h3>Stock alerts</h3><p>{metrics.low} product{metrics.low===1?'':'s'} require attention</p></div>{metrics.low>0&&<span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">{metrics.low}</span>}</div><div className="divide-y divide-slate-100">{rows.filter(x=>x.is_low_stock).slice(0,5).map(x=><button key={x.product_id} onClick={()=>navigate(`/products?search=${encodeURIComponent(x.sku)}`)} className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-slate-50"><div className="min-w-0"><div className="truncate text-xs font-semibold">{x.name}</div><div className="mt-0.5 text-[10px] text-slate-400">Threshold {x.low_stock_threshold}</div></div><span className="shrink-0 text-xs font-bold text-amber-700">{x.quantity_on_hand} left</span></button>)}{metrics.low===0&&<div className="px-4 py-6 text-center text-xs text-slate-500">All products are above their reorder thresholds.</div>}</div></Card></div>
  </div>
 </>
}
