import { useEffect, useState, useCallback } from 'react'
import { activitiesApi } from '../api/client'
import ActivityCard from '../components/ActivityList/ActivityCard'
import FilterBar from '../components/ActivityList/FilterBar'

export default function ActivitiesPage() {
  const [activities, setActivities] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ sport_type: '', per_page: 20 })

  const load = useCallback(async (p = 1, f = filters) => {
    setLoading(true)
    try {
      const params = { page: p, per_page: f.per_page }
      if (f.sport_type) params.sport_type = f.sport_type
      const { data } = await activitiesApi.list(params)
      setActivities(data.items)
      setTotal(data.total)
      setPages(data.pages)
      setPage(p)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    load(1, filters)
  }, [filters])

  const handleFilter = (newFilters) => {
    setFilters((prev) => ({ ...prev, ...newFilters }))
    setPage(1)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Aktivitäten</h1>
        <span className="text-sm text-gray-500">{total} gesamt</span>
      </div>

      <FilterBar onFilter={handleFilter} />

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-strava-orange" />
        </div>
      ) : activities.length === 0 ? (
        <div className="text-center py-16 text-gray-400">Keine Aktivitäten gefunden</div>
      ) : (
        <div className="space-y-3">
          {activities.map((a) => (
            <ActivityCard key={a.id} activity={a} />
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="flex justify-center gap-2 pt-4">
          <button
            disabled={page <= 1}
            onClick={() => load(page - 1)}
            className="px-4 py-2 rounded-lg border border-gray-300 disabled:opacity-40 hover:bg-gray-100"
          >
            ← Zurück
          </button>
          <span className="px-4 py-2 text-sm text-gray-500">
            Seite {page} / {pages}
          </span>
          <button
            disabled={page >= pages}
            onClick={() => load(page + 1)}
            className="px-4 py-2 rounded-lg border border-gray-300 disabled:opacity-40 hover:bg-gray-100"
          >
            Weiter →
          </button>
        </div>
      )}
    </div>
  )
}
