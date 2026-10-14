import { supabase } from './supabase'

async function headers() {
  const { data } = await supabase.auth.getSession()
  const jwt = await (supabase.auth as unknown as { getJWTToken?: () => Promise<string | null> }).getJWTToken?.()
  return { 'content-type': 'application/json', authorization: `Bearer ${jwt || data.session?.access_token || ''}` }
}

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
  if (!base) throw new Error('Cloudflare R2/API backend is not connected. Configure VITE_API_BASE_URL.')
  const response = await fetch(`${base}${url}`, { ...init, headers: { ...(await headers()), ...(init?.headers || {}) } })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`)
  return data as T
}

export async function uploadDocument(file: File, category: 'invoices'|'receipts'|'delivery-notes') {
  if (file.size > 10 * 1024 * 1024) throw new Error('Maximum document size is 10 MB')
  const allowed = ['application/pdf','image/png','image/jpeg','image/webp']
  if (!allowed.includes(file.type)) throw new Error('Only PDF, PNG, JPG, and WEBP files are allowed')
  const signed = await api<{uploadUrl:string,key:string}>('/api/upload-url', {
    method: 'POST', body: JSON.stringify({ filename: file.name, contentType: file.type, category, size: file.size }),
  })
  const put = await fetch(signed.uploadUrl, { method:'PUT', headers:{'content-type':file.type}, body:file })
  if (!put.ok) throw new Error('Document upload failed')
  return signed.key
}

export async function cleanupUnlinkedDocument(key: string) {
  if (!key) return
  await api<{deleted:boolean;linked:boolean}>('/api/delete-unlinked-file', {
    method: 'POST', body: JSON.stringify({ key }),
  })
}

export async function cleanupUnlinkedDocumentQuietly(key?: string | null) {
  if (!key) return
  try { await cleanupUnlinkedDocument(key) } catch { /* Cleanup must never hide the primary transaction result. */ }
}

export async function openPrivateFile(key: string) {
  const data = await api<{url:string}>(`/api/file-url?key=${encodeURIComponent(key)}`)
  window.open(data.url, '_blank', 'noopener,noreferrer')
}
