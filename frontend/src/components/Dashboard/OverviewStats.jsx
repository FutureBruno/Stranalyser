import { useEffect, useState } from 'react'
import { statsApi } from '../../api/client'

function formatDistance(m) {
  return (m / 1000).toFixed(1) + ' km'
}

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function StatCard({ label, value, sub }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

export default function OverviewStats({ days = 7, sportType = '' }) {
  const [overview, setOverview] = useState(null)

  useEffect(() => {
    const params = { days }
    if (sportType) params.sport_type = sportType
    statsApi.overview(params)
      .then(({ data }) => setOverview(data))
      .catch(() => {})
  }, [days, sportType])

  if (!overview) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
            <div className="h-3 bg-gray-200 rounded w-2/3 mb-2" />
            <div className="h-7 bg-gray-200 rounded w-1/2" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <StatCard label="Aktivitäten" value={overview.total_activities} />
      <StatCard label="Distanz" value={formatDistance(overview.total_distance)} />
      <StatCard label="Bewegungszeit" value={formatTime(overview.total_moving_time)} />
      <StatCard label="Höhenmeter" value={`${Math.round(overview.total_elevation)} m`} />
    </div>
  )
}
