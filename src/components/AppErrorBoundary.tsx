import React, { type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { failed: boolean }

export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('StockPilot application error', error, info)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return <div className="grid min-h-screen place-items-center bg-slate-950 p-6">
      <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-2xl">
        <div className="text-xs font-bold uppercase tracking-[.18em] text-emerald-700">StockPilot recovery</div>
        <h1 className="mt-2 text-2xl font-bold text-slate-950">The workspace could not finish rendering</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">Your saved operational data is not affected. Reload the application to restore the workspace. If the problem repeats, capture the screen and report the action that caused it.</p>
        <button onClick={() => window.location.reload()} className="mt-6 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800">Reload StockPilot</button>
      </div>
    </div>
  }
}
