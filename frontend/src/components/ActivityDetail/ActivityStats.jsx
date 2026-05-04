import { useCallback, useEffect, useMemo, useRef } from 'react'
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

// Draws a vertical dashed line at the active index across all charts
const crosshairPlugin = {
  id: 'crosshair',
  afterDraw(chart) {
    const idx = chart.options.plugins?.crosshair?.activeIndex
    if (idx == null) return
    const meta = chart.getDatasetMeta(0)
    const point = meta?.data?.[idx]
    if (!point) return
    const { ctx, chartArea: { top, bottom } } = chart
    ctx.save()
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 3])
    ctx.beginPath()
    ctx.moveTo(point.x, top)
    ctx.lineTo(point.x, bottom)
    ctx.stroke()
    ctx.restore()
  },
}
ChartJS.register(crosshairPlugin)

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtPace(secsPerKm) {
  const m = Math.floor(secsPerKm / 60)
  const s = Math.round(secsPerKm % 60)
  return `${m}:${String(s).padStart(2, '0')} /km`
}

// ── Single linked chart ───────────────────────────────────────────────────────

function LinkedChart({ title, labels, primaryDataset, elevDataset, scaleLeft, activeIndex, onActiveIndex }) {
  const chartRef = useRef(null)

  // Sync tooltip when activeIndex changes from outside (other chart or map)
  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    if (activeIndex == null) {
      chart.tooltip.setActiveElements([], { x: 0, y: 0 })
      chart.update('none')
      return
    }
    const meta = chart.getDatasetMeta(1) // primary dataset is index 1
    const point = meta?.data?.[activeIndex]
    if (!point) return
    chart.tooltip.setActiveElements(
      [
        { datasetIndex: 0, index: activeIndex },
        { datasetIndex: 1, index: activeIndex },
      ],
      { x: point.x, y: point.y }
    )
    chart.update('none')
  }, [activeIndex])

  const handleMouseMove = useCallback(
    (e) => {
      const chart = chartRef.current
      if (!chart) return
      const els = chart.getElementsAtEventForMode(e.nativeEvent, 'index', { intersect: false }, true)
      if (els.length > 0) onActiveIndex(els[0].index)
    },
    [onActiveIndex]
  )

  const handleMouseLeave = useCallback(() => onActiveIndex(null), [onActiveIndex])

  const data = {
    labels,
    datasets: [
      {
        ...elevDataset,
        yAxisID: 'elev',
        order: 2,
      },
      {
        ...primaryDataset,
        yAxisID: 'metric',
        order: 1,
      },
    ],
  }

  const options = {
    responsive: true,
    animation: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: (items) => `${items[0]?.label ?? ''}`,
          label: (item) => {
            if (item.datasetIndex === 0) return `Höhe: ${item.raw} m`
            return `${primaryDataset.label}: ${item.formattedValue}`
          },
        },
      },
      crosshair: { activeIndex },
    },
    scales: {
      x: {
        ticks: { maxTicksLimit: 8, font: { size: 10 } },
        grid: { display: false },
      },
      metric: {
        type: 'linear',
        position: 'left',
        title: { display: true, text: scaleLeft.unit, font: { size: 10 } },
        ticks: { callback: scaleLeft.formatter, font: { size: 10 } },
      },
      elev: {
        type: 'linear',
        position: 'right',
        display: false, // area visible, axis hidden
      },
    },
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-600 mb-3">{title}</h3>
      <div onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
        <Line ref={chartRef} data={data} options={options} />
      </div>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function ActivityStats({ streams, sportType, activeIndex, onActiveIndex }) {
  const isRide = sportType?.toLowerCase().includes('ride')

  const { labels, elevData } = useMemo(() => {
    const dist = streams?.distance?.data ?? []
    const alt = streams?.altitude?.data ?? []
    return {
      labels: dist.map((d) => (d / 1000).toFixed(2) + ' km'),
      elevData: alt.map((v) => Math.round(v)),
    }
  }, [streams])

  const elevDataset = {
    label: 'Höhe',
    data: elevData,
    backgroundColor: 'rgba(99,102,241,0.13)',
    borderColor: 'rgba(99,102,241,0.3)',
    borderWidth: 1,
    fill: true,
    pointRadius: 0,
    tension: 0.3,
  }

  const charts = useMemo(() => {
    const result = []

    // Speed / Pace
    if (streams?.velocity_smooth?.data?.length) {
      const vals = streams.velocity_smooth.data.map((v) => {
        if (isRide) return +(v * 3.6).toFixed(1)
        return v > 0 ? +(1000 / v).toFixed(0) : 0 // secs/km
      })
      result.push({
        title: isRide ? 'Geschwindigkeit' : 'Tempo',
        primary: {
          label: isRide ? 'km/h' : 'min/km',
          data: vals,
          borderColor: '#FC4C02',
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.3,
          fill: false,
        },
        scaleLeft: {
          unit: isRide ? 'km/h' : 'min/km',
          formatter: isRide
            ? (v) => `${v}`
            : (v) => fmtPace(v),
        },
        tooltipFormatter: isRide
          ? (v) => `${v} km/h`
          : (v) => fmtPace(v),
      })
    }

    // Heart Rate
    if (streams?.heartrate?.data?.length) {
      result.push({
        title: 'Herzschlag',
        primary: {
          label: 'bpm',
          data: streams.heartrate.data.map((v) => Math.round(v)),
          borderColor: '#ef4444',
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.3,
          fill: false,
        },
        scaleLeft: { unit: 'bpm', formatter: (v) => `${v}` },
      })
    }

    // Cadence
    if (streams?.cadence?.data?.length) {
      result.push({
        title: isRide ? 'Trittfrequenz' : 'Schrittfrequenz',
        primary: {
          label: isRide ? 'rpm' : 'spm',
          data: streams.cadence.data.map((v) => Math.round(v)),
          borderColor: '#22c55e',
          backgroundColor: 'transparent',
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.3,
          fill: false,
        },
        scaleLeft: { unit: isRide ? 'rpm' : 'spm', formatter: (v) => `${v}` },
      })
    }

    return result
  }, [streams, isRide])

  if (!charts.length || !labels.length) return null

  return (
    <div className="space-y-4">
      {charts.map(({ title, primary, scaleLeft }) => (
        <LinkedChart
          key={title}
          title={title}
          labels={labels}
          primaryDataset={primary}
          elevDataset={elevDataset}
          scaleLeft={scaleLeft}
          activeIndex={activeIndex}
          onActiveIndex={onActiveIndex}
        />
      ))}
    </div>
  )
}
