import { Link, NavLink } from 'react-router-dom'
import { useState, useEffect } from 'react'
import useAuthStore from '../../store/authStore'
import { syncApi } from '../../api/client'

export default function Header() {
  const { athlete, logout } = useAuthStore()
  const [syncStatus, setSyncStatus] = useState(null)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await syncApi.status()
        setSyncStatus(data)
      } catch {
        // ignore
      }
    }
    load()
    const interval = setInterval(load, 15000)
    return () => clearInterval(interval)
  }, [])

  const handleSync = async () => {
    setSyncing(true)
    try {
      await syncApi.trigger()
      setSyncStatus((s) => ({ ...s, status: 'running' }))
    } finally {
      setSyncing(false)
    }
  }

  const navClass = ({ isActive }) =>
    `text-sm font-medium px-3 py-1 rounded transition-colors ${
      isActive ? 'text-strava-orange' : 'text-gray-600 hover:text-gray-900'
    }`

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link to="/" className="font-bold text-xl text-strava-orange tracking-tight">
            Stranalyser
          </Link>
          <nav className="flex items-center gap-1">
            <NavLink to="/" end className={navClass}>
              Dashboard
            </NavLink>
            <NavLink to="/activities" className={navClass}>
              Aktivitäten
            </NavLink>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {syncStatus && (
            <span className="text-xs text-gray-500">
              {syncStatus.status === 'running' ? (
                <span className="text-amber-500 flex items-center gap-1">
                  <span className="inline-block w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                  Synchronisiert…
                </span>
              ) : syncStatus.activities_synced > 0 ? (
                `${syncStatus.activities_synced} Aktivitäten`
              ) : null}
            </span>
          )}

          <button
            onClick={handleSync}
            disabled={syncing || syncStatus?.status === 'running'}
            className="text-xs px-3 py-1.5 rounded-full border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Sync
          </button>

          {athlete && (
            <div className="flex items-center gap-2">
              {athlete.profile_medium && (
                <img
                  src={athlete.profile_medium}
                  alt={athlete.firstname}
                  className="w-8 h-8 rounded-full object-cover"
                />
              )}
              <span className="text-sm text-gray-700 hidden sm:inline">
                {athlete.firstname} {athlete.lastname}
              </span>
              <button
                onClick={logout}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Abmelden
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
