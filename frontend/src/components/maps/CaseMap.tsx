import { useEffect } from 'react'
import { MapContainer, TileLayer, Circle, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet.markercluster'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import type { PublicCase } from '../../types'
function ClusterLayer({ cases }: { cases: PublicCase[] }) {
  const map = useMap()
  useEffect(() => {
    const group = L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 55 })
    for (const c of cases) {
      if (!c.public_location) continue
      const icon = L.divIcon({
        className: 'case-map-pin',
        html: '<span></span>',
        iconSize: [28, 34],
        iconAnchor: [14, 34],
      })
      const content = document.createElement('div')
      const title = document.createElement('strong')
      title.textContent = c.person_name
      const area = document.createElement('p')
      area.textContent = `${c.district} district · approximate`
      const link = document.createElement('a')
      link.href = `/cases/${encodeURIComponent(c.case_code)}`
      link.textContent = `View ${c.case_code} →`
      content.append(title, area, link)
      group.addLayer(L.marker(c.public_location, { icon }).bindPopup(content))
    }
    map.addLayer(group)
    return () => {
      map.removeLayer(group)
    }
  }, [map, cases])
  return null
}
export default function CaseMap({
  cases,
  single = false,
}: {
  cases: PublicCase[]
  single?: boolean
}) {
  const center =
    single && cases[0]?.public_location
      ? cases[0].public_location
      : ([23.8, 90.2] as [number, number])
  return (
    <MapContainer
      center={center}
      zoom={single ? 9 : 7}
      scrollWheelZoom={false}
      className={single ? 'detail-map' : 'case-map'}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {single && cases[0]?.public_location ? (
        <Circle
          center={cases[0].public_location}
          radius={20000}
          pathOptions={{ color: '#dc2626', fillOpacity: 0.1, weight: 1.5 }}
        >
          <Popup>General district area only</Popup>
        </Circle>
      ) : (
        <ClusterLayer cases={cases} />
      )}
    </MapContainer>
  )
}
