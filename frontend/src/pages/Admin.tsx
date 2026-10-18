import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { RefreshCw, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { api, date, get, message } from '../services/api'
import type { Analytics, Audit, Group, Job, ManagedUser, Page, Role } from '../types'
import {
  Badge,
  Empty,
  ErrorState,
  Field,
  PageHeading,
  Pagination,
  Spinner,
  Submit,
} from '../components/ui'
function Chart({ title, data }: { title: string; data: Group[] }) {
  return (
    <div className="panel chart-card">
      <h3>{title}</h3>
      {data.length ? (
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data} margin={{ top: 20, right: 10, left: -20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="name" fontSize={10} tickLine={false} />
            <YAxis allowDecimals={false} fontSize={11} axisLine={false} tickLine={false} />
            <Tooltip cursor={{ fill: '#fff5f1' }} />
            <Bar dataKey="count" fill="#e76349" radius={[5, 5, 0, 0]} maxBarSize={42} />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <Empty
          title="No records to chart"
          description="This chart uses actual database records. New activity will appear here."
        />
      )}
    </div>
  )
}
function UserEditor({ u, onSaved }: { u: ManagedUser; onSaved: () => void }) {
  const [role, setRole] = useState<Role>(u.role)
  const [active, setActive] = useState(u.is_active)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <form
      className="panel padded-panel"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        try {
          await api.patch(`/admin/users/${u.id}`, { role, is_active: active, reason })
          toast.success('Account permissions updated.')
          onSaved()
        } catch (e) {
          toast.error(message(e))
        } finally {
          setBusy(false)
        }
      }}
    >
      <strong>{u.display_name}</strong>
      <p className="muted">{u.email}</p>
      <Field label="Account role">
        <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
          {['USER', 'MODERATOR', 'ADMIN'].map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </Field>
      <label className="check-label">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        Account active
      </label>
      <Field label="Reason for access change">
        <input
          required
          minLength={5}
          maxLength={1000}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </Field>
      <Submit pending={busy}>Update access</Submit>
    </form>
  )
}
export default function Admin() {
  const [tab, setTab] = useState('overview')
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const cache = useQueryClient()
  const analytics = useQuery({
    queryKey: ['analytics'],
    queryFn: () => get<Analytics>('/admin/analytics'),
    enabled: tab === 'overview',
  })
  const users = useQuery({
    queryKey: ['admin-users', page, search],
    queryFn: () => get<Page<ManagedUser>>('/admin/users', { page, q: search }),
    enabled: tab === 'users',
  })
  const logs = useQuery({
    queryKey: ['audit', page],
    queryFn: () => get<Page<Audit>>('/admin/audit-logs', { page }),
    enabled: tab === 'audit',
  })
  const jobs = useQuery({
    queryKey: ['jobs', page],
    queryFn: () => get<Page<Job>>('/admin/notification-jobs', { page }),
    enabled: tab === 'jobs',
    refetchInterval: tab === 'jobs' ? 10000 : false,
  })
  const health = useQuery({
    queryKey: ['system-health'],
    queryFn: () => get<Record<string, string | number>>('/admin/health'),
    enabled: tab === 'health',
  })
  async function retry(id: string) {
    try {
      await api.post(`/admin/notification-jobs/${id}/retry`)
      cache.invalidateQueries({ queryKey: ['jobs'] })
      toast.success('Notification queued for retry.')
    } catch (e) {
      toast.error(message(e))
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="ACCOUNTABLE BY DESIGN"
        title="Administration"
        description="System activity, account access, and notification delivery, backed by real records."
        action={
          <span className="region-chip">
            <ShieldCheck size={15} />
            Administrator access
          </span>
        }
      />
      <div className="tab-bar">
        {[
          ['overview', 'System overview'],
          ['users', 'User management'],
          ['audit', 'Audit log'],
          ['jobs', 'Notification jobs'],
          ['health', 'System health'],
        ].map(([id, label]) => (
          <button
            key={id}
            className={tab === id ? 'active' : ''}
            onClick={() => {
              setTab(id)
              setPage(1)
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'overview' &&
        (analytics.isPending ? (
          <Spinner />
        ) : analytics.isError ? (
          <ErrorState error={analytics.error} />
        ) : (
          <>
            <div className="stats-grid">
              <div className="stat-card">
                <div>
                  <p>Total accounts</p>
                  <strong>{analytics.data.users}</strong>
                </div>
              </div>
              <div className="stat-card">
                <div>
                  <p>Submitted cases</p>
                  <strong>{analytics.data.cases}</strong>
                </div>
              </div>
            </div>
            <div className="analytics-grid">
              <Chart title="Case submissions over time" data={analytics.data.submissions} />
              <Chart title="Cases by publication status" data={analytics.data.by_status} />
              <Chart title="Cases by district" data={analytics.data.by_district} />
              <Chart title="Sightings over time" data={analytics.data.sightings} />
              <Chart title="Notification delivery" data={analytics.data.notifications} />
            </div>
          </>
        ))}
      {tab === 'users' && (
        <>
          <Field label="Search accounts by email">
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder="Search accounts…"
            />
          </Field>
          {users.isPending ? (
            <Spinner />
          ) : users.isError ? (
            <ErrorState error={users.error} />
          ) : (
            <>
              <div className="review-record-grid">
                {users.data.items.map((u) => (
                  <UserEditor
                    key={u.id + u.role + u.is_active}
                    u={u}
                    onSaved={() => cache.invalidateQueries({ queryKey: ['admin-users'] })}
                  />
                ))}
              </div>
              <Pagination page={page} total={users.data.total} size={20} onChange={setPage} />
            </>
          )}
        </>
      )}
      {tab === 'audit' && (
        <div className="panel padded-panel">
          <h2>Audit trail</h2>
          {logs.isPending ? (
            <Spinner />
          ) : logs.isError ? (
            <ErrorState error={logs.error} />
          ) : logs.data.items.length ? (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Actor</th>
                      <th>Action</th>
                      <th>Case</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.data.items.map((a) => (
                      <tr key={a.id}>
                        <td>{date(a.created_at)}</td>
                        <td>{a.actor}</td>
                        <td>{a.action.replaceAll('_', ' ')}</td>
                        <td>{a.case_code || '—'}</td>
                        <td>
                          <details>
                            <summary>View details</summary>
                            <pre>{JSON.stringify(a.details, null, 2)}</pre>
                          </details>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={page} total={logs.data.total} size={30} onChange={setPage} />
            </>
          ) : (
            <Empty
              title="No audit events"
              description="Sensitive review and administration actions will be recorded here."
            />
          )}
        </div>
      )}
      {tab === 'jobs' && (
        <div className="panel padded-panel">
          <div className="section-heading">
            <h2>Durable notification outbox</h2>
            <button className="button secondary small" onClick={() => jobs.refetch()}>
              <RefreshCw size={15} />
              Refresh
            </button>
          </div>
          {jobs.isPending ? (
            <Spinner />
          ) : jobs.isError ? (
            <ErrorState error={jobs.error} />
          ) : jobs.data.items.length ? (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Case</th>
                      <th>Status</th>
                      <th>Attempts</th>
                      <th>Last error</th>
                      <th>Created</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.data.items.map((j) => (
                      <tr key={j.id}>
                        <td className="mono">{j.case_code}</td>
                        <td>
                          <Badge status={j.status} />
                        </td>
                        <td>{j.attempts}</td>
                        <td>{j.last_error || '—'}</td>
                        <td>{date(j.created_at)}</td>
                        <td>
                          {j.status === 'FAILED' && (
                            <button className="text-button" onClick={() => retry(j.id)}>
                              Retry delivery
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={page} total={jobs.data.total} size={20} onChange={setPage} />
            </>
          ) : (
            <Empty
              title="No notification jobs"
              description="Approving a case creates durable jobs for matching district subscribers."
            />
          )}
          <p className="muted small-text">
            Jobs persist across worker restarts. Synthetic records are cancelled unless the local
            test email sink is explicitly enabled.
          </p>
        </div>
      )}
      {tab === 'health' &&
        (health.isPending ? (
          <Spinner />
        ) : health.isError ? (
          <ErrorState error={health.error} />
        ) : (
          <div className="panel padded-panel">
            <h2>Configured system services</h2>
            <dl className="private-details">
              {Object.entries(health.data).map(([key, value]) => (
                <div key={key}>
                  <dt>{key.replaceAll('_', ' ')}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <p className="muted">
              Configuration values describe selected adapters. They do not prove external storage or
              SMTP connectivity. Use deployment smoke tests to verify those services.
            </p>
          </div>
        ))}
    </>
  )
}
