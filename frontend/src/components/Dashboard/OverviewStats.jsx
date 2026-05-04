function formatDistance(m) {
  return (m / 1000).toFixed(1) + ' km'
}

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function StatCard({ label, value }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  )
}

export default function OverviewStats({ overview }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <StatCard label="Aktivitäten" value={overview.total_activities} />
      <StatCard label="Gesamtdistanz" value={formatDistance(overview.total_distance)} />
      <StatCard label="Bewegungszeit" value={formatTime(overview.total_moving_time)} />
      <StatCard label="Höhenmeter" value={`${Math.round(overview.total_elevation)} m`} />
    </div>
  )
}
