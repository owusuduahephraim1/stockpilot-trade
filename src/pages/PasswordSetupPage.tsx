import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { KeyRound, Mail, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { supabase } from '@/lib/supabase'

export function PasswordSetupPage() {
  const [search] = useSearchParams()
  const token = search.get('token') || new URLSearchParams(window.location.search).get('token') || ''
  const invalidToken = search.get('error') || new URLSearchParams(window.location.search).get('error')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [complete, setComplete] = useState(false)
  const [notice, setNotice] = useState('')

  const requestLink = async (event: FormEvent) => {
    event.preventDefault()
    if (busy || !email.trim()) return
    setBusy(true)
    setNotice('')
    try {
      // The Auth service emails the link. Passwords and reset tokens are never sent to our Worker.
      const base = new URL(import.meta.env.BASE_URL, window.location.origin)
      const redirectTo = base.href + '#/reset-password'
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo })
      if (error) throw error
      setNotice('If the account is eligible, a password setup link has been sent. Check your inbox and spam folder.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to request a password setup email.')
    } finally {
      setBusy(false)
    }
  }

  const changePassword = async (event: FormEvent) => {
    event.preventDefault()
    if (busy || !token) return
    if (password.length < 12) return setNotice('Use at least 12 characters for your new password.')
    if (password !== confirmation) return setNotice('Passwords do not match.')
    setBusy(true)
    setNotice('')
    try {
      const url = String(import.meta.env.VITE_NEON_AUTH_URL || '').replace(/\/$/, '')
      if (!url) throw new Error('Neon authentication is not configured.')
      // Token is received from the Neon Auth recovery email and used exactly once here.
      const result = await fetch(url + '/reset-password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token, newPassword: password }),
      })
      const data = await result.json().catch(() => ({})) as { message?: string; error?: { message?: string }; code?: string }
      if (!result.ok) throw new Error(data.message || data.error?.message || 'Unable to set password. Request a new link.')
      setPassword('')
      setConfirmation('')
      setComplete(true)
      // Remove the one-use recovery token from the browser's visible URL/history.
      window.history.replaceState(window.history.state, '', new URL(import.meta.env.BASE_URL, window.location.origin).href + '#/reset-password')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to complete password setup.')
    } finally {
      setBusy(false)
    }
  }

  return <div className="grid min-h-screen place-items-center bg-slate-950 px-4 py-10">
    <main className="w-full max-w-md rounded-3xl bg-white p-6 text-slate-900 shadow-2xl sm:p-9">
      <div className="flex items-center gap-2 text-xl font-extrabold"><KeyRound className="text-emerald-700"/> StockPilot Trade</div>
      <h1 className="mt-6 text-2xl font-bold">{complete ? 'Password established' : token ? 'Create your password' : 'Set up or reset password'}</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">{complete ? 'Your account password is ready. Return to sign in.' : token ? 'Choose a strong password for your Neon-authenticated StockPilot Trade account.' : 'Enter the email address registered for your account. We will send a secure password setup link.'}</p>
      {invalidToken && <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">This recovery link is invalid or expired. Request another below.</p>}
      {!complete && token && !invalidToken
        ? <form onSubmit={changePassword} className="mt-6 space-y-4">
            <div><label className="text-sm font-semibold" htmlFor="new-password">New password</label><PasswordInput id="new-password" value={password} onChange={e=>setPassword(e.target.value)} minLength={12} autoComplete="new-password" required /></div>
            <div><label className="text-sm font-semibold" htmlFor="confirm-password">Confirm password</label><PasswordInput id="confirm-password" value={confirmation} onChange={e=>setConfirmation(e.target.value)} minLength={12} autoComplete="new-password" required /></div>
            <p className="text-xs text-slate-500"><ShieldCheck className="mr-1 inline h-4 w-4 text-emerald-700"/>Your password is processed directly by Neon Auth.</p>
            <Button className="w-full" disabled={busy}>{busy?'Saving password…':'Save password'}</Button>
          </form>
        : !complete && <form onSubmit={requestLink} className="mt-6 space-y-4">
            <div><label className="text-sm font-semibold" htmlFor="recovery-email">Account email</label><Input id="recovery-email" type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" required /></div>
            <Button className="w-full" disabled={busy}><Mail className="mr-2 h-4 w-4"/>{busy?'Sending…':'Email password setup link'}</Button>
          </form>}
      {notice && <p role="status" className="mt-4 rounded-xl bg-slate-100 p-3 text-sm text-slate-700">{notice}</p>}
      <div className="mt-6 border-t border-slate-100 pt-4 text-center text-sm"><Link to="/login" className="font-semibold text-emerald-700 hover:underline">Back to sign in</Link></div>
    </main>
  </div>
}
