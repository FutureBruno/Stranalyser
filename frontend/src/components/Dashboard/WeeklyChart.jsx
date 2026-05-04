import { useEffect, useState } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js'
import { Bar } from 'react-chartjs-2'
import { statsApi } from '../../api/client'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

export default function WeeklyChart() {
  const [data, setData] = useState([])

  useEffect(() => {
    statsApi.weekly({ weeks: 12 })
      .then(({ data }) => setData(data))
      .catch(() => {})
  }, [])

  if (!data.length) return <p className="text-gray-400 text-sm">Keine Daten</p>

  const labels = data.map((d) => {
    const date = new Date(d.week)
    return `KW ${date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}`
  })

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
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { callback: (v) => `${v} km` },
      },
    },
  }

  return <Bar data={chartData} options={options} />
}
