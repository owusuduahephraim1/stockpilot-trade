import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { BellRing, Building2, CheckCircle2, CircleDollarSign, FileCheck2, Radio, RefreshCw, ScanBarcode, ShieldCheck } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { CameraBarcodeButton } from '@/components/BarcodeScanner'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'
import { supabase } from '@/lib/supabase'
import { formatDateTime } from '@/lib/utils'
import type { AppSettings, ExchangeRate } from '@/types/database'

type FxSyncResult={
  updated:boolean
  changed:string[]
  source:string
  sourceDate:string|null
  rates:Record<string,{mid:number;buying:number;selling:number;sourceDate:string}>
}

export function SettingsPage() {
  const { profile, user } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [gbp, setGbp] = useState('')
  const [usd, setUsd] = useState('')
  const [rateMessage, setRateMessage] = useState('')
  const [fxInfo,setFxInfo]=useState<FxSyncResult|null>(null)
  const [businessMessage, setBusinessMessage] = useState('')
  const [business, setBusiness] = useState({business_name:'StockPilot',business_phone:'',business_email:'',business_address:'',receipt_footer:'Thank you for your business.',default_label_copies:'1',alert_missing_barcodes:true,fx_stale_days:'14'})

  const rates = useQuery({queryKey: ['exchange-rates'],queryFn: async () => {const { data, error } = await supabase.from('exchange_rates').select('*').order('currency_code');if (error) throw error;return data as ExchangeRate[]}})
  const appSettings = useQuery({queryKey:['app-settings'],queryFn:async()=>{const {data,error}=await supabase.from('app_settings').select('*').eq('setting_key','primary').maybeSingle();if(error)throw error;return data as AppSettings|null}})

  useEffect(() => {const rows=rates.data||[];const g=rows.find(x=>x.currency_code==='GBP');const u=rows.find(x=>x.currency_code==='USD');if(g)setGbp(String(g.rate_to_ghs));if(u)setUsd(String(u.rate_to_ghs))}, [rates.data])
  useEffect(()=>{const x=appSettings.data;if(!x)return;setBusiness({business_name:x.business_name||'StockPilot',business_phone:x.business_phone||'',business_email:x.business_email||'',business_address:x.business_address||'',receipt_footer:x.receipt_footer||'',default_label_copies:String(x.default_label_copies||1),alert_missing_barcodes:x.alert_missing_barcodes!==false,fx_stale_days:String(x.fx_stale_days||14)})},[appSettings.data])

  const syncRates=useMutation({mutationFn:()=>api<FxSyncResult>('/api/fx-sync',{method:'POST'}),onSuccess:async result=>{setFxInfo(result);setRateMessage(result.updated?`BoG FX synchronized: ${result.changed.join(' & ')}.`:`BoG FX current · ${result.sourceDate||'latest publication'}.`);await qc.invalidateQueries({queryKey:['exchange-rates']});await qc.invalidateQueries({queryKey:['operational-alerts']})},onError:(e:any)=>setRateMessage(`FX sync failed: ${e.message}`)})
  const saveRates = useMutation({mutationFn: async () => {if (!user || profile?.role !== 'admin') throw new Error('Administrator access required');const rows=[{currency_code:'GBP',value:Number(gbp)},{currency_code:'USD',value:Number(usd)}] as const;for(const row of rows)if(!Number.isFinite(row.value)||row.value<=0)throw new Error(`Enter a valid ${row.currency_code} to GHS exchange rate`);const {error}=await supabase.from('exchange_rates').upsert(rows.map(x=>({currency_code:x.currency_code,rate_to_ghs:x.value,rate_source:'manual',updated_by:user.id,updated_at:new Date().toISOString()})),{onConflict:'currency_code'});if(error)throw error},onSuccess:()=>{setRateMessage('Manual FX rates saved.');qc.invalidateQueries({queryKey:['exchange-rates']})},onError:(e:any)=>setRateMessage(e.message)})
  const saveBusiness=useMutation({mutationFn:async()=>{if(!user||profile?.role!=='admin')throw new Error('Administrator access required');const copies=Number(business.default_label_copies),stale=Number(business.fx_stale_days);if(!business.business_name.trim())throw new Error('Business / shop name is required');if(!Number.isInteger(copies)||copies<1||copies>50)throw new Error('Default label copies must be between 1 and 50');if(!Number.isInteger(stale)||stale<1||stale>365)throw new Error('FX stale alert days must be between 1 and 365');const payload={setting_key:'primary',business_name:business.business_name.trim(),business_phone:business.business_phone.trim()||null,business_email:business.business_email.trim()||null,business_address:business.business_address.trim()||null,receipt_footer:business.receipt_footer.trim()||null,default_label_copies:copies,alert_missing_barcodes:business.alert_missing_barcodes,fx_stale_days:stale,updated_by:user.id,updated_at:new Date().toISOString()};const {error}=await supabase.from('app_settings').upsert(payload,{onConflict:'setting_key'});if(error)throw error},onSuccess:()=>{setBusinessMessage('Business profile saved.');qc.invalidateQueries({queryKey:['app-settings']})},onError:(e:any)=>setBusinessMessage(e.message)})

  if (profile?.role !== 'admin') return <><PageHeader title="Settings" description="Administrative configuration."/><Card><p className="text-sm text-slate-600">Admin/Owner access required.</p></Card></>

  const gbpRow=(rates.data||[]).find(x=>x.currency_code==='GBP'),usdRow=(rates.data||[]).find(x=>x.currency_code==='USD')
  const lastUpdated=[...(rates.data||[])].sort((a,b)=>b.updated_at.localeCompare(a.updated_at))[0]?.updated_at
  const sourceLabel=(row?:ExchangeRate)=>row?.rate_source==='bank_of_ghana'?'BoG auto':'Manual'
  const sourceDate=(row?:ExchangeRate)=>row?.source_date?new Date(`${row.source_date}T12:00:00`).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'}):'—'
  const controlRow=(icon:any,title:string,description:string,active:boolean,interactive?:boolean)=>{const Icon=icon;return <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-0"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-50 text-slate-500"><Icon className="h-4 w-4"/></div><div className="min-w-0 flex-1"><div className="text-sm font-semibold text-slate-800">{title}</div><div className="mt-0.5 text-[11px] text-slate-500">{description}</div></div>{interactive?<button type="button" onClick={()=>setBusiness({...business,alert_missing_barcodes:!business.alert_missing_barcodes})} className={`relative h-6 w-11 rounded-full transition-colors ${active?'bg-emerald-600':'bg-slate-300'}`} aria-pressed={active}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${active?'translate-x-6':'translate-x-1'}`}/></button>:<span className={`rounded-full px-2 py-1 text-[10px] font-bold ${active?'bg-emerald-50 text-emerald-700':'bg-slate-100 text-slate-500'}`}>{active?'Active':'Available'}</span>}</div>}

  return <>
    <PageHeader title="Business settings" description="Configure currencies, exchange rates and operational rules." actions={<CameraBarcodeButton label="Scan barcode" onScan={value=>navigate(`/products?search=${encodeURIComponent(value)}`)}/>} />
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,.95fr)]">
      <Card className="overflow-hidden p-0 xl:row-span-2">
        <div className="workspace-panel-head"><div><h3>Currency & exchange rates</h3><p>Bank of Ghana daily interbank mid-rates</p></div><div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={()=>saveRates.mutate()} disabled={saveRates.isPending}><CircleDollarSign className="h-4 w-4"/>{saveRates.isPending?'Saving...':'Save manual'}</Button><Button onClick={()=>syncRates.mutate()} disabled={syncRates.isPending} className="bg-emerald-700 hover:bg-emerald-800"><RefreshCw className={`h-4 w-4 ${syncRates.isPending?'animate-spin':''}`}/>{syncRates.isPending?'Syncing...':'Sync BoG now'}</Button></div></div>
        <div className="space-y-4 p-5">
          <div className="rounded-2xl border border-slate-200 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="font-semibold">British Pound</div><div className="text-xs text-slate-500">GBP → GHS · mid</div><div className="mt-1 text-[11px] text-slate-400">{sourceDate(gbpRow)}</div></div><div className="flex items-center gap-2 sm:w-72"><Input type="number" min="0.000001" step="0.000001" value={gbp} onChange={e=>setGbp(e.target.value)}/><span className={`whitespace-nowrap rounded-full border px-2 py-1 text-[10px] font-semibold ${gbpRow?.rate_source==='bank_of_ghana'?'border-emerald-200 bg-emerald-50 text-emerald-700':'border-slate-200 bg-slate-50 text-slate-600'}`}>{sourceLabel(gbpRow)}</span></div></div>{fxInfo?.rates?.GBP&&<div className="mt-3 text-[11px] text-slate-500">Buy {fxInfo.rates.GBP.buying.toFixed(4)} · Sell {fxInfo.rates.GBP.selling.toFixed(4)} · Mid {fxInfo.rates.GBP.mid.toFixed(4)}</div>}</div>
          <div className="rounded-2xl border border-slate-200 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="font-semibold">US Dollar</div><div className="text-xs text-slate-500">USD → GHS · mid</div><div className="mt-1 text-[11px] text-slate-400">{sourceDate(usdRow)}</div></div><div className="flex items-center gap-2 sm:w-72"><Input type="number" min="0.000001" step="0.000001" value={usd} onChange={e=>setUsd(e.target.value)}/><span className={`whitespace-nowrap rounded-full border px-2 py-1 text-[10px] font-semibold ${usdRow?.rate_source==='bank_of_ghana'?'border-emerald-200 bg-emerald-50 text-emerald-700':'border-slate-200 bg-slate-50 text-slate-600'}`}>{sourceLabel(usdRow)}</span></div></div>{fxInfo?.rates?.USD&&<div className="mt-3 text-[11px] text-slate-500">Buy {fxInfo.rates.USD.buying.toFixed(4)} · Sell {fxInfo.rates.USD.selling.toFixed(4)} · Mid {fxInfo.rates.USD.mid.toFixed(4)}</div>}</div>
          {rateMessage&&<p className="rounded-xl bg-slate-50 p-3 text-sm font-medium text-slate-700">{rateMessage}</p>}
          <div className="border-t border-slate-100 pt-4 text-xs text-slate-500"><strong>Last FX update:</strong> {formatDateTime(lastUpdated)}</div>
        </div>
      </Card>

      <Card className="overflow-hidden p-0"><div className="workspace-panel-head"><div><h3>Operational controls</h3><p>Safeguards and workspace behaviour</p></div></div><div>{controlRow(BellRing,'Low-stock notifications','Low-stock and out-of-stock monitoring.',true)}{controlRow(ScanBarcode,'Missing barcode alerts','Catalogue barcode monitoring.',business.alert_missing_barcodes,true)}{controlRow(Radio,'Realtime updates','Live operational refresh.',true)}{controlRow(FileCheck2,'Receipt attachments','Purchase and sales documents.',true)}</div><div className="border-t border-slate-100 p-4"><label>FX stale alert threshold (days)</label><Input type="number" min="1" max="365" value={business.fx_stale_days} onChange={e=>setBusiness({...business,fx_stale_days:e.target.value})}/></div></Card>

      <Card className="overflow-hidden p-0"><div className="workspace-panel-head"><div><h3>Business profile</h3><p>Printed document identity</p></div><Building2 className="h-4 w-4 text-slate-400"/></div><div className="grid gap-4 p-5 md:grid-cols-2"><div className="md:col-span-2"><label>Business name</label><Input value={business.business_name} onChange={e=>setBusiness({...business,business_name:e.target.value})}/></div><div><label>Phone</label><Input value={business.business_phone} onChange={e=>setBusiness({...business,business_phone:e.target.value})}/></div><div><label>Email</label><Input type="email" value={business.business_email} onChange={e=>setBusiness({...business,business_email:e.target.value})}/></div><div className="md:col-span-2"><label>Business address</label><Input value={business.business_address} onChange={e=>setBusiness({...business,business_address:e.target.value})}/></div><div><label>Base currency</label><Input value="GHS · Ghanaian Cedi" disabled/></div><div><label>Default barcode label copies</label><Input type="number" min="1" max="50" value={business.default_label_copies} onChange={e=>setBusiness({...business,default_label_copies:e.target.value})}/></div><div className="md:col-span-2"><label>Receipt footer</label><Input value={business.receipt_footer} onChange={e=>setBusiness({...business,receipt_footer:e.target.value})}/></div>{businessMessage&&<p className="md:col-span-2 text-sm font-medium text-slate-700">{businessMessage}</p>}<div className="md:col-span-2"><Button onClick={()=>saveBusiness.mutate()} disabled={saveBusiness.isPending}>{saveBusiness.isPending?'Saving...':'Save profile'}</Button></div></div></Card>
    </div>

    <Card className="mt-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="flex items-start gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700"><ShieldCheck className="h-5 w-5"/></div><div><h3 className="font-bold">Production workspace</h3><p className="mt-1 text-sm text-slate-500">StockPilot v1.10.3</p></div></div><div className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4"/>Live</div></div></Card>
  </>
}