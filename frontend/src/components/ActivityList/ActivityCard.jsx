import { Link } from 'react-router-dom'

const SPORT_ICONS = {
  Run: '🏃',
  Ride: '🚴',
  MountainBikeRide: '🚵',
  GravelRide: '🚴',
  EBikeRide: '🚴',
  EMountainBikeRide: '🚵',
  Swim: '🏊',
  Hike: '🥾',
  Walk: '🚶',
  VirtualRide: '🚴',
  TrailRun: '🏔️',
  WeightTraining: '🏋️',
  Yoga: '🧘',
}

const SPORT_LABELS = {
  MountainBikeRide: 'Radfahren',
  GravelRide: 'Radfahren',
  EBikeRide: 'Radfahren',
  EMountainBikeRide: 'Radfahren',
  Ride: 'Radfahren',
  VirtualRide: 'Virtual Ride',
  Run: 'Laufen',
  TrailRun: 'Trail Run',
  Swim: 'Schwimmen',
  Hike: 'Wandern',
  Walk: 'Gehen',
}

function formatDistance(m) {
  if (!m) return '–'
  return (m / 1000).toFixed(2) + ' km'
}

function formatPace(speed, sportType) {
  if (!speed || speed === 0) return '–'
  if (sportType?.includes('Ride') || sportType === 'VirtualRide') {
    return (speed * 3.6).toFixed(1) + ' km/h'
  }
  const secsPerKm = 1000 / speed
  const m = Math.floor(secsPerKm / 60)
  const s = Math.round(secsPerKm % 60)
  return `${m}:${s.toString().padStart(2, '0')} /km`
}

function formatTime(seconds) {
  if (!seconds) return '–'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export default function ActivityCard({ activity }) {
  const icon = SPORT_ICONS[activity.sport_type] || '🏅'
  const label = SPORT_LABELS[activity.sport_type] || activity.sport_type

  return (
    <Link
      to={`/activities/${activity.id}`}
      className="block bg-white rounded-xl border border-gray-200 p-4 hover:border-strava-orange hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <span className="text-2xl mt-0.5">{icon}</span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 truncate">{activity.name || 'Aktivität'}</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {label} · {formatDate(activity.start_date_local || activity.start_date)}
            </p>
          </div>
        </div>

        <div className="flex gap-6 text-right shrink-0">
          <div>
            <p className="text-sm font-semibold">{formatDistance(activity.distance)}</p>
            <p className="text-xs text-gray-400">Distanz</p>
          </div>
          <div>
            <p className="text-sm font-semibold">{formatTime(activity.moving_time)}</p>
            <p className="text-xs text-gray-400">Zeit</p>
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-semibold">{formatPace(activity.average_speed, activity.sport_type)}</p>
            <p className="text-xs text-gray-400">Tempo</p>
          </div>
          {activity.total_elevation_gain > 0 && (
            <div className="hidden md:block">
              <p className="text-sm font-semibold">{Math.round(activity.total_elevation_gain)} m</p>
              <p className="text-xs text-gray-400">Höhe</p>
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}
