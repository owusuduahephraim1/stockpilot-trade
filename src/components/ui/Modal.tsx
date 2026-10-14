import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

type ModalSize='md'|'lg'|'xl'|'2xl'

export function Modal({open,onClose,title,description,children,footer,size='xl'}:{
  open:boolean
  onClose:()=>void
  title:string
  description?:string
  children:ReactNode
  footer?:ReactNode
  size?:ModalSize
}){
  const closeRef=useRef(onClose)
  useEffect(()=>{closeRef.current=onClose},[onClose])
  useEffect(()=>{
    if(!open)return
    const previous=document.body.style.overflow
    document.body.style.overflow='hidden'
    const onKey=(event:KeyboardEvent)=>{if(event.key==='Escape')closeRef.current()}
    window.addEventListener('keydown',onKey)
    return()=>{document.body.style.overflow=previous;window.removeEventListener('keydown',onKey)}
  },[open])
  if(!open)return null
  const sizes={md:'max-w-xl',lg:'max-w-2xl',xl:'max-w-3xl','2xl':'max-w-5xl'}
  const referenceCopy:Record<string,{title:string;description:string}>={
    'Add product':{title:'Add a product',description:'Create the catalogue record, barcode identity and stock rules.'},
    'New purchase':{title:'Record a purchase',description:'Add incoming stock from a manufacturer or supplier.'},
    'New sale':{title:'Record a sale',description:'Stock is checked before the transaction is accepted.'},
  }
  const copy=referenceCopy[title]
  const shownTitle=copy?.title||title
  const shownDescription=copy?.description||description
  return <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-5 lg:p-6" role="dialog" aria-modal="true" aria-label={shownTitle}>
    <button aria-label="Close dialog" className="absolute inset-0 cursor-default bg-slate-950/55" onClick={onClose}/>
    <section className={cn('task-modal relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-[20px] border border-slate-200 bg-[#f8fafc] shadow-[0_18px_52px_rgba(15,23,42,.24)]',sizes[size])}>
      <header className="flex shrink-0 items-start justify-between gap-4 px-5 pb-2 pt-5 sm:px-6 sm:pt-6">
        <div><h2 className="text-[22px] font-bold tracking-tight text-slate-900">{shownTitle}</h2>{shownDescription&&<p className="mt-1 text-sm leading-6 text-slate-500">{shownDescription}</p>}</div>
        <button onClick={onClose} className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-200/70 hover:text-slate-950" aria-label="Close"><X className="h-4 w-4"/></button>
      </header>
      <div className="modal-scroll min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6 sm:py-5">{children}</div>
      {footer&&<footer className="shrink-0 bg-[#f8fafc] px-5 pb-5 pt-2 sm:px-6 sm:pb-6"><div className="flex flex-wrap justify-end gap-2">{footer}</div></footer>}
    </section>
  </div>
}
