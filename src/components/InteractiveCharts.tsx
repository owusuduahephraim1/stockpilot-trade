import { useMemo, useState } from 'react'
import { money } from '@/lib/utils'

type PulsePoint={label:string;revenue:number;profit:number}
type MixPoint={name:string;value:number;share:number;color:string}

const shortMoney=(value:number)=>value>=1000000?`${(value/1000000).toFixed(1)}m`:value>=1000?`${Math.round(value/1000)}k`:String(Math.round(value))

export function SalesPulseChart({data}:{data:PulsePoint[]}){
 const [hovered,setHovered]=useState<number|null>(null)
 const max=Math.max(1,...data.flatMap(x=>[x.revenue,x.profit]))
 const point=(value:number,i:number)=>({x:16+i*(568/Math.max(1,data.length-1)),y:150-(value/max)*118})
 const revenuePoints=data.map((x,i)=>{const p=point(x.revenue,i);return `${p.x},${p.y}`}).join(' ')
 const profitPoints=data.map((x,i)=>{const p=point(x.profit,i);return `${p.x},${p.y}`}).join(' ')
 const active=hovered==null?null:data[hovered]
 const left=hovered==null?50:Math.max(10,Math.min(90,(hovered/Math.max(1,data.length-1))*100))
 return <div className="relative">
  {active&&<div className="pointer-events-none absolute top-1 z-20 min-w-40 -translate-x-1/2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-xl" style={{left:`${left}%`}}><div className="font-bold text-slate-900">{active.label}</div><div className="mt-1 text-amber-700">profit · {money(active.profit,'GHS')}</div><div className="text-emerald-700">sales · {money(active.revenue,'GHS')}</div></div>}
  <svg viewBox="0 0 600 176" className="h-56 w-full overflow-visible" role="img" aria-label="Seven day revenue and gross profit trend" onMouseLeave={()=>setHovered(null)}>
   <line x1="16" y1="150" x2="584" y2="150" stroke="#e2e8f0"/><line x1="16" y1="90" x2="584" y2="90" stroke="#eef2f7" strokeDasharray="4 4"/><line x1="16" y1="32" x2="584" y2="32" stroke="#eef2f7" strokeDasharray="4 4"/>
   <polyline points={revenuePoints} fill="none" stroke="#167a68" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/><polyline points={profitPoints} fill="none" stroke="#e3a22b" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
   {data.map((x,i)=>{const rp=point(x.revenue,i),pp=point(x.profit,i);const zone=568/Math.max(1,data.length-1);return <g key={`${x.label}-${i}`}><rect x={i===0?0:rp.x-zone/2} y="0" width={i===0||i===data.length-1?zone/2:zone} height="160" fill="transparent" className="cursor-crosshair" onMouseEnter={()=>setHovered(i)}/><circle cx={rp.x} cy={rp.y} r={hovered===i?4:2.4} fill="#167a68" stroke="white" strokeWidth="1.5"/><circle cx={pp.x} cy={pp.y} r={hovered===i?3.5:2.2} fill="#e3a22b" stroke="white" strokeWidth="1.5"/><text x={rp.x} y="170" textAnchor={i===0?'start':i===data.length-1?'end':'middle'} fontSize="10" fill="#64748b">{x.label}</text></g>})}
   <text x="16" y="26" fontSize="9" fill="#94a3b8">{shortMoney(max)}</text><text x="16" y="87" fontSize="9" fill="#94a3b8">{shortMoney(max/2)}</text>
  </svg>
  <div className="mt-1 flex items-center gap-5 text-xs text-slate-500"><span className="flex items-center gap-2"><span className="h-2 w-5 rounded-full bg-[#167a68]"/>Revenue</span><span className="flex items-center gap-2"><span className="h-2 w-5 rounded-full bg-[#e3a22b]"/>Gross profit</span></div>
 </div>
}

export function RevenueProfitBars({data}:{data:PulsePoint[]}){
 const [hovered,setHovered]=useState<number|null>(null)
 const max=Math.max(1,...data.flatMap(x=>[x.revenue,x.profit]))
 return <div className="relative flex h-72 items-end gap-3 px-5 pb-5 pt-8" onMouseLeave={()=>setHovered(null)}>
  {data.map((x,i)=><div key={x.label} className="relative flex h-full flex-1 flex-col items-center justify-end" onMouseEnter={()=>setHovered(i)}>
   {hovered===i&&<div className="pointer-events-none absolute left-1/2 top-1 z-20 min-w-40 -translate-x-1/2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-xl"><div className="font-bold text-slate-900">{x.label}</div><div className="mt-1 text-amber-700">profit · {money(x.profit,'GHS')}</div><div className="text-emerald-700">sales · {money(x.revenue,'GHS')}</div></div>}
   <div className="flex h-full w-full items-end justify-center gap-1.5"><div className="w-[42%] max-w-12 rounded-t bg-[#167a68] transition hover:brightness-95" style={{height:`${Math.max(3,(x.revenue/max)*100)}%`}}/><div className="w-[32%] max-w-9 rounded-t bg-[#e3a22b] transition hover:brightness-95" style={{height:`${Math.max(3,(x.profit/max)*100)}%`}}/></div><div className="mt-2 text-[11px] text-slate-500">{x.label}</div>
  </div>)}
 </div>
}

export function InventoryMixChart({data}:{data:MixPoint[]}){
 const [hovered,setHovered]=useState<number|null>(null)
 const segments=useMemo(()=>{let offset=0;return data.map((x,i)=>{const start=offset;offset+=x.share;return {...x,start,index:i}})},[data])
 const active=hovered==null?null:segments[hovered]
 return <div className="relative flex min-h-64 items-center gap-6 p-5">
  <div className="relative h-40 w-40 shrink-0">
   <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" onMouseLeave={()=>setHovered(null)}>{segments.length?segments.map(x=><circle key={x.name} cx="50" cy="50" r="34" fill="none" stroke={x.color} strokeWidth={hovered===x.index?17:15} pathLength="100" strokeDasharray={`${Math.max(.2,x.share)} ${Math.max(0,100-x.share)}`} strokeDashoffset={-x.start} className="cursor-pointer transition-all" onMouseEnter={()=>setHovered(x.index)}/>):<circle cx="50" cy="50" r="34" fill="none" stroke="#e2e8f0" strokeWidth="15"/>}</svg>
   <div className="pointer-events-none absolute inset-[31%] grid place-items-center rounded-full bg-white text-center"><span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Stock</span></div>
   {active&&<div className="pointer-events-none absolute left-1/2 top-1/2 z-20 min-w-36 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-xs shadow-xl"><div className="font-bold text-slate-900">{active.name}</div><div className="mt-1 text-slate-600">{active.share.toFixed(0)}%</div><div className="font-semibold text-emerald-700">{money(active.value,'GHS')}</div></div>}
  </div>
  <div className="min-w-0 flex-1 space-y-3">{segments.map(x=><button type="button" key={x.name} className="flex w-full items-center gap-2 text-left text-xs" onMouseEnter={()=>setHovered(x.index)} onMouseLeave={()=>setHovered(null)}><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{background:x.color}}/><span className="min-w-0 flex-1 truncate text-slate-600">{x.name}</span><span className="font-bold text-slate-800">{x.share.toFixed(0)}%</span></button>)}{!segments.length&&<p className="text-sm text-slate-500">No inventory yet.</p>}</div>
 </div>
}
