import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Bell, Boxes, ChartNoAxesCombined, ClipboardList, ContactRound, FileChartColumn, LogOut, Menu, PackagePlus, Search, Settings, ShoppingCart, Truck, Users, Warehouse } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useOperationalAlerts } from '@/hooks/useOperationalAlerts'
import { cn } from '@/lib/utils'
import { Button } from './ui/Button'

const overview=[['Dashboard','/',ChartNoAxesCombined]] as const
const operations=[['Products','/products',Boxes],['Purchases','/purchases',PackagePlus],['Sales & POS','/sales',ShoppingCart],['Inventory','/inventory',Warehouse]] as const
const relationships=[['Customers','/customers',ContactRound],['Suppliers','/suppliers',Truck]] as const
const intelligence=[['Reports','/reports',FileChartColumn]] as const

function WorkspaceTopbar({unreadCount}:{unreadCount:number}){
 const navigate=useNavigate();const [search,setSearch]=useState('')
 const submitSearch=(event:FormEvent)=>{event.preventDefault();const value=search.trim();if(!value)return;if(/^SAL-/i.test(value))navigate(`/sales?search=${encodeURIComponent(value)}`);else if(/^PUR-/i.test(value))navigate(`/purchases?search=${encodeURIComponent(value)}`);else navigate(`/products?search=${encodeURIComponent(value)}`)}
 return <header className="workspace-topbar sticky top-0 z-30 border-b border-slate-200/90">
  <div className="workspace-topbar-inner flex h-16 items-center gap-3 px-4 pl-16 sm:px-5 sm:pl-16 xl:px-6 xl:pl-6 2xl:px-7">
   <form onSubmit={submitSearch} className="relative w-full max-w-xl"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/><input value={search} onChange={e=>setSearch(e.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/90 pl-9 pr-3 text-sm outline-none transition-colors focus:border-emerald-300 focus:bg-white focus:ring-2 focus:ring-emerald-100" placeholder="Search product, SKU, barcode or transaction..."/></form>
   <div className="ml-auto hidden shrink-0 items-center gap-2 md:flex"><span className="hidden items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-700 lg:inline-flex"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500"/>Live sync</span><button onClick={()=>navigate('/alerts')} className="relative rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 transition-colors hover:bg-slate-50" aria-label={unreadCount?`${unreadCount} unread operational notifications`:'Operational notifications'} title={unreadCount?`${unreadCount} unread notification${unreadCount===1?'':'s'}`:'No unread notifications'}><Bell className="h-4 w-4"/>{unreadCount>0&&<span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">{unreadCount}</span>}</button><Button onClick={()=>navigate('/sales?new=1')} className="bg-emerald-700 hover:bg-emerald-800"><ShoppingCart className="h-4 w-4"/><span className="hidden lg:inline">New sale</span></Button></div>
  </div>
 </header>
}

export function AppShell(){
 const {profile,signOut}=useAuth();const navigate=useNavigate();const [open,setOpen]=useState(false);const {unreadCount,stockAlertCount}=useOperationalAlerts()
 const doSignOut=async()=>{await signOut();navigate('/login')}
 const navClass=({isActive}:{isActive:boolean})=>cn('flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors',isActive?'bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-400/15':'text-slate-300 hover:bg-slate-800/80 hover:text-white')
 const section=(label:string,items:readonly (readonly [string,string,any])[])=><div className="mb-4"><div className="mb-1.5 px-3 text-[9px] font-bold uppercase tracking-[.16em] text-slate-500">{label}</div><div className="space-y-1">{items.map(([name,to,Icon])=><NavLink key={to} to={to} onClick={()=>setOpen(false)} className={navClass}><Icon className="h-4 w-4 shrink-0"/><span className="min-w-0 flex-1">{name}</span>{to==='/inventory'&&stockAlertCount>0&&<span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full border border-amber-400/30 bg-amber-400/15 px-1.5 text-[10px] font-bold text-amber-300" title={`${stockAlertCount} product${stockAlertCount===1?'':'s'} currently low or out of stock`} aria-label={`${stockAlertCount} low or out-of-stock product${stockAlertCount===1?'':'s'}`}>{stockAlertCount>99?'99+':stockAlertCount}</span>}</NavLink>)}</div></div>

 return <div className="workspace-shell min-h-[100dvh] bg-[#f4f7fb] text-slate-900">
  <button onClick={()=>setOpen(true)} className="fixed left-3 top-3 z-[90] rounded-lg bg-slate-950 p-2 text-white shadow-lg xl:hidden"><Menu className="h-5 w-5"/></button>
  <aside className={cn('fixed inset-y-0 left-0 z-50 w-56 border-r border-slate-800 bg-[#102033] text-white transition-transform xl:translate-x-0',open?'translate-x-0':'-translate-x-full')}>
   <div className="flex h-full min-h-0 flex-col">
    <div className="shrink-0 border-b border-slate-700/70 px-4 py-4"><div className="flex items-center gap-2.5"><img src={`${import.meta.env.BASE_URL}stockpilot-mark.svg`} alt="StockPilot logo" className="h-9 w-9 shrink-0 rounded-xl shadow-sm"/><div className="min-w-0"><div className="truncate text-sm font-bold">StockPilot</div><div className="text-[9px] font-semibold uppercase tracking-[.18em] text-slate-400">Control centre</div></div></div></div>
    <nav className="workspace-scrollbar min-h-0 flex-1 overflow-y-auto px-3 py-4">
      {section('Overview',overview)}
      {section('Operations',operations)}
      {section('Relationships',relationships)}
      <div className="mb-4"><div className="mb-1.5 px-3 text-[9px] font-bold uppercase tracking-[.16em] text-slate-500">Intelligence</div><div className="space-y-1">{intelligence.map(([name,to,Icon])=><NavLink key={to} to={to} onClick={()=>setOpen(false)} className={navClass}><Icon className="h-4 w-4 shrink-0"/><span>{name}</span></NavLink>)}{profile?.role==='admin'&&<NavLink to="/activity" onClick={()=>setOpen(false)} className={navClass}><ClipboardList className="h-4 w-4"/>Activity log</NavLink>}</div></div>
      {profile?.role==='admin'&&<div className="mb-4"><div className="mb-1.5 px-3 text-[9px] font-bold uppercase tracking-[.16em] text-slate-500">Administration</div><div className="space-y-1"><NavLink to="/users" onClick={()=>setOpen(false)} className={navClass}><Users className="h-4 w-4"/>User management</NavLink><NavLink to="/settings" onClick={()=>setOpen(false)} className={navClass}><Settings className="h-4 w-4"/>Settings</NavLink></div></div>}
    </nav>
    <div className="shrink-0 border-t border-slate-700/70 p-3"><div className="rounded-xl bg-slate-800/70 p-3"><div className="flex items-center gap-2"><div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-400 text-[10px] font-bold text-slate-950">{(profile?.full_name||profile?.email||'SP').split(/\s+/).map(x=>x[0]).join('').slice(0,2).toUpperCase()}</div><div className="min-w-0"><div className="truncate text-xs font-semibold">{profile?.full_name||profile?.email}</div><div className="mt-0.5 text-[10px] capitalize text-slate-400">{profile?.role==='admin'?'Owner / Admin':'Staff / Operator'}</div></div></div><Button onClick={doSignOut} variant="ghost" className="mt-2 w-full justify-start px-2 py-1.5 text-xs text-slate-300 hover:bg-slate-700 hover:text-white"><LogOut className="h-3.5 w-3.5"/>Sign out</Button></div><div className="mt-2 px-1 text-[9px] text-slate-600">StockPilot v1.10.3</div></div>
   </div>
  </aside>
  {open&&<button aria-label="Close navigation" className="fixed inset-0 z-40 bg-slate-950/45 xl:hidden" onClick={()=>setOpen(false)}/>} 

  <div className="workspace-main min-h-[100dvh] xl:pl-56">
   <WorkspaceTopbar unreadCount={unreadCount}/>
   <main><div className="workspace-content mx-auto w-full max-w-[1760px]"><Outlet/></div></main>
  </div>
 </div>
}
