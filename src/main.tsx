import React from 'react'
import ReactDOM from 'react-dom/client'
import { ClerkProvider } from '@clerk/clerk-react'
import App, { OfflineApp } from './App.tsx'
import { readIdentity } from './lib/offlineCache'
import { ping } from './lib/scoreOutbox'
import './index.css'

// Get Clerk publishable key from environment variable
const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if (!clerkPubKey) {
  throw new Error('Missing Clerk Publishable Key')
}

// Caches the app shell so the page reopens with no connection.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('/sw.js').catch(() => {})
}

const root = ReactDOM.createRoot(document.getElementById('root')!)
const renderOnline = () =>
  root.render(
    <React.StrictMode>
      <ClerkProvider publishableKey={clerkPubKey}>
        <App />
      </ClerkProvider>
    </React.StrictMode>,
  )
const renderOffline = (user: NonNullable<ReturnType<typeof readIdentity>>) =>
  root.render(
    <React.StrictMode>
      <OfflineApp user={user} />
    </React.StrictMode>,
  )

// Clerk needs the network to restore a session. A jury who signed in on this
// device before gets an offline scoresheet instead of a blank page: at once if
// the browser knows it is offline, or when Clerk is still loading after a while
// AND the API does not answer. Slow-but-working Wi-Fi keeps waiting for sign-in.
const CLERK_GRACE_MS = 8_000
const identity = readIdentity()

if (identity && !navigator.onLine) {
  renderOffline(identity)
} else {
  renderOnline()
  if (identity) {
    const started = Date.now()
    const check = async () => {
      if ((window.Clerk as unknown as { loaded?: boolean } | undefined)?.loaded) return
      // Clerk itself unreachable while the API answers: still give up after 20s.
      if (!navigator.onLine || Date.now() - started > 20_000 || !(await ping())) renderOffline(identity)
      else setTimeout(check, 4_000)
    }
    setTimeout(check, CLERK_GRACE_MS)
  }
}
