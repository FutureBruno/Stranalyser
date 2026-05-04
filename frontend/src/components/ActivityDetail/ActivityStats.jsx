import { useMemo } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { Line } from 'react-chartjs-2'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler)

function buildDataset(label, data, color, fill = false) {
  return {
    label,
    data,
    borderColor: color,
    backgroundColor: fill ? color + '33' : 'transparent',
    borderWidth: 2,
    pointRadius: 0,
    tension: 0.3,
    fill,
  }
}

export default function ActivityStats({ streams, sportType }) {
  const { labels, datasets } = useMemo(() => {
    const distData = streams?.distance?.data || []
    const labels = distData.map((d) => (d / 1000).toFixed(2))

    const ds = []

    if (streams?.altitude?.data) {
      ds.push(buildDataset('Höhe (m)', streams.altitude.data, '#6366f1', true))
    }
    if (streams?.heartrate?.data) {
      ds.push(buildDataset('Puls (bpm)', streams.heartrate.data, '#ef4444'))
    }
    if (streams?.velocity_smooth?.data) {
      const isRide = sportType?.includes('Ride')
      const converted = streams.velocity_smooth.data.map((v) =>
        isRide ? +(v * 3.6).toFixed(1) : +(1000 / v / 60).toFixed(2)
      )
      ds.push(buildDataset(isRide ? 'Geschwindigkeit (km/h)' : 'Pace (min/km)', converted, '#FC4C02'))
    }
    if (streams?.cadence?.data) {
      ds.push(buildDataset('Kadenz', streams.cadence.data, '#22c55e'))
    }

    return { labels, datasets: ds }
  }, [streams, sportType])

  if (!datasets.length) return null

  const options = {
    responsive: true,
    animation: false,
    plugins: {
      legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } },
    },
    scales: {
      x: {
        ticks: {
          maxTicksLimit: 10,
          callback: (_, i) => labels[i] ? labels[i] + ' km' : '',
        },
      },
    },
    interaction: {
      mode: 'index',
      intersect: false,
    },
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="font-semibold text-gray-700 mb-4">Verlauf</h2>
      <Line data={{ labels, datasets }} options={options} />
    </div>
  )
}
