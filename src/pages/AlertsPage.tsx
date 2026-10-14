import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Barcode, CheckCheck, CircleAlert, CircleCheck, Clock3, RotateCcw } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useOperationalAlerts, type OperationalAlert } from '@/hooks/useOperationalAlerts'

export function AlertsPage(){
 const {alerts,activeAlerts,clearedCount,unreadCount,markAllRead,clearAll,resetCleared,isLoading,isError}=useOperationalAlerts()
 const marking=useRef(false)
 const [action,setAction]=useState<'clear'|'reset'|null>(null)
 const [message,setMessage]=useState('')
 useEffect(()=>{
   if(!unreadCount||marking.current)return
   marking.current=true
   void markAllRead().catch(()=>undefined).finally(()=>{marking.current=false})
 },[markAllRead,unreadCount])
 const counts={critical:alerts.filter(x=>x.severity==='critical').length,warning:alerts.filter(x=>x.severity==='warning').length,info:alerts.filter(x=>x.severity==='info').length}
 const iconFor=(x:OperationalAlert)=>x.icon==='barcode'?<Barcode className="h-4 w-4"/>:x.icon==='fx'?<Clock3 className="h-4 w-4"/>:<AlertTriangle className="h-4 w-4"/>
 const runClear=async()=>{setAction('clear');setMessage('');try{await clearAll();setMessage('Current alerts cleared from your view. They will return automatically if a condition changes.')}catch(e){setMessage((e as Error).message)}finally{setAction(null)}}
 const runReset=async()=>{setAction('reset');setMessage('');try{await resetCleared();setMessage('Cleared alerts restored to the active list.')}catch(e){setMessage((e as Error).message)}finally{setAction(null)}}
 return <><PageHeader title="Operational alerts" description="Current stock, barcode and exchange-rate conditions. Opening this page marks the current notifications as read."/>
  <div className="mb-5 grid gap-3 sm:grid-cols-3"><Card className="py-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Critical</p><p className="mt-1 text-2xl font-bold text-red-700">{counts.critical}</p></Card><Card className="py-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Warnings</p><p className="mt-1 text-2xl font-bold text-amber-700">{counts.warning}</p></Card><Card className="py-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Information</p><p className="mt-1 text-2xl font-bold text-slate-700">{counts.info}</p></Card></div>

  <div className="workspace-register">
   <div className="workspace-register-toolbar"><div><div className="workspace-register-title">Alert register</div><div className="workspace-register-subtitle">{alerts.length} visible · {clearedCount} cleared · {activeAlerts.length} active conditions</div></div><div className="flex flex-wrap items-center gap-2"><Button variant="secondary" onClick={runReset} disabled={!clearedCount||action!==null}><RotateCcw className="h-4 w-4"/>{action==='reset'?'Restoring...':'Reset cleared'}</Button><Button variant="secondary" onClick={runClear} disabled={!alerts.length||action!==null}><CheckCheck className="h-4 w-4"/>{action==='clear'?'Clearing...':'Clear all'}</Button></div></div>
   {message&&<div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-medium text-slate-600">{message}</div>}
   {isLoading?<div className="p-5 text-sm text-slate-500">Loading operational alerts...</div>:isError?<div className="p-5 text-sm text-red-700">Operational alerts could not be loaded. Refresh the page and try again.</div>:!alerts.length?<div className="p-5"><div className="flex items-center gap-3 text-emerald-700"><CircleCheck className="h-5 w-5"/><div><div className="font-bold">{clearedCount?'Current alerts cleared':'No operational alerts'}</div><div className="text-sm text-slate-500">{clearedCount?'The underlying conditions are still monitored. Use Reset cleared to show them again.':'Stock levels, barcodes and configured exchange rates currently pass the active checks.'}</div></div></div></div>:<div className="alert-compact-list workspace-scrollbar overflow-y-auto">{alerts.map(x=><div key={x.alert_key} className={`flex gap-3 border-b border-slate-100 px-4 py-3 last:border-0 ${x.severity==='critical'?'bg-red-50/70':x.severity==='warning'?'bg-amber-50/70':'bg-white'}`}><div className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full ${x.severity==='critical'?'bg-red-100 text-red-700':x.severity==='warning'?'bg-amber-100 text-amber-700':'bg-slate-100 text-slate-500'}`}>{iconFor(x)}</div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-bold text-slate-900">{x.title}</h3><Badge className={x.severity==='critical'?'bg-red-100 text-red-700':x.severity==='warning'?'bg-amber-100 text-amber-800':'bg-slate-100 text-slate-700'}>{x.severity.toUpperCase()}</Badge></div><p className="mt-1 text-xs leading-5 text-slate-600">{x.detail}</p></div><CircleAlert className="mt-1 h-4 w-4 shrink-0 text-slate-300"/></div>)}</div>}
  </div>
 </>
}
