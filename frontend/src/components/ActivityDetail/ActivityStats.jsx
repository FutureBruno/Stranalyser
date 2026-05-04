import { useMemo } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
} from 'chart.js'
import { Line } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler)

const CHART_OPTIONS_BASE = {
  responsive: true,
  animation: false,
  plugins: { legend: { display: false } },
  interaction: { mode: 'index', intersect: false },
  scales: {
    x: {
      ticks: { maxTicksLimit: 8, font: { size: 11 } },
      grid: { display: false },
    },
    y: { ticks: { font: { size: 11 } } },
  },
}

function buildChart(label, data, color, yLabel, yFormatter) {
  return {
    data: {
      datasets: [
        {
          label,
          data,
          borderColor: color,
          backgroundColor: color + '22',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.3,
          fill: true,
        },
      ],
    },
    options: {
      ...CHART_OPTIONS_BASE,
      scales: {
        ...CHART_OPTIONS_BASE.scales,
        y: {
          ...CHART_OPTIONS_BASE.scales.y,
          title: { display: true, text: yLabel, font: { size: 11 } },
          ticks: { callback: yFormatter, font: { size: 11 } },
        },
      },
    },
  }
}

function ChartCard({ title, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-600 mb-3">{title}</h3>
      {children}
    </div>
  )
}

export default function ActivityStats({ streams, sportType }) {
  const distLabels = useMemo(() => {
    const d = streams?.distance?.data || []
    return d.map((v) => (v / 1000).toFixed(2) + ' km')
  }, [streams])

  const isRide = sportType?.toLowerCase().includes('ride')

  const charts = useMemo(() => {
    const result = []

    // Speed / Pace
    if (streams?.velocity_smooth?.data?.length) {
      const vals = streams.velocity_smooth.data.map((v) =>
        isRide ? +(v * 3.6).toFixed(1) : v > 0 ? +(1000 / v / 60).toFixed(2) : 0
      )
      result.push({
        title: isRide ? 'Geschwindigkeit' : 'Tempo',
        ...buildChart(
          isRide ? 'km/h' : 'min/km',
          vals.map((v, i) => ({ x: distLabels[i], y: v })),
          '#FC4C02',
          isRide ? 'km/h' : 'min/km',
          isRide
            ? (v) => `${v} km/h`
            : (v) => {
                const m = Math.floor(v)
                const s = Math.round((v - m) * 60)
                return `${m}:${String(s).padStart(2, '0')}`
              }
        ),
      })
    }

    // Elevation
    if (streams?.altitude?.data?.length) {
      result.push({
        title: 'Höhenprofil',
        ...buildChart(
          'Höhe (m)',
          streams.altitude.data.map((v, i) => ({ x: distLabels[i], y: Math.round(v) })),
          '#6366f1',
          'm ü. NN',
          (v) => `${v} m`
        ),
      })
    }

    // Heart Rate
    if (streams?.heartrate?.data?.length) {
      result.push({
        title: 'Herzschlag',
        ...buildChart(
          'bpm',
          streams.heartrate.data.map((v, i) => ({ x: distLabels[i], y: Math.round(v) })),
          '#ef4444',
          'bpm',
          (v) => `${v} bpm`
        ),
      })
    }

    // Cadence
    if (streams?.cadence?.data?.length) {
      result.push({
        title: isRide ? 'Trittfrequenz' : 'Schrittfrequenz',
        ...buildChart(
          'rpm',
          streams.cadence.data.map((v, i) => ({ x: distLabels[i], y: Math.round(v) })),
          '#22c55e',
          isRide ? 'rpm' : 'spm',
          (v) => `${v}`
        ),
      })
    }

    return result
  }, [streams, distLabels, isRide])

  if (!charts.length) return null

  const chartOpts = (opts) => ({
    ...opts,
    scales: {
      ...opts.scales,
      x: {
        ...opts.scales.x,
        labels: distLabels,
      },
    },
  })

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {charts.map(({ title, data, options }) => (
        <ChartCard key={title} title={title}>
          <Line data={data} options={chartOpts(options)} />
        </ChartCard>
      ))}
    </div>
  )
}
