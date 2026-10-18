import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, CheckCircle2, EyeOff, FileSearch, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { api, date, get, mediaUrl, message } from '../services/api'
import type { Abuse, CaseStatus, Page, PrivateCase, Sighting } from '../types'
import {
  Badge,
  Empty,
  ErrorState,
  Field,
  PageHeading,
  Pagination,
  PersonImage,
  Spinner,
  Submit,
} from '../components/ui'
export function ModeratorReview() {
  const { caseCode } = useParams()
  const cache = useQueryClient()
  const query = useQuery({
    queryKey: ['review-case', caseCode],
    queryFn: () => get<PrivateCase>(`/moderator/cases/${caseCode}`),
  })
  if (query.isPending) return <Spinner />
  if (query.isError) return <ErrorState error={query.error} />
  return (
    <>
      <Link to="/moderator" className="text-link back-link">
        <ArrowLeft size={15} />
        Back to moderation
      </Link>
      <PageHeading
        eyebrow="AUTHORIZED REVIEW"
        title={`Review ${caseCode}`}
        description="Review the full submission, remove sensitive details, and make an accountable publication decision."
      />
      <ReviewForm
        key={query.data.case_code + query.data.status + query.data.publication_visibility}
        c={query.data}
        onSaved={() => {
          cache.invalidateQueries({ queryKey: ['review-case', caseCode] })
          cache.invalidateQueries({ queryKey: ['moderator-cases'] })
          cache.invalidateQueries({ queryKey: ['moderator-stats'] })
          cache.invalidateQueries({ queryKey: ['public-stats'] })
          cache.invalidateQueries({ queryKey: ['cases'] })
        }}
      />
    </>
  )
}
function ReviewForm({ c, onSaved }: { c: PrivateCase; onSaved: () => void }) {
  const [decision, setDecision] = useState('APPROVED')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [safe, setSafe] = useState(false)
  const [photo, setPhoto] = useState(false)
  const [map, setMap] = useState(false)
  const [fields, setFields] = useState({
    person_name: c.person_name,
    description: c.description,
    clothing_description: c.clothing_description,
    area_name: c.area_name,
    additional_context: c.additional_context,
  })
  async function act(action: string, payload: unknown) {
    setBusy(true)
    try {
      await api.patch(`/moderator/cases/${c.case_code}/${action}`, payload)
      toast.success('Review decision saved.')
      onSaved()
    } catch (e) {
      toast.error(message(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="detail-layout">
      <div>
        <div className="panel padded-panel">
          <div className="section-heading">
            <h2>Authorized submission</h2>
            <Badge status={c.status} />
          </div>
          {c.is_demo && <div className="demo-banner">Synthetic demonstration record</div>}
          <PersonImage item={c} large />
          <dl className="private-details">
            {[
              ['Reporter', `${c.reporter?.display_name} · ${c.reporter?.email}`],
              ['Relationship', c.contact?.relationship || '—'],
              ['Private contact', c.contact?.value || '—'],
              ['Last seen', new Date(c.last_seen_at).toLocaleString()],
              ['Area', `${c.area_name}, ${c.city}, ${c.district}`],
              ['Age', String(c.approximate_age ?? 'Not supplied')],
              ['Private review notes', c.moderation_notes || 'None'],
              ['Previous feedback', c.rejection_reason || 'None'],
            ].map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          <h3>Public text for review</h3>
          <p className="muted">
            Edits below are saved when approving. Remove contact details, exact addresses, sensitive
            information, and unsupported claims. Division, district, city, approximate age, and date
            also become public.
          </p>
          {(Object.keys(fields) as (keyof typeof fields)[]).map((key) => (
            <Field key={key} label={key.replaceAll('_', ' ')}>
              {key === 'person_name' || key === 'area_name' ? (
                <input
                  value={fields[key]}
                  maxLength={key === 'person_name' ? 120 : 160}
                  onChange={(e) => setFields({ ...fields, [key]: e.target.value })}
                />
              ) : (
                <textarea
                  rows={3}
                  maxLength={key === 'clothing_description' ? 2000 : 4000}
                  value={fields[key]}
                  onChange={(e) => setFields({ ...fields, [key]: e.target.value })}
                />
              )}
            </Field>
          ))}
          {c.possible_duplicates && c.possible_duplicates.length > 0 && (
            <div className="info-box">
              <FileSearch size={20} />
              <div>
                <strong>Possible duplicates to check</strong>
                {c.possible_duplicates.map((d) => (
                  <p key={d.case_code}>
                    <Link to={`/moderator/cases/${d.case_code}`}>
                      {d.case_code} · {d.person_name}
                    </Link>
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      <aside>
        <form
          className="panel padded-panel sticky-review"
          onSubmit={(e) => {
            e.preventDefault()
            act('review', {
              decision,
              reason,
              ...fields,
              public_area_code: map ? 'BD:' + c.district : null,
              approve_photo: photo,
            })
          }}
        >
          <h2>Publication decision</h2>
          <p className="muted">
            Approval permits public sharing. It does not certify the information as officially
            verified.
          </p>
          {['PENDING', 'REJECTED'].includes(c.status) ? (
            <>
              <Field label="Decision">
                <select value={decision} onChange={(e) => setDecision(e.target.value)}>
                  <option value="APPROVED">Approve for publication</option>
                  <option value="REJECTED">Reject</option>
                  <option value="CORRECTIONS">Request corrections</option>
                  <option value="DUPLICATE">Flag as duplicate & reject</option>
                </select>
              </Field>
              <Field label="Reason / private reviewer notes">
                <textarea
                  rows={4}
                  required={decision !== 'APPROVED'}
                  minLength={decision !== 'APPROVED' ? 5 : 0}
                  maxLength={2000}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </Field>
              {decision === 'APPROVED' && (
                <>
                  <label className="check-label">
                    <input
                      type="checkbox"
                      checked={map}
                      onChange={(e) => setMap(e.target.checked)}
                    />
                    Publish approximate {c.district} district map area
                  </label>
                  {c.photo_url && (
                    <label className="check-label">
                      <input
                        type="checkbox"
                        checked={photo}
                        onChange={(e) => setPhoto(e.target.checked)}
                      />
                      I reviewed and approve the photograph for public sharing
                    </label>
                  )}
                  <label className="check-label">
                    <input
                      type="checkbox"
                      required
                      checked={safe}
                      onChange={(e) => setSafe(e.target.checked)}
                    />
                    I have reviewed every public field and confirmed it is appropriate to publish.
                  </label>
                </>
              )}
              <Submit pending={busy}>
                <ShieldCheck size={16} />
                Save decision
              </Submit>
            </>
          ) : (
            <>
              <Field label="Reason for action">
                <textarea
                  required
                  minLength={5}
                  maxLength={2000}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={4}
                />
              </Field>
              {c.status === 'APPROVED' && (
                <div className="stack-actions">
                  <button
                    type="button"
                    className="button secondary"
                    disabled={busy || reason.trim().length < 5}
                    onClick={() =>
                      act('visibility', {
                        visibility: c.publication_visibility === 'PUBLIC' ? 'PRIVATE' : 'PUBLIC',
                        reason,
                      })
                    }
                  >
                    <EyeOff size={16} />
                    {c.publication_visibility === 'PUBLIC'
                      ? 'Temporarily hide case'
                      : 'Restore publication'}
                  </button>
                  <button
                    className="button primary"
                    type="button"
                    disabled={busy || reason.trim().length < 5}
                    onClick={() => act('resolve', { reason })}
                  >
                    <CheckCircle2 size={16} />
                    Resolve & remove from public view
                  </button>
                  <p className="small-text muted">
                    Resolve after confirming the person has been found and recording the basis in
                    your reason.
                  </p>
                </div>
              )}
            </>
          )}
        </form>
      </aside>
    </div>
  )
}
function SightingRecord({ s, onSaved }: { s: Sighting; onSaved: () => void }) {
  const [notes, setNotes] = useState(s.review_notes || '')
  const [status, setStatus] = useState('REVIEWED')
  const [busy, setBusy] = useState(false)
  return (
    <form
      className="panel padded-panel"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        try {
          await api.patch(`/moderator/sightings/${s.id}/review`, { status, notes })
          toast.success('Private review saved.')
          onSaved()
        } catch (e) {
          toast.error(message(e))
        } finally {
          setBusy(false)
        }
      }}
    >
      <div className="section-heading">
        <strong>{s.case_code}</strong>
        <Badge status={s.status} />
      </div>
      <p>{s.notes}</p>
      <dl className="private-details">
        <div>
          <dt>Observed</dt>
          <dd>{new Date(s.observed_at).toLocaleString()}</dd>
        </div>
        <div>
          <dt>Location</dt>
          <dd>{s.location_description}</dd>
        </div>
        <div>
          <dt>Safe contact</dt>
          <dd>{s.safe_contact || 'Not provided'}</dd>
        </div>
      </dl>
      {s.attachment_url && (
        <img
          className="sighting-attachment"
          src={mediaUrl(s.attachment_url)}
          alt="Private sighting attachment"
        />
      )}
      <Field label="Private review notes">
        <textarea
          value={notes}
          maxLength={2000}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
        />
      </Field>
      <div className="form-inline">
        <select
          aria-label="Sighting decision"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="REVIEWED">Mark reviewed</option>
          <option value="DISMISSED">Dismiss</option>
        </select>
        <Submit pending={busy}>Save review</Submit>
      </div>
    </form>
  )
}
function AbuseRecord({ a, onSaved }: { a: Abuse; onSaved: () => void }) {
  const [decision, setDecision] = useState(a.decision)
  const [hide, setHide] = useState(false)
  const [busy, setBusy] = useState(false)
  return (
    <form
      className="panel padded-panel"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        try {
          await api.patch(`/moderator/abuse/${a.id}`, { decision, hide_case: hide })
          toast.success('Concern reviewed.')
          onSaved()
        } catch (e) {
          toast.error(message(e))
        } finally {
          setBusy(false)
        }
      }}
    >
      <div className="section-heading">
        <Link to={`/moderator/cases/${a.case_code}`}>{a.case_code}</Link>
        <Badge status={a.status} />
      </div>
      <p>{a.reason}</p>
      <small>{date(a.created_at)}</small>
      <Field label="Decision and reason">
        <textarea
          required
          minLength={5}
          maxLength={2000}
          value={decision}
          onChange={(e) => setDecision(e.target.value)}
          rows={3}
        />
      </Field>
      <label className="check-label">
        <input type="checkbox" checked={hide} onChange={(e) => setHide(e.target.checked)} />
        Hide this case from publication
      </label>
      <Submit pending={busy}>Save decision</Submit>
    </form>
  )
}
export default function Moderator() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') || 'cases'
  const [status, setStatus] = useState('PENDING')
  const [page, setPage] = useState(1)
  const cache = useQueryClient()
  const stats = useQuery({
    queryKey: ['moderator-stats'],
    queryFn: () => get<Record<string, number>>('/moderator/stats'),
  })
  const cases = useQuery({
    queryKey: ['moderator-cases', status, page],
    queryFn: () =>
      get<Page<PrivateCase>>('/moderator/cases', { status: status || undefined, page }),
    enabled: tab === 'cases',
  })
  const sightings = useQuery({
    queryKey: ['moderator-sightings', page],
    queryFn: () => get<Page<Sighting>>('/moderator/sightings', { page }),
    enabled: tab === 'sightings',
  })
  const abuse = useQuery({
    queryKey: ['moderator-abuse', page],
    queryFn: () => get<Page<Abuse>>('/moderator/abuse', { page }),
    enabled: tab === 'abuse',
  })
  const saved = () => {
    cache.invalidateQueries({ queryKey: ['moderator-sightings'] })
    cache.invalidateQueries({ queryKey: ['moderator-abuse'] })
    cache.invalidateQueries({ queryKey: ['moderator-stats'] })
  }
  const active = tab === 'sightings' ? sightings : abuse
  return (
    <>
      <PageHeading
        eyebrow="TRUST STARTS WITH CAREFUL REVIEW"
        title="Moderation workspace"
        description="Review reports, protect private information, and help the community share responsibly."
      />
      <div className="stats-grid moderator-stat-grid">
        {[
          ['Pending cases', 'pending'],
          ['Approved', 'approved'],
          ['Rejected', 'rejected'],
          ['Pending sightings', 'sightings'],
          ['Reported concerns', 'abuse'],
        ].map(([label, key]) => (
          <div className="stat-card" key={key}>
            <div>
              <p>{label}</p>
              <strong>{stats.data?.[key] ?? '—'}</strong>
            </div>
          </div>
        ))}
      </div>
      {stats.isError && <ErrorState error={stats.error} />}
      <div className="tab-bar">
        {[
          ['cases', 'Case review'],
          ['sightings', 'Private sightings'],
          ['abuse', 'Concerns & removals'],
        ].map(([id, label]) => (
          <button
            key={id}
            className={tab === id ? 'active' : ''}
            onClick={() => {
              setParams({ tab: id })
              setPage(1)
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === 'cases' ? (
        <div className="panel padded-panel">
          <div className="section-heading">
            <h2>Case queue</h2>
            <select
              aria-label="Moderation case status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value)
                setPage(1)
              }}
            >
              <option value="">All statuses</option>
              {['PENDING', 'APPROVED', 'REJECTED', 'RESOLVED'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          {cases.isPending ? (
            <Spinner />
          ) : cases.isError ? (
            <ErrorState error={cases.error} />
          ) : cases.data.items.length ? (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Case reference</th>
                      <th>Person / reporter</th>
                      <th>General area</th>
                      <th>Submitted</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cases.data.items.map((c) => (
                      <tr key={c.case_code}>
                        <td className="mono">{c.case_code}</td>
                        <td>
                          <strong>{c.person_name}</strong>
                          <small>{c.reporter?.display_name}</small>
                        </td>
                        <td>{c.district}</td>
                        <td>{date(c.created_at)}</td>
                        <td>
                          <Badge status={c.status as CaseStatus} />
                        </td>
                        <td>
                          <Link className="text-link" to={`/moderator/cases/${c.case_code}`}>
                            Review <ArrowRight size={14} />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={page} total={cases.data.total} size={20} onChange={setPage} />
            </>
          ) : (
            <Empty
              title="The queue is clear"
              description="Reports matching this status will appear here."
            />
          )}
        </div>
      ) : active.isPending ? (
        <Spinner />
      ) : active.isError ? (
        <ErrorState error={active.error} />
      ) : active.data?.items.length ? (
        <>
          <div className="review-record-grid">
            {tab === 'sightings'
              ? sightings.data?.items.map((s) => (
                  <SightingRecord key={s.id} s={s} onSaved={saved} />
                ))
              : abuse.data?.items.map((a) => <AbuseRecord key={a.id} a={a} onSaved={saved} />)}
          </div>
          <Pagination page={page} total={active.data.total} size={20} onChange={setPage} />
        </>
      ) : (
        <Empty
          title="Nothing awaiting attention"
          description="New private submissions will appear in this workspace."
        />
      )}
    </>
  )
}
