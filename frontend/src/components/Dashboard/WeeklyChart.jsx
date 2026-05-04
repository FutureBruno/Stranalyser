import { useEffect, useState } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
} from 'chart.js'
import { Bar } from 'react-chartjs-2'
import { statsApi } from '../../api/client'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip)

function formatLabel(bucket, days) {
  if (!bucket) return ''
  const d = new Date(bucket)
  if (days <= 31) {
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
  }
  return `KW ${d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}`
}

export default function WeeklyChart({ days = 7, sportType = '' }) {
  const [data, setData] = useState([])

  useEffect(() => {
    const params = { days }
    if (sportType) params.sport_type = sportType
    statsApi.weekly(params)
      .then(({ data }) => setData(data))
      .catch(() => {})
  }, [days, sportType])

  if (!data.length) {
    return <p className="text-gray-400 text-sm text-center py-4">Keine Aktivitäten im gewählten Zeitraum</p>
  }

  const labels = data.map((d) => formatLabel(d.bucket, days))

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Distanz (km)',
        data: data.map((d) => +(d.distance / 1000).toFixed(1)),
        backgroundColor: '#FC4C02',
        borderRadius: 4,
      },
    ],
  }

  const options = {
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.raw} km`,
          afterLabel: (ctx) => {
            const row = data[ctx.dataIndex]
            const h = Math.floor(row.moving_time / 3600)
            const m = Math.floor((row.moving_time % 3600) / 60)
            const time = h > 0 ? `${h}h ${m}m` : `${m}m`
            return [`${row.count} Aktivität(en)`, `Zeit: ${time}`, `Höhe: ${Math.round(row.elevation)} m`]
          },
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { callback: (v) => `${v} km` },
      },
      x: { grid: { display: false } },
    },
  }

  return <Bar data={chartData} options={options} />
}
