import { lazy, Suspense, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  ArrowRight,
  Flag,
  Link2,
  MapPin,
  Printer,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { api, date, get, message } from '../services/api'
import type { PrivateCase, PublicCase } from '../types'
import { Badge, ErrorState, Field, PersonImage, Safety, Spinner, Submit } from '../components/ui'
const CaseMap = lazy(() => import('../components/maps/CaseMap'))
export default function CaseDetails({ privateView = false }: { privateView?: boolean }) {
  const { caseCode } = useParams()
  const [flag, setFlag] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const cache = useQueryClient()
  const query = useQuery({
    queryKey: [privateView ? 'own-case' : 'case', caseCode],
    queryFn: () => get<PrivateCase>(`${privateView ? '/me' : ''}/cases/${caseCode}`),
  })
  async function sendConcern(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      await api.post(privateView ? `/me/cases/${caseCode}/removal` : `/cases/${caseCode}/abuse`, {
        reason,
      })
      toast.success('Your request has been submitted privately.')
      setFlag(false)
      setReason('')
    } catch (e) {
      toast.error(message(e))
    } finally {
      setBusy(false)
    }
  }
  async function removePhoto() {
    try {
      await api.delete(`/private/cases/${caseCode}/photo`)
      await cache.invalidateQueries({ queryKey: ['own-case', caseCode] })
      toast.success('Photo removed.')
    } catch (e) {
      toast.error(message(e))
    }
  }
  if (query.isPending) return <Spinner />
  if (query.isError) return <ErrorState error={query.error} retry={() => query.refetch()} />
  const c = query.data
  return (
    <>
      <Link to={privateView ? '/dashboard?tab=reports' : '/cases'} className="text-link back-link">
        <ArrowLeft size={15} />
        {privateView ? 'My reports' : 'Back to active cases'}
      </Link>
      {c.is_demo && (
        <div className="demo-banner">
          DEMONSTRATION RECORD · This is a fictional person and synthetic case.
        </div>
      )}
      {privateView && (
        <div className="info-box">
          <ShieldCheck size={20} />
          <p>
            This is your private report view. Your contact details and review feedback are only
            available here and to authorized reviewers.
          </p>
        </div>
      )}
      <div className="detail-layout">
        <div>
          <div className="panel detail-main">
            <PersonImage item={c} large />
            <div className="detail-content">
              <div className="case-reference">{c.case_code}</div>
              <div className="detail-title">
                <h1>{c.person_name}</h1>
                <Badge status={c.status} />
              </div>
              <p className="icon-line">
                <MapPin size={17} />
                {c.area_name}, {c.city}, {c.district}
              </p>
              <div className="detail-facts">
                <div>
                  <span>Approximate age</span>
                  <strong>
                    {c.approximate_age !== null ? `${c.approximate_age} years` : 'Not published'}
                  </strong>
                </div>
                <div>
                  <span>Last seen</span>
                  <strong>{date(c.last_seen_date)}</strong>
                </div>
                <div>
                  <span>Division</span>
                  <strong>{c.division}</strong>
                </div>
              </div>
              <section>
                <h2>Physical description</h2>
                <p className="preserve-lines">{c.description}</p>
              </section>
              <section>
                <h2>Clothing when last seen</h2>
                <p className="preserve-lines">{c.clothing_description}</p>
              </section>
              {c.additional_context && (
                <section>
                  <h2>Additional information</h2>
                  <p className="preserve-lines">{c.additional_context}</p>
                </section>
              )}
              {privateView && (
                <>
                  <section>
                    <h2>Private reporter information</h2>
                    <p>
                      {c.contact?.relationship} · {c.contact?.method}: {c.contact?.value}
                    </p>
                    <p>Publication visibility: {c.publication_visibility.toLowerCase()}</p>
                    {c.rejection_reason && (
                      <div className="form-error">
                        <strong>Review feedback</strong>
                        <p>{c.rejection_reason}</p>
                      </div>
                    )}
                  </section>
                  <div className="button-row">
                    {['PENDING', 'REJECTED'].includes(c.status) && (
                      <Link className="button primary" to={`/report-missing/${c.case_code}`}>
                        Edit & resubmit report <ArrowRight size={16} />
                      </Link>
                    )}
                    {c.photo_url && (
                      <button className="button secondary" onClick={removePhoto}>
                        <Trash2 size={15} />
                        Remove photograph
                      </button>
                    )}
                  </div>
                </>
              )}
              <Safety />
            </div>
          </div>
        </div>
        <aside className="detail-sidebar">
          <div className="panel">
            <h3>General last-seen area</h3>
            {c.public_location ? (
              <Suspense fallback={<Spinner />}>
                <CaseMap cases={[c as PublicCase]} single />
              </Suspense>
            ) : (
              <div className="no-map">
                <MapPin size={28} />
                <p>No approved map location is available.</p>
              </div>
            )}
            <p className="map-caption">
              District-level area only. This is not a precise last-seen location.
            </p>
          </div>
          {!privateView && c.status === 'APPROVED' && (
            <div className="panel sighting-cta">
              <span className="mini-icon red">
                <MapPin size={24} />
              </span>
              <h3>Have you seen this person?</h3>
              <p>
                Even a small observation could help. Share it privately with authorized reviewers.
              </p>
              <Link className="button primary full" to={`/cases/${c.case_code}/sighting`}>
                Submit a sighting <ArrowRight size={16} />
              </Link>
            </div>
          )}
          <div className="panel detail-actions">
            {!privateView && (
              <>
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(window.location.href)
                      toast.success('Public case link copied.')
                    } catch {
                      toast.error('Copy is unavailable. Use your browser’s address bar.')
                    }
                  }}
                >
                  <Link2 size={17} />
                  Copy case link
                </button>
                <button onClick={() => window.print()}>
                  <Printer size={17} />
                  Print public case summary
                </button>
              </>
            )}
            <button onClick={() => setFlag(!flag)}>
              <Flag size={17} />
              {privateView ? 'Request case removal' : 'Report a concern'}
            </button>
            {flag && (
              <form onSubmit={sendConcern}>
                <Field label={privateView ? 'Reason for removal' : 'Describe your concern'}>
                  <textarea
                    required
                    minLength={5}
                    maxLength={2000}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={4}
                  />
                </Field>
                <Submit pending={busy}>Send privately</Submit>
              </form>
            )}
          </div>
          <div className="private-note">
            <ShieldCheck size={23} />
            <h3>Help safely</h3>
            <p>
              Do not approach, follow, or publicly share a person’s location. Contact authorities if
              anyone may be in danger.
            </p>
            <Link to="/safety" className="text-link">
              Read safety guidelines <ArrowRight size={14} />
            </Link>
          </div>
        </aside>
      </div>
    </>
  )
}
