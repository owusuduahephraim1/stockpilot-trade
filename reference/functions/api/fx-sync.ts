import type { Env } from '../_lib/env'
import { requireUser } from '../_lib/auth'
import { BOG_FX_SOURCE_URL, parseBankOfGhanaFx, type BogCurrencyCode } from '../_lib/bogFx'
import { json, unauthorized } from '../_lib/http'

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const { admin } = await requireUser(request, env)
    const upstream = await fetch(BOG_FX_SOURCE_URL, {
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'user-agent': 'StockPilot/1.10.1 (+https://stockpilot-uk.pages.dev)',
      },
    })
    if (!upstream.ok) return json({ error: `Bank of Ghana FX source returned ${upstream.status}` }, 502)

    const parsed = parseBankOfGhanaFx(await upstream.text())
    const { data: existing, error: readError } = await admin
      .from('exchange_rates')
      .select('currency_code,rate_to_ghs,rate_source,source_date,updated_at')
      .in('currency_code', ['GBP', 'USD'])
    if (readError) return json({ error: readError.message }, 500)

    const existingMap = new Map((existing || []).map((row: any) => [row.currency_code, row]))
    const now = new Date().toISOString()
    const changed: BogCurrencyCode[] = []

    for (const rate of parsed) {
      const current: any = existingMap.get(rate.currency_code)
      const valueChanged = !current || Math.abs(Number(current.rate_to_ghs || 0) - rate.mid) > 0.0000005
      const sourceAdvanced = !current?.source_date || rate.source_date > String(current.source_date)
      const officialCorrection = current?.rate_source === 'bank_of_ghana' && valueChanged
      const shouldUpdate = !current || sourceAdvanced || officialCorrection
      if (!shouldUpdate) continue

      const { error } = await admin.from('exchange_rates').upsert({
        currency_code: rate.currency_code,
        rate_to_ghs: rate.mid,
        rate_source: 'bank_of_ghana',
        source_date: rate.source_date,
        updated_by: null,
        updated_at: now,
      }, { onConflict: 'currency_code' })
      if (error) return json({ error: error.message }, 500)
      changed.push(rate.currency_code)
    }

    const sourceDate = parsed.map(rate => rate.source_date).sort().at(-1) || null
    return json({
      updated: changed.length > 0,
      changed,
      source: 'Bank of Ghana',
      sourceDate,
      sourceUrl: BOG_FX_SOURCE_URL,
      rates: Object.fromEntries(parsed.map(rate => [rate.currency_code, {
        mid: rate.mid,
        buying: rate.buying,
        selling: rate.selling,
        sourceDate: rate.source_date,
      }])),
    })
  } catch (error) {
    if ((error as Error).message === 'UNAUTHORIZED') return unauthorized()
    if ((error as Error).message === 'SERVER_CONFIGURATION') return json({ error: 'FX sync is temporarily unavailable' }, 503)
    return json({ error: (error as Error).message || 'Could not synchronize Bank of Ghana FX rates' }, 502)
  }
}
