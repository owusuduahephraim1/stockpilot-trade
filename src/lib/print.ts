import type { AppSettings, CurrencyCode } from '@/types/database'
import { money } from '@/lib/utils'

const esc = (value: unknown) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;')

export interface PrintableTransactionLine {
  sku: string
  name: string
  quantity: number
  unitAmount: number
  totalAmount: number
}

export interface PrintableTransaction {
  kind: 'Purchase' | 'Sale'
  number: string
  date: string
  currency: CurrencyCode
  totalOriginal: number
  totalGhs: number
  counterpartyLabel: string
  counterparty: string
  paymentMethod?: string | null
  notes?: string | null
  lines: PrintableTransactionLine[]
  business?: AppSettings | null
}

/**
 * StockPilot thermal receipt renderer.
 *
 * The browser viewport selects the default paper profile automatically:
 *   - desktop/tablet: 80 mm thermal paper, approximately 42 monospace characters
 *   - mobile:         58 mm thermal paper, approximately 32 monospace characters
 *
 * Both profiles use the same semantic receipt data. Only the item presentation changes:
 * 80 mm uses a conventional four-column item table, while 58 mm uses a two-line item row
 * so long product/SKU text can wrap without displacing prices.
 */
export function printTransactionDocument(input: PrintableTransaction) {
  const mobilePaper = window.matchMedia('(max-width: 640px)').matches
  const paperWidth = mobilePaper ? '58mm' : '80mm'
  const contentWidth = mobilePaper ? '54mm' : '76mm'
  const characterRule = '-'.repeat(mobilePaper ? 32 : 42)
  const fontSize = mobilePaper ? '11px' : '13px'
  const popupWidth = mobilePaper ? 360 : 520

  const businessName = input.business?.business_name?.trim() || 'StockPilot'
  const contact = [input.business?.business_phone, input.business?.business_email].filter(Boolean).join(' · ')
  const address = input.business?.business_address?.trim() || ''
  const thankYou = input.business?.receipt_footer?.trim() || 'Thank you for your business.'
  const returnPolicy = 'Keep this receipt. Returns are subject to store policy.'
  const printedTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  const desktopRows = input.lines.map(line => `
    <tr>
      <td class="item-cell"><strong>${esc(line.name)}</strong><div class="muted wrap">${esc(line.sku)}</div></td>
      <td class="num">${line.quantity}</td>
      <td class="num">${esc(money(line.unitAmount, input.currency))}</td>
      <td class="num">${esc(money(line.totalAmount, input.currency))}</td>
    </tr>`).join('')

  const mobileRows = input.lines.map(line => `
    <div class="item-58">
      <div class="item-58-name">${esc(line.name)}</div>
      <div class="muted wrap">${esc(line.sku)}</div>
      <div class="item-58-calc"><span>${line.quantity} x ${esc(money(line.unitAmount, input.currency))}</span><strong>${esc(money(line.totalAmount, input.currency))}</strong></div>
    </div>`).join('')

  const payment = input.paymentMethod ? `<div class="meta-row"><span>Payment</span><strong>${esc(input.paymentMethod)}</strong></div>` : ''
  const notes = input.notes ? `<div class="notes"><strong>Note:</strong> ${esc(input.notes)}</div>` : ''
  const normalized = input.currency !== 'GHS' ? `<div class="total-row small"><span>GHS equivalent</span><strong>${esc(money(input.totalGhs, 'GHS'))}</strong></div>` : ''
  const zeroTax = money(0, input.currency)

  const win = window.open('', '_blank', `width=${popupWidth},height=760`)
  if (!win) {
    alert('Allow pop-ups to print this transaction.')
    return
  }

  win.document.write(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(input.kind)} ${esc(input.number)}</title><style>
    /* Exact thermal page request. Printer drivers may expose their own paper setting as well. */
    @page{size:${paperWidth} auto;margin:0}
    *{box-sizing:border-box}
    html,body{margin:0;padding:0;background:#fff;color:#000}
    body{font-family:"Courier New",Courier,monospace;font-size:${fontSize};line-height:1.3;-webkit-print-color-adjust:economy;print-color-adjust:economy}
    .receipt{width:${contentWidth};max-width:100%;margin:0 auto;padding:2mm 1mm 4mm;overflow-wrap:anywhere}
    .center{text-align:center}.right{text-align:right}.bold{font-weight:700}.wrap{overflow-wrap:anywhere;word-break:break-word}
    .brand{font-size:${mobilePaper ? '15px' : '18px'};font-weight:800;letter-spacing:.02em}
    .sub{margin-top:2px;font-size:${mobilePaper ? '10px' : '11px'}}
    .rule{height:1.35em;overflow:hidden;white-space:nowrap;letter-spacing:0;color:#000;margin:5px 0}
    .meta{margin:4px 0}.meta-row,.total-row,.item-58-calc{display:flex;align-items:flex-start;justify-content:space-between;gap:6px}.meta-row span,.total-row span{flex:1}.meta-row strong,.total-row strong{text-align:right;max-width:62%;overflow-wrap:anywhere}
    .section-title{font-weight:800;margin:4px 0 2px}
    .muted{font-size:${mobilePaper ? '9.5px' : '11px'}}
    table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{padding:3px 1px;vertical-align:top;text-align:left;border:0}th{font-size:${mobilePaper ? '9px' : '10px'};font-weight:800}.item-cell{width:46%}.num{text-align:right;white-space:nowrap}
    .items-58{display:none}.item-58{padding:3px 0}.item-58+.item-58{border-top:1px dashed #999}.item-58-name{font-weight:700}.item-58-calc{margin-top:2px;white-space:nowrap}
    .totals{margin-left:auto;width:${mobilePaper ? '100%' : '78%'}}.total-row{padding:2px 0}.grand{font-size:${mobilePaper ? '13px' : '15px'};font-weight:800}.small{font-size:${mobilePaper ? '9.5px' : '11px'}}
    .notes{margin-top:4px;overflow-wrap:anywhere}.footer{margin-top:5px;text-align:center}.return-policy{margin:5px auto 0;max-height:2.7em;overflow:hidden;font-size:${mobilePaper ? '9px' : '10px'};line-height:1.25}
    .qr-placeholder{display:grid;place-items:center;width:${mobilePaper ? '18mm' : '20mm'};height:${mobilePaper ? '18mm' : '20mm'};margin:6px auto 3px;border:1px dashed #000;font-weight:800;font-size:${mobilePaper ? '12px' : '13px'}}
    .thank-you{font-weight:700;margin-top:4px}.paper-label{font-size:9px;margin-top:3px}
    ${mobilePaper ? '.items-80{display:none}.items-58{display:block}' : '.items-80{display:block}.items-58{display:none}'}
    @media print{.receipt{margin:0}.no-print{display:none!important}}
  </style></head><body><main class="receipt">
    <header class="center">
      <div class="brand">${esc(businessName)}</div>
      ${address ? `<div class="sub wrap">${esc(address)}</div>` : ''}
      ${contact ? `<div class="sub wrap">${esc(contact)}</div>` : ''}
    </header>

    <div class="rule">${characterRule}</div>
    <div class="center bold">${esc(input.kind.toUpperCase())}</div>
    <div class="meta">
      <div class="meta-row"><span>Trans ID</span><strong>${esc(input.number)}</strong></div>
      <div class="meta-row"><span>Date/Time</span><strong>${esc(input.date)} ${esc(printedTime)}</strong></div>
      <div class="meta-row"><span>${esc(input.counterpartyLabel)}</span><strong>${esc(input.counterparty || '—')}</strong></div>
      <div class="meta-row"><span>Currency</span><strong>${esc(input.currency)}</strong></div>
      ${payment}
    </div>

    <div class="rule">${characterRule}</div>
    <div class="section-title">ITEMS</div>
    <div class="items-80"><table><thead><tr><th>SKU / ITEM</th><th class="num">QTY</th><th class="num">UNIT</th><th class="num">TOTAL</th></tr></thead><tbody>${desktopRows}</tbody></table></div>
    <div class="items-58">${mobileRows}</div>

    <div class="rule">${characterRule}</div>
    <div class="totals">
      <div class="total-row"><span>Subtotal</span><strong>${esc(money(input.totalOriginal, input.currency))}</strong></div>
      <div class="total-row"><span>Tax</span><strong>${esc(zeroTax)}</strong></div>
      <div class="total-row grand"><span>GRAND TOTAL</span><strong>${esc(money(input.totalOriginal, input.currency))}</strong></div>
      ${normalized}
    </div>

    ${notes}
    <div class="rule">${characterRule}</div>
    <footer class="footer">
      <div class="return-policy">${esc(returnPolicy)}</div>
      <div class="qr-placeholder" aria-label="QR code placeholder">QR</div>
      <div class="thank-you">${esc(thankYou)}</div>
      <div class="paper-label">${mobilePaper ? '58mm' : '80mm'} thermal receipt</div>
    </footer>
  </main></body></html>`)
  win.document.close()

  // Give the new print document a moment to lay out before opening the native printer dialog.
  setTimeout(() => win.print(), 350)
}
