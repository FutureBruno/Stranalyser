import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { segmentsApi } from '../api/client'

function formatTime(seconds) {
  if (!seconds) return '–'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatDistance(meters) {
  if (!meters) return '–'
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`
}

function formatDate(iso) {
  if (!iso) return '–'
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function SegmentCard({ segment }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-4 min-w-0">
          <div className="min-w-0">
            <div className="font-medium text-gray-900 truncate">{segment.segment_name}</div>
            <div className="text-xs text-gray-500 flex items-center gap-3 mt-0.5">
              <span>{formatDistance(segment.distance)}</span>
              <span>Bestzeit: <span className="font-medium text-gray-700">{formatTime(segment.best_elapsed_time)}</span></span>
              {segment.avg_elapsed_time && (
                <span>Ø {formatTime(segment.avg_elapsed_time)}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 ml-4 shrink-0">
          <span className="text-sm font-semibold text-strava-orange">
            {segment.effort_count}× absolviert
          </span>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <th className="text-left px-4 py-2">#</th>
                <th className="text-left px-4 py-2">Datum</th>
                <th className="text-right px-4 py-2">Zeit</th>
                {segment.efforts.some(e => e.average_heartrate) && (
                  <th className="text-right px-4 py-2">Ø HR</th>
                )}
                {segment.efforts.some(e => e.average_watts) && (
                  <th className="text-right px-4 py-2">Ø Watt</th>
                )}
                <th className="text-center px-4 py-2">PR</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {segment.efforts.map((effort, idx) => (
                <tr key={effort.effort_id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-400 text-xs">{idx + 1}</td>
                  <td className="px-4 py-2 text-gray-600">{formatDate(effort.start_date_local)}</td>
                  <td className="px-4 py-2 text-right font-mono font-medium">
                    {idx === 0
                      ? <span className="text-strava-orange">{formatTime(effort.elapsed_time)}</span>
                      : formatTime(effort.elapsed_time)
                    }
                  </td>
                  {segment.efforts.some(e => e.average_heartrate) && (
                    <td className="px-4 py-2 text-right text-gray-600">
                      {effort.average_heartrate ? `${Math.round(effort.average_heartrate)} bpm` : '–'}
                    </td>
                  )}
                  {segment.efforts.some(e => e.average_watts) && (
                    <td className="px-4 py-2 text-right text-gray-600">
                      {effort.average_watts ? `${Math.round(effort.average_watts)} W` : '–'}
                    </td>
                  )}
                  <td className="px-4 py-2 text-center">
                    {effort.pr_rank === 1 && (
                      <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-medium">PR</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      to={`/activities/${effort.activity_id}`}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Aktivität →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function SegmentsPage() {
  const [segments, setSegments] = useState([])
  const [sportTypes, setSportTypes] = useState([])
  const [activeSport, setActiveSport] = useState(null)
  const [fetchStatus, setFetchStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)

  const load = useCallback(async (sport) => {
    setLoading(true)
    try {
      const { data } = await segmentsApi.list(sport ? { sport_type: sport } : {})
      setSegments(data.segments)
      setFetchStatus(data.fetch_status)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    segmentsApi.sportTypes().then(({ data }) => setSportTypes(data.sport_types)).catch(() => {})
    load(null)
  }, [load])

  useEffect(() => {
    load(activeSport)
  }, [activeSport, load])

  const handleFetch = async () => {
    setFetching(true)
    try {
      await segmentsApi.triggerFetch()
      setTimeout(() => load(activeSport), 2000)
    } finally {
      setFetching(false)
    }
  }

  const pending = fetchStatus?.pending ?? 0
  const total = fetchStatus?.total ?? 0
  const fetched = fetchStatus?.fetched ?? 0

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Segmente</h1>
          {fetchStatus && (
            <p className="text-sm text-gray-500 mt-1">
              {fetched} von {total} Aktivitäten analysiert
              {pending > 0 && ` · ${pending} ausstehend`}
            </p>
          )}
        </div>
        {pending > 0 && (
          <button
            onClick={handleFetch}
            disabled={fetching}
            className="px-4 py-2 bg-strava-orange text-white text-sm rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {fetching ? 'Wird gestartet…' : `${pending} Aktivitäten laden`}
          </button>
        )}
      </div>

      {fetchStatus && fetched === 0 && pending > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
          Noch keine Segmentdaten vorhanden. Klicke auf „{pending} Aktivitäten laden“ um die Segmente aus Strava zu holen.
          Das dauert je nach Anzahl der Aktivitäten einige Minuten (Strava Rate Limit: 1 Anfrage/Sek).
        </div>
      )}

      {sportTypes.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setActiveSport(null)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeSport === null
                ? 'bg-strava-orange text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Alle
          </button>
          {sportTypes.map((st) => (
            <button
              key={st}
              onClick={() => setActiveSport(st)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeSport === st
                  ? 'bg-strava-orange text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-strava-orange" />
        </div>
      ) : segments.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          {fetched === 0
            ? 'Lade zuerst die Segmentdaten.'
            : 'Keine Segmente gefunden.'}
        </div>
      ) : (
        <div className="space-y-2">
          {segments.map((seg) => (
            <SegmentCard key={seg.segment_id} segment={seg} />
          ))}
        </div>
      )}
    </div>
  )
}
