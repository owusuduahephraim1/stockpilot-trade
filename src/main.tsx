import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { AppErrorBoundary } from '@/components/AppErrorBoundary'
import { AuthProvider } from '@/context/AuthContext'
import './styles.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 600_000,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      throwOnError: true,
    },
    mutations: { retry: 0 },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <HashRouter>
          <AuthProvider><App /></AuthProvider>
        </HashRouter>
      </QueryClientProvider>
    </AppErrorBoundary>
  </React.StrictMode>,
)
