import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/context/AuthContext'
/** Neon Data API does not provide Supabase Realtime; refresh the same queries every 30 seconds. */
export function RealtimeSync(){
 const qc=useQueryClient(),{user}=useAuth()
 useEffect(()=>{if(!user?.id)return;const timer=window.setInterval(()=>{
 for(const key of ['products','suppliers','customers','purchases','sales','inventory','operational-alerts','exchange-rates','app-settings','activity-logs','stock-movements','report-purchases','report-sales'])void qc.invalidateQueries({queryKey:[key]})
 },30000);return()=>window.clearInterval(timer)},[qc,user?.id]);return null
}
