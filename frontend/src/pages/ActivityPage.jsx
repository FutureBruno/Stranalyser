import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { activitiesApi } from '../api/client'
import ActivityMap from '../components/ActivityDetail/ActivityMap'
import ActivityStats from '../components/ActivityDetail/ActivityStats'

function formatDistance(m) {
  if (!m) return '–'
  return (m / 1000).toFixed(2) + ' km'
}

function formatTime(seconds) {
  if (!seconds) return '–'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatPace(speed, sportType) {
  if (!speed || speed === 0) return '–'
  if (sportType?.toLowerCase().includes('ride')) return (speed * 3.6).toFixed(1) + ' km/h'
  const secsPerKm = 1000 / speed
  const m = Math.floor(secsPerKm / 60)
  const s = Math.round(secsPerKm % 60)
  return `${m}:${s.toString().padStart(2, '0')} /km`
}

function StatBox({ label, value }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 text-center">
      <p className="text-lg font-bold">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  )
}

export default function ActivityPage() {
  const { id } = useParams()
  const [activity, setActivity] = useState(null)
  const [streams, setStreams] = useState(null)
  const [loading, setLoading] = useState(true)
  const [activeIndex, setActiveIndex] = useState(null)

  const handleActiveIndex = useCallback((idx) => setActiveIndex(idx), [])

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await activitiesApi.get(id)
        setActivity(data)
        activitiesApi.streams(id)
          .then(({ data: s }) => setStreams(s))
          .catch(() => {})
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-strava-orange" />
      </div>
    )
  }

  if (!activity) {
    return (
      <div className="text-center py-20 text-gray-400">
        Aktivität nicht gefunden.{' '}
        <Link to="/activities" className="text-strava-orange">Zurück</Link>
      </div>
    )
  }

  const date = activity.start_date_local
    ? new Date(activity.start_date_local).toLocaleDateString('de-DE', {
        weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
      })
    : ''

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/activities" className="text-gray-400 hover:text-gray-600 text-lg">←</Link>
        <div>
          <h1 className="text-2xl font-bold">{activity.name}</h1>
          <p className="text-sm text-gray-500">{activity.sport_type} · {date}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatBox label="Distanz" value={formatDistance(activity.distance)} />
        <StatBox label="Zeit" value={formatTime(activity.moving_time)} />
        <StatBox label="Tempo" value={formatPace(activity.average_speed, activity.sport_type)} />
        <StatBox label="Höhenmeter" value={activity.total_elevation_gain ? Math.round(activity.total_elevation_gain) + ' m' : '–'} />
        {activity.average_heartrate && (
          <StatBox label="Ø Puls" value={Math.round(activity.average_heartrate) + ' bpm'} />
        )}
        {activity.max_heartrate && (
          <StatBox label="Max Puls" value={Math.round(activity.max_heartrate) + ' bpm'} />
        )}
        {activity.suffer_score && (
          <StatBox label="Suffer Score" value={activity.suffer_score} />
        )}
        {activity.kudos_count !== undefined && (
          <StatBox label="Kudos" value={activity.kudos_count} />
        )}
      </div>

      {activity.description && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-700">{activity.description}</p>
        </div>
      )}

      {activity.polyline && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden" style={{ height: '380px' }}>
          <ActivityMap
            polyline={activity.polyline}
            streams={streams}
            activeIndex={activeIndex}
          />
        </div>
      )}

      {streams && (
        <ActivityStats
          streams={streams}
          sportType={activity.sport_type}
          activeIndex={activeIndex}
          onActiveIndex={handleActiveIndex}
        />
      )}
    </div>
  )
}
