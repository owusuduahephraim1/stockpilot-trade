import { Boxes, ChevronLeft, CircleHelp, FileText, Info, LockKeyhole } from 'lucide-react'
import { Link, Navigate, useParams } from 'react-router-dom'

type InfoKey='about'|'support'|'privacy'|'terms'

const pages:Record<InfoKey,{title:string;eyebrow:string;icon:typeof Info;content:React.ReactNode}>={
 about:{
  title:'About StockPilot',eyebrow:'Product information',icon:Info,
  content:<>
   <p>StockPilot is an operational inventory workspace for managing products, purchases, sales, customers, suppliers, stock position, alerts, activity history, and business reporting from one system.</p>
   <p>It is designed for controlled business use, with role-based Owner/Admin and Staff/Operator access, real-time stock visibility, transaction history, and private document handling.</p>
   <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><div className="font-semibold text-emerald-950">Developer & publisher</div><div className="mt-1 text-sm leading-6 text-emerald-900">StockPilot™ is developed and maintained by <strong>Nana K IT Solutions Consult</strong>.</div><div className="mt-2 text-xs text-emerald-800">© 2026 Nana K IT Solutions Consult. All rights reserved.</div></div>
   <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="font-semibold text-slate-900">Current production release</div><div className="mt-1 text-sm text-slate-600">StockPilot Inventory v1.10.3</div></div>
  </>
 },
 support:{
  title:'Support',eyebrow:'Help and access',icon:CircleHelp,
  content:<>
   <p>For account creation, password access, role changes, or a disabled account, contact your StockPilot Owner/Admin. Workspace accounts are provisioned and managed inside User Management.</p>
   <p>For product or technical support, contact <strong>Nana K IT Solutions Consult</strong> through the authorised support channel used by your organisation. If you are reporting a technical problem, include what you were doing, the exact message shown, the approximate time it happened, and the device or browser being used. A screenshot is useful when available.</p>
   <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950"><div className="font-semibold">Protect your account</div><div className="mt-1 text-sm leading-6">Never share your password, authentication session, or private business documents with an unauthorised person.</div></div>
  </>
 },
 privacy:{
  title:'Privacy',eyebrow:'Data handling',icon:LockKeyhole,
  content:<>
   <p>StockPilot processes the business and account information required to operate the workspace, including user profile details, inventory records, purchases, sales, customers, suppliers, settings, operational activity, and documents uploaded by authorised users.</p>
   <p>Operational application data is protected by authenticated access controls and row-level security. Private transaction documents are stored separately and opened through short-lived authorised access links.</p>
   <p>Access is limited according to the user role and workspace membership. Users should only enter information they are authorised to process for the business.</p>
   <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">If your organisation has additional privacy, retention, or regulatory requirements, the Owner/Admin is responsible for applying those operating requirements to use of the workspace.</div>
  </>
 },
 terms:{
  title:'Terms of Use',eyebrow:'Authorised use',icon:FileText,
  content:<>
   <p>StockPilot is provided for authorised business operations. By using the workspace, you agree to use your own assigned account, keep your credentials secure, and access or modify only information you are permitted to handle.</p>
   <p>Users are responsible for entering accurate transaction information and reviewing business records before relying on them for operational or financial decisions. Attempts to bypass access controls, interfere with system operation, or access another user&apos;s account are prohibited.</p>
   <p>The Owner/Admin controls workspace membership, roles, account status, and operational use within the organisation.</p>
   <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-950"><div className="font-semibold">Ownership and attribution</div><div className="mt-1">StockPilot™ is developed and maintained by Nana K IT Solutions Consult. The StockPilot application, original interface design, original source code, documentation, branding, and related materials are proprietary to Nana K IT Solutions Consult, except for third-party components and open-source software governed by their respective licences.</div><div className="mt-2">© 2026 Nana K IT Solutions Consult. All rights reserved.</div></div>
   <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">These product terms describe acceptable StockPilot workspace use and do not replace any separate legal, employment, commercial, licensing, or regulatory obligations that apply to your organisation.</div>
  </>
 }
}

export function PublicInfoPage(){
 const {page}=useParams<{page:string}>()
 const info=page&&page in pages?pages[page as InfoKey]:null
 if(!info)return <Navigate to="/login" replace/>
 const Icon=info.icon
 return <main className="min-h-screen bg-slate-950 p-4 text-slate-950 sm:p-8">
  <section className="mx-auto min-h-[calc(100vh-2rem)] max-w-3xl overflow-hidden rounded-3xl border border-slate-800 bg-white shadow-2xl">
   <div className="border-b border-slate-100 px-6 py-5 sm:px-10"><div className="flex items-center justify-between gap-4"><div className="flex items-center gap-2 text-lg font-bold"><Boxes className="h-5 w-5"/>StockPilot™</div><Link to="/login" className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 hover:text-emerald-800"><ChevronLeft className="h-4 w-4"/>Sign in</Link></div></div>
   <div className="px-6 py-10 sm:px-10 sm:py-14"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><Icon className="h-5 w-5"/></div><div className="mt-5 text-xs font-bold uppercase tracking-[.18em] text-emerald-700">{info.eyebrow}</div><h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">{info.title}</h1><div className="mt-7 space-y-5 text-[15px] leading-7 text-slate-600">{info.content}</div><div className="mt-10 border-t border-slate-100 pt-5 text-xs leading-5 text-slate-400"><div>Last updated 4 September 2026 · StockPilot™ Inventory v1.10.3</div><div>Developed by Nana K IT Solutions Consult</div></div></div>
  </section>
 </main>
}
