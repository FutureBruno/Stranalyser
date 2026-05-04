const SPORT_TYPES = [
  { value: '', label: 'Alle' },
  { value: 'Run', label: 'Laufen' },
  { value: 'Ride', label: 'Radfahren' },
  { value: 'Swim', label: 'Schwimmen' },
  { value: 'Hike', label: 'Wandern' },
  { value: 'Walk', label: 'Gehen' },
  { value: 'VirtualRide', label: 'Virtual Ride' },
  { value: 'TrailRun', label: 'Trail Run' },
]

export default function FilterBar({ onFilter }) {
  return (
    <div className="flex flex-wrap gap-2">
      {SPORT_TYPES.map((t) => (
        <button
          key={t.value}
          onClick={() => onFilter({ sport_type: t.value })}
          className="px-3 py-1.5 text-sm rounded-full border border-gray-300 hover:bg-strava-orange hover:text-white hover:border-strava-orange transition-colors"
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}
