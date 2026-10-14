import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Mail, MapPin, Pencil, Phone, Plus, Search, Trash2, Truck } from 'lucide-react'
import { PageHeader } from '@/components/PageHeader'
import { CameraBarcodeButton } from '@/components/BarcodeScanner'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { Supplier } from '@/types/database'

const blank={name:'',contact_person:'',phone:'',email:'',address:''}
export function SuppliersPage(){
 const {profile}=useAuth();const navigate=useNavigate();const qc=useQueryClient();const [q,setQ]=useState(''),[form,setForm]=useState(blank),[editing,setEditing]=useState<Supplier|null>(null),[error,setError]=useState(''),[modalOpen,setModalOpen]=useState(false)
 const suppliers=useQuery({queryKey:['suppliers'],queryFn:async()=>{const {data,error}=await supabase.from('suppliers').select('*').order('name');if(error)throw error;return data as Supplier[]}})
 const filtered=useMemo(()=>(suppliers.data||[]).filter(x=>`${x.name} ${x.contact_person||''} ${x.phone||''} ${x.email||''} ${x.address||''}`.toLowerCase().includes(q.toLowerCase())),[suppliers.data,q])
 const closeModal=()=>{setModalOpen(false);setEditing(null);setForm(blank);setError('')}
 const save=useMutation({mutationFn:async()=>{const payload={name:form.name.trim(),contact_person:form.contact_person.trim()||null,phone:form.phone.trim()||null,email:form.email.trim()||null,address:form.address.trim()||null};const {error}=editing?await supabase.from('suppliers').update(payload).eq('id',editing.id):await supabase.from('suppliers').insert(payload);if(error)throw error},onSuccess:()=>{closeModal();qc.invalidateQueries({queryKey:['suppliers']})},onError:(e:any)=>setError(e.message)})
 const del=useMutation({mutationFn:async(id:string)=>{const {error}=await supabase.from('suppliers').delete().eq('id',id);if(error)throw error},onSuccess:()=>qc.invalidateQueries({queryKey:['suppliers']}),onError:(e:any)=>alert(e.message)})
 const edit=(x:Supplier)=>{setEditing(x);setForm({name:x.name,contact_person:x.contact_person||'',phone:x.phone||'',email:x.email||'',address:x.address||''});setModalOpen(true)}
 return <>
  <PageHeader title="Suppliers" description="Manage manufacturers and distribution partners." actions={<CameraBarcodeButton label="Scan barcode" onScan={value=>navigate(`/products?search=${encodeURIComponent(value)}`)}/>}/>
  <Modal open={modalOpen} onClose={closeModal} title={editing?'Edit supplier':'Add supplier'} description="Supplier details stay separate from the supplier network so the directory remains compact." size="lg" footer={<><Button variant="secondary" onClick={closeModal}>Cancel</Button><Button onClick={()=>save.mutate()} disabled={!form.name.trim()||save.isPending}>{save.isPending?'Saving...':editing?'Save changes':'Add supplier'}</Button></>}>
   <div className="grid gap-4 md:grid-cols-2"><div className="md:col-span-2"><label>Supplier name</label><Input value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></div><div><label>Contact person</label><Input value={form.contact_person} onChange={e=>setForm({...form,contact_person:e.target.value})}/></div><div><label>Phone</label><Input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></div><div><label>Email</label><Input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></div><div><label>Address</label><Input value={form.address} onChange={e=>setForm({...form,address:e.target.value})}/></div></div>{error&&<p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}{profile?.role==='staff'&&<p className="mt-4 text-xs text-slate-500">Staff can add suppliers for purchasing, but only Admin/Owner can edit or delete existing supplier records.</p>}
  </Modal>
  <div className="workspace-register">
   <div className="workspace-register-toolbar"><div><div className="workspace-register-title">Supplier network</div><div className="workspace-register-subtitle">Manufacturers and distribution partners · {filtered.length} supplier{filtered.length===1?'':'s'}</div></div><div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto"><div className="relative min-w-52 flex-1 sm:w-72"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/><Input className="pl-9" placeholder="Search suppliers..." value={q} onChange={e=>setQ(e.target.value)}/></div><Button onClick={()=>{setEditing(null);setForm(blank);setModalOpen(true)}} className="bg-emerald-700 hover:bg-emerald-800"><Plus className="h-4 w-4"/>Add supplier</Button></div></div>
   <div className="bounded-list !max-h-[calc(100dvh-285px)] p-4"><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{filtered.map(x=><Card key={x.id} className="p-0"><div className="p-4"><div className="flex items-start justify-between gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-blue-50 text-blue-700"><Truck className="h-5 w-5"/></div><span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">Active</span></div><h3 className="mt-4 font-bold text-slate-950">{x.name}</h3><p className="mt-1 text-xs text-slate-500">{x.contact_person||'No contact person'}</p><div className="mt-4 space-y-2 text-xs text-slate-600">{x.phone&&<div className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-slate-400"/>{x.phone}</div>}{x.email&&<div className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 text-slate-400"/>{x.email}</div>}{x.address&&<div className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-slate-400"/><span className="line-clamp-1">{x.address}</span></div>}</div></div>{profile?.role==='admin'&&<div className="flex items-center justify-end gap-1 border-t border-slate-100 px-3 py-2"><Button variant="ghost" onClick={()=>edit(x)}><Pencil className="h-4 w-4"/>Edit</Button><Button variant="ghost" onClick={()=>confirm(`Delete supplier ${x.name}? Existing purchases will keep their transaction history but the supplier link will be cleared.`)&&del.mutate(x.id)}><Trash2 className="h-4 w-4 text-red-600"/></Button></div>}</Card>)}{!filtered.length&&<Card className="md:col-span-2 xl:col-span-3"><p className="py-8 text-center text-sm text-slate-500">No suppliers found.</p></Card>}</div></div>
  </div>
 </>
}
