import { cloneElement, isValidElement, useId, type ReactNode } from 'react'
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Inbox,
  LoaderCircle,
  MapPin,
  UserRound,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import type { PublicCase } from '../../types'
import { date, mediaUrl, message } from '../../services/api'

export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  )
}
export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <div className="error-state" role="alert">
      <CircleAlert size={24} />
      <div>
        <strong>We couldn’t load this information</strong>
        <p>{message(error)}</p>
        {retry && (
          <button className="text-button" onClick={retry}>
            Try again <ArrowRight size={14} />
          </button>
        )}
      </div>
    </div>
  )
}
export function Empty({
  title = 'A little quiet here',
  description,
  action,
}: {
  title?: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Inbox size={30} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  )
}
export function Skeletons({ count = 3 }: { count?: number }) {
  return (
    <div className="case-grid" aria-label="Loading cases" role="status">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="panel skeleton-card">
          <div className="skeleton image" />
          <div className="skeleton line" />
          <div className="skeleton line short" />
        </div>
      ))}
    </div>
  )
}
export function Spinner() {
  return (
    <div className="spinner" role="status" aria-label="Loading">
      <LoaderCircle className="spin" size={28} />
    </div>
  )
}
export function Badge({ status }: { status: string }) {
  return (
    <span className={`badge ${status.toLowerCase()}`}>
      {status === 'APPROVED' ? 'Active · Published' : status.replaceAll('_', ' ').toLowerCase()}
    </span>
  )
}
export function Safety({ children }: { children?: ReactNode }) {
  return (
    <div className="safety">
      <CheckCircle2 size={19} />
      <p>
        {children ||
          'Approved for publication, not independently or officially verified. Share possible sightings privately and contact appropriate authorities in an emergency.'}
      </p>
    </div>
  )
}
export function PersonImage({ item, large = false }: { item: PublicCase; large?: boolean }) {
  return item.photo_url ? (
    <img
      className={`person-image ${large ? 'large' : ''}`}
      src={mediaUrl(item.photo_url)}
      alt={`Published photograph of ${item.person_name}`}
    />
  ) : (
    <div
      className={`person-placeholder tone-${item.case_code.charCodeAt(item.case_code.length - 1) % 4} ${large ? 'large' : ''}`}
    >
      <div className="portrait-orbit" />
      <UserRound strokeWidth={1} size={large ? 150 : 85} />
      <span>{item.is_demo ? 'Fictional person · illustration' : 'No approved photograph'}</span>
    </div>
  )
}
export function CaseCard({ item }: { item: PublicCase }) {
  return (
    <article className="case-card">
      <Link
        to={`/cases/${item.case_code}`}
        className="case-image-link"
        aria-label={`View ${item.person_name}`}
      >
        <PersonImage item={item} />
        <div className="image-badges">
          <Badge status={item.status} />
          {item.is_demo && <span className="demo-badge">DEMO</span>}
        </div>
      </Link>
      <div className="case-body">
        <div className="case-reference">{item.case_code}</div>
        <div className="case-title">
          <h3>
            <Link to={`/cases/${item.case_code}`}>{item.person_name}</Link>
          </h3>
          {item.approximate_age !== null && <span>{item.approximate_age} years</span>}
        </div>
        <p className="icon-line">
          <MapPin size={14} />
          {item.area_name}, {item.district}
        </p>
        <div className="case-bottom">
          <span>Last seen {date(item.last_seen_date)}</span>
          <Link to={`/cases/${item.case_code}`} aria-label={`Details for ${item.person_name}`}>
            <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    </article>
  )
}
export function Pagination({
  page,
  total,
  size,
  onChange,
}: {
  page: number
  total: number
  size: number
  onChange: (n: number) => void
}) {
  const pages = Math.max(1, Math.ceil(total / size))
  return (
    <div className="pagination">
      <span>
        {total} result{total !== 1 ? 's' : ''} · Page {page} of {pages}
      </span>
      <div>
        <button
          className="button secondary small"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          Previous
        </button>
        <button
          className="button secondary small"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  )
}
export function Field({
  label,
  children,
  error,
  hint,
}: {
  label: string
  children: ReactNode
  error?: string
  hint?: string
}) {
  const generatedId = useId()
  const control = isValidElement<{
    id?: string
    'aria-describedby'?: string
    'aria-invalid'?: boolean
  }>(children)
    ? children
    : null
  const id = control?.props.id || generatedId
  const description =
    [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {control
        ? cloneElement(control, { id, 'aria-describedby': description, 'aria-invalid': !!error })
        : children}
      {hint && <small id={`${id}-hint`}>{hint}</small>}
      {error && (
        <small id={`${id}-error`} className="field-error" role="alert">
          {error}
        </small>
      )}
    </div>
  )
}
export function Submit({ pending, children }: { pending: boolean; children: ReactNode }) {
  return (
    <button className="button primary" type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="spin" size={17} /> : null}
      {pending ? 'Please wait…' : children}
    </button>
  )
}
