import { lazy, Suspense, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { List, Map as MapIcon, MapPin } from 'lucide-react'
import { get, useRegions } from '../services/api'
import type { Page, PublicCase } from '../types'
import {
  CaseCard,
  Empty,
  ErrorState,
  PageHeading,
  Pagination,
  Safety,
  Spinner,
} from '../components/ui'
const CaseMap = lazy(() => import('../components/maps/CaseMap'))
export default function MapView() {
  const [district, setDistrict] = useState('')
  const [list, setList] = useState(false)
  const [page, setPage] = useState(1)
  const regions = useRegions()
  const query = useQuery({
    queryKey: ['map-cases', district, page],
    queryFn: () =>
      get<Page<PublicCase>>('/cases', { district, status: 'APPROVED', page_size: 100, page }),
  })
  const mapped = query.data?.items.filter((c) => c.public_location) || []
  return (
    <>
      <PageHeading
        eyebrow="A COMMUNITY WITHOUT BOUNDARIES"
        title="See the bigger picture."
        description="Explore published cases by general district. Map markers never represent a person’s precise location."
      />
      <div className="map-toolbar">
        <label className="icon-line">
          <MapPin size={18} />
          <select
            aria-label="Map district"
            value={district}
            onChange={(e) => {
              setDistrict(e.target.value)
              setPage(1)
            }}
          >
            <option value="">All Bangladesh</option>
            {regions.data?.areas.map((a) => (
              <option key={a.code}>{a.name}</option>
            ))}
          </select>
        </label>
        <div className="segmented">
          <button className={!list ? 'active' : ''} onClick={() => setList(false)}>
            <MapIcon size={16} />
            Map
          </button>
          <button className={list ? 'active' : ''} onClick={() => setList(true)}>
            <List size={16} />
            List
          </button>
        </div>
      </div>
      {query.isPending ? (
        <Spinner />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => query.refetch()} />
      ) : list ? (
        <div className="case-grid directory-grid">
          {query.data.items.map((c) => (
            <CaseCard key={c.case_code} item={c} />
          ))}
        </div>
      ) : (
        <div className="map-layout panel">
          <aside className="map-list">
            <div className="map-list-heading">
              <h3>{query.data.total} published cases</h3>
              <p>{mapped.length} safe map locations on this page</p>
            </div>
            {query.data.items.length ? (
              query.data.items.map((c) => (
                <Link key={c.case_code} to={`/cases/${c.case_code}`}>
                  <span className="mini-icon red">
                    <MapPin size={17} />
                  </span>
                  <div>
                    <strong>{c.person_name}</strong>
                    <p>{c.district}</p>
                    <small>
                      {c.case_code}
                      {!c.public_location ? ' · No map marker' : ''}
                    </small>
                  </div>
                </Link>
              ))
            ) : (
              <Empty
                title="No published cases"
                description="Approved cases with safe district locations will appear here."
              />
            )}
          </aside>
          <Suspense fallback={<Spinner />}>
            <CaseMap cases={mapped} />
          </Suspense>
        </div>
      )}
      {query.data && (
        <Pagination page={page} total={query.data.total} size={100} onChange={setPage} />
      )}
      <Safety>
        Markers show district-level centroids, not last-known exact locations. Cases without
        approved general locations appear in the list without a marker. Map tiles are provided by
        OpenStreetMap.
      </Safety>
    </>
  )
}
