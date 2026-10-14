export const BOG_FX_SOURCE_URL = 'https://www.bog.gov.gh/treasury-and-the-markets/daily-interbank-fx-rates/'

const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
}

export type BogCurrencyCode = 'GBP' | 'USD'
export type BogParsedRate = {
  currency_code: BogCurrencyCode
  pair: 'GBPGHS' | 'USDGHS'
  buying: number
  selling: number
  mid: number
  source_date: string
}

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&pound;/gi, '£')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isoDate(value: string) {
  const match = value.trim().match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/)
  if (!match) throw new Error(`Unexpected Bank of Ghana rate date: ${value}`)
  const month = MONTHS[match[2].toLowerCase()]
  if (!month) throw new Error(`Unexpected Bank of Ghana rate month: ${value}`)
  return `${match[3]}-${month}-${match[1].padStart(2, '0')}`
}

function positiveRate(value: string, label: string) {
  const rate = Number(value.replace(/,/g, '').trim())
  if (!Number.isFinite(rate) || rate <= 0 || rate > 1000) throw new Error(`Invalid ${label} rate from Bank of Ghana`)
  return rate
}

function parseRate(html: string, currency_code: BogCurrencyCode, pair: 'GBPGHS' | 'USDGHS', currencyName: string): BogParsedRate {
  const upper = html.toUpperCase()
  const pairIndexInHtml = upper.indexOf(pair)
  if (pairIndexInHtml >= 0) {
    const before = html.slice(0, pairIndexInHtml)
    const rowStart = before.toLowerCase().lastIndexOf('<tr')
    const rowEnd = html.toLowerCase().indexOf('</tr>', pairIndexInHtml)
    if (rowStart >= 0 && rowEnd > pairIndexInHtml) {
      const row = html.slice(rowStart, rowEnd + 5)
      const cells = [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(match => decodeHtml(match[1]))
      const pairCell = cells.findIndex(cell => cell.toUpperCase() === pair)
      if (pairCell >= 0 && cells.length >= pairCell + 4) {
        const dateCell = cells.slice(0, pairCell).reverse().find(cell => /^\d{1,2}\s+[A-Za-z]{3}\s+\d{4}$/.test(cell))
        if (dateCell) {
          return {
            currency_code,
            pair,
            buying: positiveRate(cells[pairCell + 1], `${pair} buying`),
            selling: positiveRate(cells[pairCell + 2], `${pair} selling`),
            mid: positiveRate(cells[pairCell + 3], `${pair} mid`),
            source_date: isoDate(dateCell),
          }
        }
      }
    }
  }

  const text = decodeHtml(html)
  const escapedName = currencyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`(\\d{1,2}\\s+[A-Za-z]{3}\\s+\\d{4})\\s+${escapedName}\\s+${pair}\\s+([0-9.,]+)\\s+([0-9.,]+)\\s+([0-9.,]+)`, 'i')
  const match = text.match(pattern)
  if (!match) throw new Error(`Could not locate ${pair} on the Bank of Ghana daily interbank page`)
  return {
    currency_code,
    pair,
    buying: positiveRate(match[2], `${pair} buying`),
    selling: positiveRate(match[3], `${pair} selling`),
    mid: positiveRate(match[4], `${pair} mid`),
    source_date: isoDate(match[1]),
  }
}

export function parseBankOfGhanaFx(html: string): BogParsedRate[] {
  return [
    parseRate(html, 'GBP', 'GBPGHS', 'Pound Sterling'),
    parseRate(html, 'USD', 'USDGHS', 'US Dollar'),
  ]
}
