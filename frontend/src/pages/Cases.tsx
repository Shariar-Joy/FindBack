import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Map, Search, SlidersHorizontal, X } from 'lucide-react'
import { get, useRegions } from '../services/api'
import type { Page, PublicCase } from '../types'
import {
  CaseCard,
  Empty,
  ErrorState,
  Field,
  PageHeading,
  Pagination,
  Skeletons,
} from '../components/ui'
export default function Cases({ searchTools = false }: { searchTools?: boolean }) {
  const [params, setParams] = useSearchParams()
  const [input, setInput] = useState(params.get('q') || '')
  const [expanded, setExpanded] = useState(searchTools)
  const regions = useRegions()
  useEffect(() => {
    const handle = setTimeout(() => {
      if (input !== (params.get('q') || '')) {
        setParams(
          (p) => {
            p.set('q', input)
            p.delete('page')
            return p
          },
          { replace: true },
        )
      }
    }, 300)
    return () => clearTimeout(handle)
  }, [input, params, setParams])
  const filters = Object.fromEntries(params.entries())
  const query = useQuery({
    queryKey: ['cases', filters],
    queryFn: () => get<Page<PublicCase>>('/cases', filters),
  })
  function update(key: string, value: string) {
    setParams((p) => {
      value ? p.set(key, value) : p.delete(key)
      p.delete('page')
      if (key === 'division') p.delete('district')
      return p
    })
  }
  return (
    <>
      <PageHeading
        eyebrow={searchTools ? 'FIND THE RIGHT INFORMATION' : 'OUR COMMUNITY, CONNECTED'}
        title={searchTools ? 'Search tools' : 'Every connection could bring someone home.'}
        description={
          params.get('mode') === 'sighting'
            ? 'Choose the related case, then use “Submit a sighting” to share your observation privately.'
            : 'Explore cases approved for publication. A familiar face or a small detail could help.'
        }
        action={
          <Link to="/map" className="button secondary">
            <Map size={17} /> Explore map
          </Link>
        }
      />
      <div className="panel directory-filters">
        <div className="search-row">
          <label className="search-input">
            <Search size={19} />
            <input
              aria-label="Search name or case reference"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Search by name or case reference…"
            />
            {input && (
              <button
                className="icon-button"
                aria-label="Clear search"
                onClick={() => setInput('')}
              >
                <X size={15} />
              </button>
            )}
          </label>
          <button
            className={`button secondary ${expanded ? 'selected' : ''}`}
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
          >
            <SlidersHorizontal size={17} /> Filters
          </button>
          <label className="sr-only" htmlFor="case-sort">
            Sort cases
          </label>
          <select
            id="case-sort"
            value={params.get('sort') || 'newest'}
            onChange={(e) => update('sort', e.target.value)}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </div>
        {expanded && (
          <div className="filter-grid">
            <Field label="Division">
              <select
                value={params.get('division') || ''}
                onChange={(e) => update('division', e.target.value)}
              >
                <option value="">All divisions</option>
                {Object.keys(regions.data?.divisions || {}).map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </Field>
            <Field label="District">
              <select
                value={params.get('district') || ''}
                onChange={(e) => update('district', e.target.value)}
              >
                <option value="">All districts</option>
                {(params.get('division')
                  ? regions.data?.divisions[params.get('division') || '']
                  : regions.data?.areas.map((a) => a.name)
                )?.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </Field>
            <Field label="City / area">
              <input
                value={params.get('city') || ''}
                onChange={(e) => update('city', e.target.value)}
                placeholder="Any general area"
              />
            </Field>
            <Field label="Publication status">
              <select
                value={params.get('status') || ''}
                onChange={(e) => update('status', e.target.value)}
              >
                <option value="">All published</option>
                <option value="APPROVED">Active</option>
                <option value="RESOLVED">Resolved, if retained</option>
              </select>
            </Field>
            <Field label="Last seen from">
              <input
                type="date"
                value={params.get('date_from') || ''}
                onChange={(e) => update('date_from', e.target.value)}
              />
            </Field>
            <Field label="Last seen until">
              <input
                type="date"
                value={params.get('date_to') || ''}
                onChange={(e) => update('date_to', e.target.value)}
              />
            </Field>
            <button
              className="text-button"
              onClick={() => {
                setInput('')
                setParams({})
              }}
            >
              Reset filters <X size={13} />
            </button>
          </div>
        )}
      </div>
      <div className="directory-label">
        <span>
          <span className="status-dot" /> {query.data?.total ?? '…'} published cases
        </span>
        <span>Public information only · General areas</span>
      </div>
      {query.isPending ? (
        <Skeletons count={6} />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => query.refetch()} />
      ) : query.data.items.length ? (
        <>
          <div className="case-grid directory-grid">
            {query.data.items.map((c) => (
              <CaseCard key={c.case_code} item={c} />
            ))}
          </div>
          <Pagination
            page={query.data.page}
            total={query.data.total}
            size={query.data.page_size}
            onChange={(p) =>
              setParams((prev) => {
                prev.set('page', String(p))
                return prev
              })
            }
          />
        </>
      ) : (
        <Empty
          title="No cases match your search"
          description="Try a different name, reference, or general area. Pending reports are kept private."
          action={
            <button
              className="button secondary"
              onClick={() => {
                setInput('')
                setParams({})
              }}
            >
              Clear filters
            </button>
          }
        />
      )}
    </>
  )
}
