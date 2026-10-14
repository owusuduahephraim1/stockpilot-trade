import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { CurrencyCode } from '@/types/database'

export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)) }

const localeFor: Record<CurrencyCode, string> = { GHS: 'en-GH', GBP: 'en-GB', USD: 'en-US' }
export const money = (value: number | string | null | undefined, currency: CurrencyCode = 'GHS') =>
  new Intl.NumberFormat(localeFor[currency], { style: 'currency', currency, minimumFractionDigits: 2 }).format(Number(value || 0))

export const today = () => new Date().toISOString().slice(0, 10)
export const formatDate = (value?: string | null) => value
  ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(`${value.slice(0, 10)}T00:00:00`))
  : '—'
export const formatDateTime = (value?: string | null) => value
  ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : '—'
