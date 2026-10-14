import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/AppShell'
import { Loading } from '@/components/Loading'
import { RealtimeSync } from '@/components/RealtimeSync'
import { useAuth } from '@/context/AuthContext'
import { LoginPage } from '@/pages/LoginPage'
import { PasswordSetupPage } from '@/pages/PasswordSetupPage'
import { PublicInfoPage } from '@/pages/PublicInfoPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { ProductsPage } from '@/pages/ProductsPage'
import { PurchasesPage } from '@/pages/PurchasesPage'
import { SalesPage } from '@/pages/SalesPage'
import { InventoryPage } from '@/pages/InventoryPage'
import { ReportsPage } from '@/pages/ReportsPage'
import { UsersPage } from '@/pages/UsersPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { ActivityLogPage } from '@/pages/ActivityLogPage'
import { SuppliersPage } from '@/pages/SuppliersPage'
import { CustomersPage } from '@/pages/CustomersPage'
import { AlertsPage } from '@/pages/AlertsPage'

function ProfileRecovery() {
  const { profileError, refreshProfile, signOut } = useAuth()
  return <div className="grid min-h-screen place-items-center bg-slate-950 p-6">
    <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-white p-8 shadow-2xl">
      <div className="text-xs font-bold uppercase tracking-[.18em] text-emerald-700">StockPilot workspace</div>
      <h1 className="mt-2 text-2xl font-bold text-slate-950">We could not load your workspace profile</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">Your sign-in session is valid, but StockPilot could not establish your role and workspace permissions. No operational data has been changed.</p>
      {profileError && <div className="mt-4 rounded-xl bg-slate-100 p-3 text-xs text-slate-600">{profileError}</div>}
      <div className="mt-6 flex flex-wrap gap-3">
        <button onClick={() => void refreshProfile()} className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800">Retry</button>
        <button onClick={() => void signOut()} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Sign out</button>
      </div>
    </div>
  </div>
}

function Protected() {
  const { session, profile, loading } = useAuth()
  if (loading) return <Loading />
  if (!session) return <Navigate to="/login" replace />
  if (!profile) return <ProfileRecovery />
  return <><RealtimeSync /><AppShell /></>
}

export default function App() {
  return <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/reset-password" element={<PasswordSetupPage />} />
    <Route path="/info/:page" element={<PublicInfoPage />} />
    <Route element={<Protected />}>
      <Route index element={<DashboardPage />} />
      <Route path="alerts" element={<AlertsPage />} />
      <Route path="products" element={<ProductsPage />} />
      <Route path="suppliers" element={<SuppliersPage />} />
      <Route path="customers" element={<CustomersPage />} />
      <Route path="purchases" element={<PurchasesPage />} />
      <Route path="sales" element={<SalesPage />} />
      <Route path="inventory" element={<InventoryPage />} />
      <Route path="reports" element={<ReportsPage />} />
      <Route path="users" element={<UsersPage />} />
      <Route path="activity" element={<ActivityLogPage />} />
      <Route path="settings" element={<SettingsPage />} />
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
}
