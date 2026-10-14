import type { ReactNode } from 'react'

export function PageHeader({title,description,actions,eyebrow='Operations workspace'}:{title:string;description?:string;actions?:ReactNode;eyebrow?:string}){
 return <div className="workspace-page-header mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
   <div className="min-w-0">
    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.18em] text-emerald-700"><span className="h-px w-5 bg-emerald-500"/>{eyebrow}</div>
    <h1 className="mt-2 text-[1.65rem] font-bold leading-tight tracking-tight text-slate-950">{title}</h1>
    {description&&<p className="mt-1 max-w-3xl text-sm leading-5 text-slate-500">{description}</p>}
   </div>
   {actions&&<div className="flex shrink-0 flex-wrap items-center gap-2 sm:pt-8">{actions}</div>}
 </div>
}
