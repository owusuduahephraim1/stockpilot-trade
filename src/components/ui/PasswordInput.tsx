import { useState, type InputHTMLAttributes } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from './Input'
import { cn } from '@/lib/utils'

type Props=Omit<InputHTMLAttributes<HTMLInputElement>,'type'>

export function PasswordInput({className,...props}:Props){
  const [visible,setVisible]=useState(false)
  return <div className="relative">
    <Input {...props} type={visible?'text':'password'} className={cn('pr-11',className)}/>
    <button
      type="button"
      onClick={()=>setVisible(x=>!x)}
      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-200"
      aria-label={visible?'Hide password':'Show password'}
      title={visible?'Hide password':'Show password'}
    >{visible?<EyeOff className="h-4 w-4"/>:<Eye className="h-4 w-4"/>}</button>
  </div>
}
