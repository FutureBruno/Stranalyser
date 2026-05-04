import { useState } from 'react'
import { Link } from 'react-router-dom'
import WeeklyChart from '../components/Dashboard/WeeklyChart'
import OverviewStats from '../components/Dashboard/OverviewStats'
import WeeklyReport from '../components/Dashboard/WeeklyReport'

const TIME_OPTIONS = [
  { label: '7 Tage', days: 7 },
  { label: '30 Tage', days: 30 },
  { label: '90 Tage', days: 90 },
  { label: '1 Jahr', days: 365 },
]

const SPORT_OPTIONS = [
  { label: 'Alle', value: '' },
  { label: 'Laufen', value: 'Run' },
  { label: 'Radfahren', value: 'Ride' },
  { label: 'Schwimmen', value: 'Swim' },
  { label: 'Wandern', value: 'Hike' },
  { label: 'Gehen', value: 'Walk' },
  { label: 'Virtual Ride', value: 'VirtualRide' },
  { label: 'Trail Run', value: 'TrailRun' },
]

function ToggleGroup({ options, value, onChange, keyProp, labelProp }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const val = opt[keyProp]
        const active = val === value
        return (
          <button
            key={val}
            onClick={() => onChange(val)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
              active
                ? 'bg-strava-orange text-white border-strava-orange'
                : 'bg-white text-gray-600 border-gray-300 hover:border-strava-orange hover:text-strava-orange'
            }`}
          >
            {opt[labelProp]}
          </button>
        )
      })}
    </div>
  )
}

export default function DashboardPage() {
  const [days, setDays] = useState(7)
  const [sportType, setSportType] = useState('')

  const chartLabel = days <= 31 ? 'Tägliche Distanz' : 'Wöchentliche Distanz'

  return (
    <div className="space-y-5">
      {/* Header + Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Link to="/activities" className="text-sm text-strava-orange hover:underline self-start sm:self-auto">
          Alle Aktivitäten →
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-4">
          <div>
            <p className="text-xs text-gray-500 mb-1.5 uppercase tracking-wide">Zeitraum</p>
            <ToggleGroup
              options={TIME_OPTIONS}
              value={days}
              onChange={(v) => setDays(v)}
              keyProp="days"
              labelProp="label"
            />
          </div>
          <div className="sm:border-l sm:border-gray-200 sm:pl-4">
            <p className="text-xs text-gray-500 mb-1.5 uppercase tracking-wide">Sportart</p>
            <ToggleGroup
              options={SPORT_OPTIONS}
              value={sportType}
              onChange={(v) => setSportType(v)}
              keyProp="value"
              labelProp="label"
            />
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <OverviewStats days={days} sportType={sportType} />

      {/* Chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="font-semibold text-gray-700 mb-4">
          {chartLabel}
          <span className="text-sm font-normal text-gray-400 ml-2">
            (letzte {days} Tage{sportType ? ` · ${SPORT_OPTIONS.find((o) => o.value === sportType)?.label}` : ''})
          </span>
        </h2>
        <WeeklyChart days={days} sportType={sportType} />
      </div>

      {/* AI Weekly Report */}
      <WeeklyReport />
    </div>
  )
}
