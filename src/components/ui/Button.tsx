import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export function Button({className,variant='primary',...props}:ButtonHTMLAttributes<HTMLButtonElement>&{variant?:'primary'|'secondary'|'danger'|'ghost'}){
  const variants={
    primary:'bg-emerald-700 text-white hover:bg-emerald-800 shadow-sm',
    secondary:'bg-white text-slate-900 border border-slate-200 hover:bg-slate-50',
    danger:'bg-red-600 text-white hover:bg-red-700',
    ghost:'bg-transparent text-slate-700 hover:bg-slate-100'
  }
  return <button className={cn('inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50',variants[variant],className)} {...props}/>
}
