import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Boxes, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PasswordInput } from '@/components/ui/PasswordInput'

export function LoginPage(){
 const {session,loading,signIn}=useAuth()
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
 if(!loading&&session)return <Navigate to="/" replace/>
 const submit=async(e:React.FormEvent)=>{e.preventDefault();if(loading||busy)return;setBusy(true);setMessage('')
  try{
   await signIn(email,password)
  }catch(err){setMessage((err as Error).message)}finally{setBusy(false)}
 }
 return <div className="min-h-screen bg-slate-950 p-4 text-white sm:p-8"><div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-6xl overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl lg:grid-cols-[1.1fr_.9fr]">
  <section className="relative hidden overflow-hidden p-12 lg:flex lg:flex-col lg:justify-between"><div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,.18),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(34,197,94,.15),transparent_35%)]"/><div className="relative"><div className="flex items-center gap-3 text-xl font-bold"><Boxes/>StockPilot™</div></div><div className="relative max-w-xl"><h1 className="text-5xl font-black leading-tight tracking-tight">Know your stock. Control every transaction. Grow with confidence.</h1><p className="mt-5 text-lg leading-8 text-slate-300">StockPilot brings inventory, purchasing, sales, customers, suppliers, and profitability into one clear operational workspace, helping your team work accurately while management stays informed from anywhere.</p><div className="mt-8 flex items-center gap-2 text-sm text-slate-300"><ShieldCheck className="h-5 w-5 text-emerald-400"/>Real-time stock control, accountable operations, and decision-ready reporting</div></div><div className="relative text-xs leading-5 text-slate-500"><div>StockPilot Inventory v1.10.3</div><div>Developed by Nana K IT Solutions Consult</div></div></section>
  <section className="flex items-center bg-white p-6 text-slate-950 sm:p-10"><div className="mx-auto w-full max-w-md"><div className="mb-8 lg:hidden"><div className="flex items-center gap-2 text-xl font-bold"><Boxes/>StockPilot™</div></div><h2 className="text-3xl font-bold">Welcome back</h2><p className="mt-2 text-sm text-slate-500">Sign in to manage inventory, sales, purchases, and daily operations.</p>
   <form className="mt-8 space-y-4" onSubmit={submit}><div><label>Email</label><Input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email"/></div><div><label>Password</label><PasswordInput value={password} onChange={e=>setPassword(e.target.value)} required minLength={8} autoComplete="current-password"/></div>{message&&<div className="rounded-xl bg-slate-100 p-3 text-sm text-slate-700">{message}</div>}<Button className="w-full" disabled={busy||loading}>{busy?'Signing in...':loading?'Checking session...':'Sign in'}</Button></form>
   <footer className="mt-8 border-t border-slate-200 pt-5"><nav aria-label="StockPilot information" className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-semibold text-slate-500"><Link className="hover:text-emerald-700" to="/info/about">About</Link><Link className="hover:text-emerald-700" to="/info/support">Support</Link><Link className="hover:text-emerald-700" to="/info/privacy">Privacy</Link><Link className="hover:text-emerald-700" to="/info/terms">Terms</Link></nav><div className="mt-3 text-center text-[11px] leading-5 text-slate-400"><div>StockPilot™ Inventory v1.10.3 · Developed by Nana K IT Solutions Consult</div><div>© 2026 Nana K IT Solutions Consult. All rights reserved.</div></div></footer>
  </div></section>
 </div></div>
}
