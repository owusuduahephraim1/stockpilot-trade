import type { InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
export function Input({className,...props}:InputHTMLAttributes<HTMLInputElement>){return <input className={cn('w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition-[border-color,box-shadow,background-color] duration-150 focus:border-slate-400 focus:ring-2 focus:ring-slate-100',className)} {...props}/>}
