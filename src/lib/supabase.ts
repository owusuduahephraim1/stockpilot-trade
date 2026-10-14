/** Neon SDK PostgREST + Neon Auth compatibility facade. No Supabase runtime calls. */
import { createClient, SupabaseAuthAdapter } from '@neondatabase/neon-js'
import type { SupabaseClient } from '@supabase/supabase-js'
const authUrl=import.meta.env.VITE_NEON_AUTH_URL
const dataUrl=import.meta.env.VITE_NEON_DATA_API_URL
if(!authUrl||!dataUrl)console.error('Missing Neon Auth/Data API URLs')
const client=createClient({auth:{adapter:SupabaseAuthAdapter(),url:authUrl||''},dataApi:{url:dataUrl||''}})
export const supabase=client as unknown as SupabaseClient
export const neonClient=client
