import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { statsApi } from '../api/client'
import WeeklyChart from '../components/Dashboard/WeeklyChart'
import OverviewStats from '../components/Dashboard/OverviewStats'

export default function DashboardPage() {
  const [overview, setOverview] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    statsApi.overview()
      .then(({ data }) => setOverview(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-strava-orange" />
      </div>
    )
  }

  if (!overview || overview.total_activities === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 text-lg mb-4">Noch keine Aktivitäten synchronisiert.</p>
        <p className="text-sm text-gray-400">
          Klicke auf <strong>Sync</strong> in der Navigation, um deine Strava-Aktivitäten zu laden.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Link to="/activities" className="text-sm text-strava-orange hover:underline">
          Alle Aktivitäten →
        </Link>
      </div>

      <OverviewStats overview={overview} />

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-700 mb-4">Wöchentliche Distanz (letzte 12 Wochen)</h2>
        <WeeklyChart />
      </div>
    </div>
  )
}
