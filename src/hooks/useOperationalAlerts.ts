import { useCallback, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'

export type OperationalAlert={
  alert_key:string
  severity:'critical'|'warning'|'info'
  title:string
  detail:string
  icon:'stock'|'barcode'|'fx'
  fingerprint:string
  sort_order:number
}

type AlertRead={alert_key:string;fingerprint:string;dismissed:boolean;dismissed_at:string|null}

export function useOperationalAlerts(){
  const {user}=useAuth()
  const qc=useQueryClient()
  const alertQuery=useQuery({
    queryKey:['operational-alerts'],
    queryFn:async()=>{
      const {data,error}=await supabase.from('operational_alerts').select('*').order('sort_order').order('title')
      if(error)throw error
      return (data||[]) as OperationalAlert[]
    },
    refetchInterval:300_000,
  })
  const readQuery=useQuery({
    queryKey:['alert-reads',user?.id],
    enabled:!!user,
    queryFn:async()=>{
      const {data,error}=await supabase.from('user_alert_reads').select('alert_key,fingerprint,dismissed,dismissed_at').eq('user_id',user!.id)
      if(error)throw error
      return (data||[]) as AlertRead[]
    },
  })
  const activeAlerts=alertQuery.data||[]
  const readMap=useMemo(()=>new Map((readQuery.data||[]).map(x=>[x.alert_key,x])),[readQuery.data])
  const isDismissed=useCallback((alert:OperationalAlert)=>{const state=readMap.get(alert.alert_key);return !!state?.dismissed&&state.fingerprint===alert.fingerprint},[readMap])
  const alerts=useMemo(()=>activeAlerts.filter(x=>!isDismissed(x)),[activeAlerts,isDismissed])
  const clearedCount=useMemo(()=>activeAlerts.reduce((count,x)=>count+(isDismissed(x)?1:0),0),[activeAlerts,isDismissed])
  const unreadCount=useMemo(()=>alerts.reduce((count,x)=>count+(readMap.get(x.alert_key)?.fingerprint===x.fingerprint?0:1),0),[alerts,readMap])
  const stockAlertCount=useMemo(()=>activeAlerts.reduce((count,x)=>count+(x.icon==='stock'&&(x.severity==='warning'||x.severity==='critical')?1:0),0),[activeAlerts])

  const refreshReadState=useCallback(async()=>{if(user)await qc.invalidateQueries({queryKey:['alert-reads',user.id]})},[qc,user])
  const markAllRead=useCallback(async()=>{
    if(!user||!alerts.length)return
    const rows=alerts.map(x=>({user_id:user.id,alert_key:x.alert_key,fingerprint:x.fingerprint,seen_at:new Date().toISOString(),dismissed:false,dismissed_at:null}))
    const {error}=await supabase.from('user_alert_reads').upsert(rows,{onConflict:'user_id,alert_key'})
    if(error)throw error
    await refreshReadState()
  },[alerts,refreshReadState,user])
  const clearAll=useCallback(async()=>{
    if(!user||!alerts.length)return
    const now=new Date().toISOString()
    const rows=alerts.map(x=>({user_id:user.id,alert_key:x.alert_key,fingerprint:x.fingerprint,seen_at:now,dismissed:true,dismissed_at:now}))
    const {error}=await supabase.from('user_alert_reads').upsert(rows,{onConflict:'user_id,alert_key'})
    if(error)throw error
    await refreshReadState()
  },[alerts,refreshReadState,user])
  const resetCleared=useCallback(async()=>{
    if(!user||!clearedCount)return
    const {error}=await supabase.from('user_alert_reads').update({dismissed:false,dismissed_at:null}).eq('user_id',user.id).eq('dismissed',true)
    if(error)throw error
    await refreshReadState()
  },[clearedCount,refreshReadState,user])

  return {alerts,activeAlerts,clearedCount,unreadCount,stockAlertCount,markAllRead,clearAll,resetCleared,isLoading:alertQuery.isLoading||readQuery.isLoading,isError:alertQuery.isError||readQuery.isError}
}
