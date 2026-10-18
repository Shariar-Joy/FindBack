import { useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, Bell, FileText, MapPin, Plus, Settings, UserRound } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../contexts/AuthContext'
import { api, date, get, message } from '../services/api'
import type { Notice, Page, PrivateCase, Sighting } from '../types'
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
import { Subscriptions } from '../components/dashboard/Subscriptions'
const tabs = [
  ['overview', 'Overview', UserRound],
  ['reports', 'My reports', FileText],
  ['sightings', 'My sightings', MapPin],
  ['subscriptions', 'Area alerts', Bell],
  ['notifications', 'Notifications', Bell],
  ['settings', 'Settings', Settings],
] as const
function ProfileSettings() {
  const { user, refresh } = useAuth()
  const navigate = useNavigate()
  const cache = useQueryClient()
  const [name, setName] = useState(user?.display_name || '')
  const [email, setEmail] = useState(user?.email || '')
  const [emailAlerts, setEmailAlerts] = useState(user?.email_alerts ?? true)
  const [current, setCurrent] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [busy, setBusy] = useState(false)
  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await api.patch('/me/profile', {
        display_name: name,
        email,
        current_password: current,
        email_alerts: emailAlerts,
      })
      await refresh()
      setCurrent('')
      toast.success('Your settings have been saved.')
    } catch (e) {
      toast.error(message(e))
    } finally {
      setBusy(false)
    }
  }
  async function change(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await api.post('/me/password', { current_password: current, password: newPassword })
      cache.clear()
      navigate('/login')
      toast.success('Password changed. Please sign in again.')
    } catch (e) {
      toast.error(message(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="settings-grid">
      <form className="panel padded-panel" onSubmit={save}>
        <h2>Profile & preferences</h2>
        <Field label="Display name">
          <input
            required
            minLength={2}
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="Email address">
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <label className="check-label">
          <input
            type="checkbox"
            checked={emailAlerts}
            onChange={(e) => setEmailAlerts(e.target.checked)}
          />
          Send me email alerts for my subscribed areas
        </label>
        <Field label="Current password to save changes">
          <input
            required
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </Field>
        <Submit pending={busy}>Save settings</Submit>
      </form>
      <form className="panel padded-panel" onSubmit={change}>
        <h2>Change password</h2>
        <p className="muted">Changing your password signs out all active sessions.</p>
        <Field label="Current password">
          <input
            required
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </Field>
        <Field
          label="New password"
          hint="12 or more characters, with uppercase, lowercase and a number."
        >
          <input
            required
            type="password"
            autoComplete="new-password"
            minLength={12}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </Field>
        <Submit pending={busy}>Change password</Submit>
      </form>
      <Deactivate />
    </div>
  )
}
function Deactivate() {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const cache = useQueryClient()
  const navigate = useNavigate()
  return (
    <div className="panel padded-panel">
      <h2>Deactivate account</h2>
      <p className="muted">
        This disables sign-in and email alerts. Case and audit records are retained for authorized
        review. Request case removal from your report page.
      </p>
      {open ? (
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            setBusy(true)
            try {
              await api.delete('/me/account', {
                data: { current_password: password },
              })
              cache.clear()
              navigate('/')
              toast.success('Account deactivated.')
            } catch (e) {
              toast.error(message(e))
            } finally {
              setBusy(false)
            }
          }}
        >
          <Field label="Confirm with your password">
            <input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <Submit pending={busy}>Deactivate my account</Submit>
          <button className="text-button" type="button" onClick={() => setOpen(false)}>
            Cancel
          </button>
        </form>
      ) : (
        <button className="button secondary" onClick={() => setOpen(true)}>
          Deactivate account
        </button>
      )}
    </div>
  )
}
export default function UserDashboard() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') || 'overview'
  const [page, setPage] = useState(1)
  const stats = useQuery({
    queryKey: ['user-stats'],
    queryFn: () =>
      get<{ reports: number; pending: number; approved: number; sightings: number }>(
        '/dashboard/user-stats',
      ),
  })
  const reports = useQuery({
    queryKey: ['my-cases', page],
    queryFn: () => get<Page<PrivateCase>>('/me/cases', { page }),
    enabled: tab === 'overview' || tab === 'reports',
  })
  const sightings = useQuery({
    queryKey: ['my-sightings', page],
    queryFn: () => get<Page<Sighting>>('/me/sightings', { page }),
    enabled: tab === 'sightings',
  })
  const notices = useQuery({
    queryKey: ['notifications', page],
    queryFn: () => get<Page<Notice>>('/me/notifications', { page }),
    enabled: tab === 'notifications',
  })
  return (
    <>
      <PageHeading
        eyebrow="YOUR FINDBACK"
        title={`Hello, ${user?.display_name.split(' ')[0]}.`}
        description="Your reports, observations, and community connections, all in one place."
        action={
          <Link className="button primary" to="/report-missing">
            <Plus size={17} />
            New report
          </Link>
        }
      />
      <div className="tab-bar" role="navigation" aria-label="My dashboard sections">
        {tabs.map(([id, label, Icon]) => (
          <button
            className={tab === id ? 'active' : ''}
            key={id}
            onClick={() => {
              setParams({ tab: id })
              setPage(1)
            }}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>
      {(tab === 'overview' || tab === 'reports') && (
        <>
          {stats.isError ? (
            <ErrorState error={stats.error} />
          ) : (
            <div className="stats-grid">
              {[
                ['Submitted reports', stats.data?.reports],
                ['Pending review', stats.data?.pending],
                ['Approved reports', stats.data?.approved],
                ['Private sightings', stats.data?.sightings],
              ].map(([label, value]) => (
                <div className="stat-card" key={label}>
                  <div>
                    <p>{label}</p>
                    <strong>{value ?? '—'}</strong>
                  </div>
                  <FileText className="muted" size={22} />
                </div>
              ))}
            </div>
          )}
          <div className="panel padded-panel">
            <h2>My reports</h2>
            {reports.isPending ? (
              <Spinner />
            ) : reports.isError ? (
              <ErrorState error={reports.error} />
            ) : reports.data.items.length ? (
              <>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Case reference</th>
                        <th>Person</th>
                        <th>Submitted</th>
                        <th>Status</th>
                        <th>
                          <span className="sr-only">View report</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {reports.data.items.map((c) => (
                        <tr key={c.case_code}>
                          <td className="mono">{c.case_code}</td>
                          <td>{c.person_name}</td>
                          <td>{date(c.created_at)}</td>
                          <td>
                            <Badge status={c.status} />
                          </td>
                          <td>
                            <Link className="text-link" to={`/dashboard/reports/${c.case_code}`}>
                              View private report <ArrowRight size={13} />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination page={page} total={reports.data.total} size={20} onChange={setPage} />
              </>
            ) : (
              <Empty
                title="Your first report starts here"
                description="Reports you submit will appear here, including private review feedback."
                action={
                  <Link className="button primary" to="/report-missing">
                    Submit a report
                  </Link>
                }
              />
            )}
          </div>
        </>
      )}
      {tab === 'sightings' && (
        <div className="panel padded-panel">
          <h2>My private sightings</h2>
          {sightings.isPending ? (
            <Spinner />
          ) : sightings.isError ? (
            <ErrorState error={sightings.error} />
          ) : sightings.data.items.length ? (
            <>
              {sightings.data.items.map((s) => (
                <div className="record-card" key={s.id}>
                  <div className="section-heading">
                    <strong>{s.case_code}</strong>
                    <Badge status={s.status} />
                  </div>
                  <p>{s.notes}</p>
                  <small>
                    {date(s.created_at)} · {s.location_description}
                  </small>
                </div>
              ))}
              <Pagination page={page} total={sightings.data.total} size={20} onChange={setPage} />
            </>
          ) : (
            <Empty
              title="No sightings submitted yet"
              description="Observations you share stay private. You can track their review status here."
              action={
                <Link to="/cases" className="button secondary">
                  Explore cases
                </Link>
              }
            />
          )}
        </div>
      )}
      {tab === 'subscriptions' && <Subscriptions />}
      {tab === 'notifications' && (
        <div className="panel padded-panel">
          <h2>Notification history</h2>
          {notices.isPending ? (
            <Spinner />
          ) : notices.isError ? (
            <ErrorState error={notices.error} />
          ) : notices.data.items.length ? (
            <>
              {notices.data.items.map((n) => (
                <div className="record-card" key={n.id}>
                  <div className="section-heading">
                    <strong>{n.area}</strong>
                    <Badge status={n.status} />
                  </div>
                  <p>
                    {n.case_code ? (
                      <Link to={`/cases/${n.case_code}`}>{n.case_code} →</Link>
                    ) : (
                      'This case is no longer public.'
                    )}
                  </p>
                  <small>
                    {date(n.created_at)} ·{' '}
                    {n.sent_at ? 'Delivered ' + date(n.sent_at) : 'Delivery status shown above'}
                  </small>
                </div>
              ))}
              <Pagination page={page} total={notices.data.total} size={20} onChange={setPage} />
            </>
          ) : (
            <Empty
              title="You’re all caught up"
              description="Alerts for your subscribed districts will appear here when created."
            />
          )}
        </div>
      )}
      {tab === 'settings' && <ProfileSettings />}
    </>
  )
}
