import { useEffect, useRef, useMemo } from 'react'
import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet'

function decodePolyline(encoded) {
  const coords = []
  let index = 0, lat = 0, lng = 0

  while (index < encoded.length) {
    let b, shift = 0, result = 0
    do {
      b = encoded.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    const dlat = (result & 1) ? ~(result >> 1) : (result >> 1)
    lat += dlat

    shift = 0
    result = 0
    do {
      b = encoded.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    const dlng = (result & 1) ? ~(result >> 1) : (result >> 1)
    lng += dlng

    coords.push([lat / 1e5, lng / 1e5])
  }
  return coords
}

function FitBounds({ positions }) {
  const map = useMap()
  useEffect(() => {
    if (positions.length > 0) {
      map.fitBounds(positions, { padding: [20, 20] })
    }
  }, [map, positions])
  return null
}

export default function ActivityMap({ polyline, streams }) {
  const positions = useMemo(() => {
    if (streams?.latlng?.data?.length > 0) {
      return streams.latlng.data
    }
    if (polyline) {
      return decodePolyline(polyline)
    }
    return []
  }, [polyline, streams])

  if (positions.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        Keine Kartendaten verfügbar
      </div>
    )
  }

  const center = positions[Math.floor(positions.length / 2)]

  return (
    <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Polyline positions={positions} color="#FC4C02" weight={3} opacity={0.8} />
      <FitBounds positions={positions} />
    </MapContainer>
  )
}
