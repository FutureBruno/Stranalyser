import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { MapContainer, TileLayer, Polyline, CircleMarker, useMap } from 'react-leaflet'
import { segmentsApi } from '../api/client'

const RUN_TYPES = new Set(['Run', 'TrailRun', 'Walk', 'Hike'])

function formatTime(seconds) {
  if (!seconds) return '–'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatPace(seconds, meters) {
  if (!seconds || !meters) return '–'
  const secPerKm = (seconds / meters) * 1000
  const m = Math.floor(secPerKm / 60)
  const s = Math.round(secPerKm % 60)
  return `${m}:${String(s).padStart(2, '0')} /km`
}

function formatDistance(meters) {
  if (!meters) return '–'
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`
}

function formatDate(iso) {
  if (!iso) return '–'
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function decodePolyline(encoded) {
  const coords = []
  let index = 0, lat = 0, lng = 0
  while (index < encoded.length) {
    let b, shift = 0, result = 0
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5 } while (b >= 0x20)
    lat += (result & 1) ? ~(result >> 1) : result >> 1
    shift = 0; result = 0
    do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5 } while (b >= 0x20)
    lng += (result & 1) ? ~(result >> 1) : result >> 1
    coords.push([lat / 1e5, lng / 1e5])
  }
  return coords
}

function FitBounds({ positions }) {
  const map = useMap()
  useEffect(() => {
    if (positions.length > 0) map.fitBounds(positions, { padding: [16, 16] })
  }, [map, positions])
  return null
}

function SegmentMap({ polyline, startLatlng, endLatlng }) {
  const positions = polyline ? decodePolyline(polyline) : []
  const start = startLatlng ?? positions[0]
  const end = endLatlng ?? (positions.length > 1 ? positions[positions.length - 1] : null)

  const boundsPositions = positions.length > 0
    ? positions
    : [start, end].filter(Boolean)

  const center = positions.length > 0
    ? positions[Math.floor(positions.length / 2)]
    : (start ?? [48.5, 11.5])

  return (
    <MapContainer center={center} zoom={14} style={{ height: '220px', width: '100%' }} scrollWheelZoom={false}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {/* Full polyline if available, else dashed line between start and end */}
      {positions.length > 0 ? (
        <Polyline positions={positions} color="#FC4C02" weight={3} opacity={0.85} />
      ) : (start && end) ? (
        <Polyline positions={[start, end]} color="#FC4C02" weight={2} opacity={0.6}
          dashArray="6 6" />
      ) : null}
      {start && (
        <CircleMarker center={start} radius={7}
          pathOptions={{ color: '#fff', fillColor: '#22c55e', fillOpacity: 1, weight: 2.5 }}>
        </CircleMarker>
      )}
      {end && (
        <CircleMarker center={end} radius={7}
          pathOptions={{ color: '#fff', fillColor: '#ef4444', fillOpacity: 1, weight: 2.5 }} />
      )}
      {boundsPositions.length > 1 && <FitBounds positions={boundsPositions} />}
    </MapContainer>
  )
}

function SegmentCard({ segment }) {
  const [open, setOpen] = useState(false)
  const [showMap, setShowMap] = useState(false)
  const isRun = RUN_TYPES.has(segment.sport_type)
  const hasMap = segment.polyline || segment.start_latlng

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
              {isRun && segment.best_elapsed_time && segment.distance && (
                <span className="text-strava-orange font-medium">
                  {formatPace(segment.best_elapsed_time, segment.distance)}
                </span>
              )}
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
          {hasMap && (
            <div className="px-4 pt-3 pb-1">
              <button
                onClick={() => setShowMap((m) => !m)}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                {showMap ? 'Karte ausblenden' : 'Auf Karte zeigen'}
              </button>
            </div>
          )}

          {showMap && hasMap && (
            <div className="mx-4 mb-3 mt-2 rounded-lg overflow-hidden border border-gray-100">
              <SegmentMap
                polyline={segment.polyline}
                startLatlng={segment.start_latlng}
                endLatlng={segment.end_latlng}
              />
            </div>
          )}

          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <th className="text-left px-4 py-2">#</th>
                <th className="text-left px-4 py-2">Datum</th>
                <th className="text-right px-4 py-2">Zeit</th>
                {isRun && <th className="text-right px-4 py-2">Pace</th>}
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
                  {isRun && (
                    <td className="px-4 py-2 text-right font-mono text-gray-600">
                      {formatPace(effort.elapsed_time, segment.distance)}
                    </td>
                  )}
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
          Noch keine Segmentdaten vorhanden. Klicke auf „{pending} Aktivitäten laden" um die Segmente aus Strava zu holen.
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
