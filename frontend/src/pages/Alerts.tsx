import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ArrowRight, Bell, MapPin } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { date, get, useRegions } from '../services/api'
import type { Page, PublicCase } from '../types'
import { Subscriptions } from '../components/dashboard/Subscriptions'
import { Empty, ErrorState, PageHeading, Pagination, Spinner } from '../components/ui'
export default function Alerts() {
  const { user } = useAuth()
  const [district, setDistrict] = useState('')
  const [page, setPage] = useState(1)
  const regions = useRegions()
  const query = useQuery({
    queryKey: ['alerts', district, page],
    queryFn: () => get<Page<PublicCase>>('/alerts', { district, page }),
  })
  return (
    <>
      <PageHeading
        eyebrow="LOCAL AWARENESS. MEANINGFUL ACTION."
        title="Community alert centre"
        description="Stay informed about published cases in the places that matter to you."
      />
      <div className="alerts-layout">
        <section>
          <div className="section-heading">
            <h2>
              <Bell size={20} /> Recent alerts
            </h2>
            <select
              aria-label="Filter alerts by district"
              value={district}
              onChange={(e) => {
                setDistrict(e.target.value)
                setPage(1)
              }}
            >
              <option value="">All districts</option>
              {regions.data?.areas.map((a) => (
                <option key={a.code}>{a.name}</option>
              ))}
            </select>
          </div>
          {query.isPending ? (
            <Spinner />
          ) : query.isError ? (
            <ErrorState error={query.error} retry={() => query.refetch()} />
          ) : query.data.items.length ? (
            <>
              {query.data.items.map((c) => (
                <article className="panel alert-card" key={c.case_code}>
                  <span className="stat-icon orange">
                    <MapPin size={23} />
                  </span>
                  <div>
                    <span className="eyebrow">
                      APPROVED FOR PUBLICATION {c.is_demo ? '· DEMO' : ''}
                    </span>
                    <h3>Community alert in {c.district}</h3>
                    <p>
                      {c.person_name} · {c.case_code}
                    </p>
                    <small>
                      Published {date(c.published_at)} · General area: {c.area_name}
                    </small>
                    <Link className="text-link" to={`/cases/${c.case_code}`}>
                      View public case <ArrowRight size={14} />
                    </Link>
                  </div>
                </article>
              ))}
              <Pagination page={page} total={query.data.total} size={12} onChange={setPage} />
            </>
          ) : (
            <Empty
              title="No alerts for this area"
              description="New approved alerts will appear here when available."
            />
          )}
        </section>
        <aside>
          {user ? (
            <Subscriptions />
          ) : (
            <div className="panel subscribe-invite">
              <Bell size={35} />
              <h2>
                Your community,
                <br />a little closer.
              </h2>
              <p>
                Create an account to subscribe to multiple districts and receive relevant email
                alerts.
              </p>
              <Link className="button primary full" to="/register">
                Join the community <ArrowRight size={16} />
              </Link>
              <Link className="text-link" to="/login">
                Already a member? Sign in
              </Link>
            </div>
          )}
        </aside>
      </div>
    </>
  )
}
