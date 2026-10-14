import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyRound, Plus, Shield, Trash2 } from 'lucide-react'
import { Navigate } from 'react-router-dom'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/utils'

type AdminUser={id:string;email?:string;full_name?:string;role?:'admin'|'staff';created_at?:string;last_sign_in_at?:string;banned_until?:string|null}
const blank={email:'',password:'',full_name:'',role:'staff' as 'admin'|'staff'}
const DELETE_PHRASE='DELETE ACCOUNT'

const generateTemporaryPassword=()=>{
 const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%'
 const bytes=new Uint32Array(14);crypto.getRandomValues(bytes)
 return Array.from(bytes,n=>alphabet[n%alphabet.length]).join('')
}

export function UsersPage(){
 const {profile,user}=useAuth();const qc=useQueryClient()
 const [form,setForm]=useState(blank),[message,setMessage]=useState(''),[modalOpen,setModalOpen]=useState(false)
 const [resetUser,setResetUser]=useState<AdminUser|null>(null),[resetPassword,setResetPassword]=useState(''),[resetConfirm,setResetConfirm]=useState(''),[resetMessage,setResetMessage]=useState('')
 const [deleteUser,setDeleteUser]=useState<AdminUser|null>(null),[deleteConfirm,setDeleteConfirm]=useState(''),[deleteMessage,setDeleteMessage]=useState('')

 const users=useQuery({queryKey:['admin-users'],enabled:profile?.role==='admin',queryFn:()=>api<{users:AdminUser[]}>('/api/admin/users')})
 const closeModal=()=>{setModalOpen(false);setForm(blank);setMessage('')}
 const closeReset=()=>{setResetUser(null);setResetPassword('');setResetConfirm('');setResetMessage('')}
 const closeDelete=()=>{setDeleteUser(null);setDeleteConfirm('');setDeleteMessage('')}
 const isDisabled=(x:AdminUser)=>!!x.banned_until&&new Date(x.banned_until)>new Date()
 const activeAdminCount=useMemo(()=>(users.data?.users||[]).filter(x=>x.role==='admin'&&!isDisabled(x)).length,[users.data?.users])

 const create=useMutation({mutationFn:()=>api('/api/admin/create-user',{method:'POST',body:JSON.stringify(form)}),onSuccess:()=>{closeModal();qc.invalidateQueries({queryKey:['admin-users']})},onError:(e:any)=>setMessage(e.message)})
 const update=useMutation({mutationFn:(body:any)=>api('/api/admin/update-user',{method:'POST',body:JSON.stringify(body)}),onSuccess:()=>qc.invalidateQueries({queryKey:['admin-users']}),onError:(e:any)=>alert(e.message)})
 const reset=useMutation({mutationFn:()=>{if(!resetUser)throw new Error('No user selected');if(resetPassword.length<8)throw new Error('Temporary password must contain at least 8 characters.');if(resetPassword!==resetConfirm)throw new Error('The password confirmation does not match.');return api('/api/admin/update-user',{method:'POST',body:JSON.stringify({userId:resetUser.id,password:resetPassword})})},onSuccess:()=>{setResetMessage('Password reset successfully.');qc.invalidateQueries({queryKey:['admin-users']})},onError:(e:any)=>setResetMessage(e.message)})
 const remove=useMutation({mutationFn:()=>{if(!deleteUser)throw new Error('No account selected');if(deleteConfirm!==DELETE_PHRASE)throw new Error(`Type ${DELETE_PHRASE} to confirm permanent deletion.`);return api('/api/admin/delete-user',{method:'POST',body:JSON.stringify({userId:deleteUser.id})})},onSuccess:()=>{closeDelete();qc.invalidateQueries({queryKey:['admin-users']});qc.invalidateQueries({queryKey:['activity-logs']})},onError:(e:any)=>setDeleteMessage(e.message)})

 if(profile&&profile.role!=='admin')return <Navigate to="/" replace/>

 const openReset=(x:AdminUser)=>{setResetUser(x);setResetPassword('');setResetConfirm('');setResetMessage('')}
 const openDelete=(x:AdminUser)=>{setDeleteUser(x);setDeleteConfirm('');setDeleteMessage('')}
 const roleBadge=(x:AdminUser)=><Badge>{x.role==='admin'?'Owner / Admin':'Staff / Operator'}</Badge>
 const statusBadge=(x:AdminUser)=>{const disabled=isDisabled(x);return <Badge className={disabled?'bg-red-100 text-red-700':'bg-emerald-100 text-emerald-700'}>{disabled?'Disabled':'Active'}</Badge>}
 const actions=(x:AdminUser,compact=false)=>{const disabled=isDisabled(x),isSelf=x.id===user?.id;return <div className={`flex flex-wrap gap-2 ${compact?'mt-3':''}`}>
   {x.role==='staff'&&!isSelf&&<Button variant="secondary" className={compact?'px-3 py-2 text-xs':''} onClick={()=>openReset(x)}><KeyRound className="h-4 w-4"/>{compact?'Password':'Reset password'}</Button>}
   <Button variant="secondary" className={compact?'px-3 py-2 text-xs':''} disabled={isSelf} onClick={()=>update.mutate({userId:x.id,role:x.role==='admin'?'staff':'admin'})}><Shield className="h-4 w-4"/>{x.role==='admin'?'Make staff':'Make admin'}</Button>
   <Button variant={disabled?'secondary':'danger'} className={compact?'px-3 py-2 text-xs':''} disabled={isSelf} onClick={()=>update.mutate({userId:x.id,disabled:!disabled})}>{disabled?'Enable':'Disable'}</Button>
   {disabled&&!isSelf&&<Button variant="danger" className={compact?'px-3 py-2 text-xs':''} onClick={()=>openDelete(x)}><Trash2 className="h-4 w-4"/>{compact?'Delete':'Delete permanently'}</Button>}
  </div>}

 return <>
 <PageHeader title="User management" description="Control owner and operator access to the workspace."/>

 <Modal open={modalOpen} onClose={closeModal} title="Add workspace user" description="Create a Staff / Operator or another Owner / Admin." size="lg" footer={<><Button variant="secondary" onClick={closeModal}>Cancel</Button><Button onClick={()=>create.mutate()} disabled={create.isPending||!form.email||form.password.length<8||!form.full_name}>{create.isPending?'Creating...':'Create user'}</Button></>}>
  <div className="grid gap-4 md:grid-cols-2"><div><label>Full name</label><Input value={form.full_name} onChange={e=>setForm({...form,full_name:e.target.value})}/></div><div><label>Email</label><Input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></div><div><label>Temporary password</label><PasswordInput minLength={8} autoComplete="new-password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/></div><div><label>Role</label><select value={form.role} onChange={e=>setForm({...form,role:e.target.value as 'admin'|'staff'})}><option value="staff">Staff / Operator</option><option value="admin">Owner / Admin</option></select></div></div>{message&&<p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{message}</p>}
 </Modal>

 <Modal open={!!resetUser} onClose={closeReset} title="Reset staff password" description={resetUser?.full_name||resetUser?.email||'Staff account'} size="md" footer={<><Button variant="secondary" onClick={closeReset}>Close</Button><Button onClick={()=>reset.mutate()} disabled={reset.isPending||resetPassword.length<8||resetPassword!==resetConfirm}>{reset.isPending?'Resetting...':'Reset password'}</Button></>}>
  <div className="space-y-4"><div><div className="flex items-end justify-between gap-3"><label>Temporary password</label><button type="button" className="mb-1 text-xs font-semibold text-emerald-700 hover:underline" onClick={()=>{const value=generateTemporaryPassword();setResetPassword(value);setResetConfirm(value);setResetMessage('')}}>Generate secure password</button></div><PasswordInput minLength={8} autoComplete="new-password" value={resetPassword} onChange={e=>{setResetPassword(e.target.value);setResetMessage('')}}/></div><div><label>Confirm temporary password</label><PasswordInput minLength={8} autoComplete="new-password" value={resetConfirm} onChange={e=>{setResetConfirm(e.target.value);setResetMessage('')}}/></div>{resetMessage&&<p className={`rounded-xl p-3 text-sm ${resetMessage.startsWith('Password reset successfully')?'bg-emerald-50 text-emerald-800':'bg-red-50 text-red-700'}`}>{resetMessage}</p>}</div>
 </Modal>

 <Modal open={!!deleteUser} onClose={closeDelete} title="Permanently delete account" description={deleteUser?.full_name||deleteUser?.email||'Disabled workspace account'} size="md" footer={<><Button variant="secondary" onClick={closeDelete}>Cancel</Button><Button variant="danger" onClick={()=>remove.mutate()} disabled={remove.isPending||deleteConfirm!==DELETE_PHRASE}>{remove.isPending?'Deleting...':'Delete permanently'}</Button></>}>
  <div className="space-y-4"><div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">The disabled login account will be permanently removed. Historical sales, purchases and audit attribution remain preserved.{deleteUser?.role==='admin'?' Another active Owner / Admin must remain in the workspace.':''}</div><div><label>Type <strong>{DELETE_PHRASE}</strong> to confirm</label><Input value={deleteConfirm} onChange={e=>{setDeleteConfirm(e.target.value.toUpperCase());setDeleteMessage('')}} autoComplete="off"/></div>{deleteMessage&&<p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{deleteMessage}</p>}</div>
 </Modal>

 <div className="workspace-register overflow-hidden">
  <div className="workspace-register-toolbar gap-3"><div className="min-w-0"><div className="workspace-register-title">Workspace users</div><div className="workspace-register-subtitle">{users.data?.users?.length||0} account{(users.data?.users?.length||0)===1?'':'s'} · {activeAdminCount} active Owner / Admin</div></div><Button onClick={()=>setModalOpen(true)} className="shrink-0 bg-emerald-700 hover:bg-emerald-800"><Plus className="h-4 w-4"/><span className="hidden xs:inline">Add user</span><span className="xs:hidden">Add</span></Button></div>

  <div className="divide-y divide-slate-100 md:hidden">{(users.data?.users||[]).map(x=>{const disabled=isDisabled(x);return <div key={x.id} className="p-4">
    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="truncate text-sm font-bold text-slate-900">{x.full_name||x.email}</div><div className="mt-0.5 truncate text-xs text-slate-500">{x.email}</div></div>{statusBadge(x)}</div>
    <div className="mt-3 flex flex-wrap items-center gap-2">{roleBadge(x)}<span className="text-[11px] text-slate-500">Created {formatDate(x.created_at)}</span></div>
    {actions(x,true)}
    {disabled&&<div className="mt-2 text-[10px] font-medium text-red-600">Permanent deletion is available while this account remains disabled.</div>}
  </div>})}{!users.data?.users?.length&&<div className="p-5 text-sm text-slate-500">No workspace users found.</div>}</div>

  <div className="hidden md:block"><div className="table-wrap"><table><thead><tr><th>User</th><th>Role</th><th>Created</th><th>Status</th><th>Actions</th></tr></thead><tbody>{(users.data?.users||[]).map(x=><tr key={x.id}><td><div className="font-semibold">{x.full_name||x.email}</div><div className="text-xs text-slate-500">{x.email}</div></td><td>{roleBadge(x)}</td><td>{formatDate(x.created_at)}</td><td>{statusBadge(x)}</td><td>{actions(x)}</td></tr>)}</tbody></table></div></div>
 </div>
 </>
}
