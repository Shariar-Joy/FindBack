import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, LockKeyhole } from 'lucide-react'
import { api, get, message, uploadPhoto } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import type { PublicCase } from '../types'
import { ErrorState, Field, PageHeading, Spinner, Submit } from '../components/ui'
const schema = z.object({
  observed_at: z
    .string()
    .min(1, 'Choose a date and time')
    .refine((v) => new Date(v).getTime() <= Date.now(), 'Date cannot be in the future'),
  location_description: z.string().min(5, 'Describe the general area').max(500),
  notes: z.string().min(10, 'Please provide at least 10 characters').max(4000),
  safe_contact: z.string().max(254),
  consent: z.boolean().refine(Boolean, 'Please acknowledge this statement'),
})
type Values = z.infer<typeof schema>
export default function Sighting() {
  const { caseCode } = useParams()
  const { user } = useAuth()
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [savedId, setSavedId] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [uploading, setUploading] = useState(false)
  const query = useQuery({
    queryKey: ['case', caseCode],
    queryFn: () => get<PublicCase>(`/cases/${caseCode}`),
  })
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      observed_at: '',
      location_description: '',
      notes: '',
      safe_contact: '',
      consent: false,
    },
  })
  const errs = form.formState.errors
  async function attach(id: string) {
    if (!file) return
    setUploading(true)
    try {
      await uploadPhoto(`/sightings/${id}/photo`, file)
      setUploadError('')
    } catch (e) {
      setUploadError(message(e))
    } finally {
      setUploading(false)
    }
  }
  async function submit(v: Values) {
    setError('')
    try {
      const { data } = await api.post<{ id: string }>(`/cases/${caseCode}/sightings`, {
        ...v,
        observed_at: new Date(v.observed_at).toISOString(),
      })
      setSavedId(data.id)
      setDone(true)
      await attach(data.id)
    } catch (e) {
      setError(message(e))
    }
  }
  if (query.isPending) return <Spinner />
  if (query.isError) return <ErrorState error={query.error} />
  if (done)
    return (
      <div className="panel report-success">
        <CheckCircle2 size={48} className="success-text" />
        <h1>Your observation could make a difference.</h1>
        <p>
          Your sighting has been submitted privately to authorized reviewers. It will not appear on
          the public website.
        </p>
        {uploadError && (
          <div className="form-error">
            The sighting was saved, but the image failed: {uploadError}
            <button
              className="button secondary"
              disabled={uploading}
              onClick={() => attach(savedId)}
            >
              Retry image upload
            </button>
          </div>
        )}
        <Link className="button primary" to={`/cases/${caseCode}`}>
          Back to case
        </Link>
      </div>
    )
  return (
    <>
      <PageHeading
        eyebrow="A SMALL DETAIL CAN HELP"
        title="Submit a possible sighting"
        description={`Related case: ${caseCode} · ${query.data.person_name}`}
      />
      <div className="narrow-form panel">
        <div className="info-box">
          <LockKeyhole size={24} />
          <p>
            Your sighting will be submitted privately and will not appear on the public website. Do
            not approach or follow anyone.
          </p>
        </div>
        <form onSubmit={form.handleSubmit(submit)} noValidate>
          <Field label="Approximate date & time" error={errs.observed_at?.message}>
            <input type="datetime-local" {...form.register('observed_at')} />
          </Field>
          <Field label="Approximate sighting location" error={errs.location_description?.message}>
            <input
              {...form.register('location_description')}
              placeholder="General area and district"
            />
          </Field>
          <Field label="What did you observe?" error={errs.notes?.message}>
            <textarea
              rows={5}
              {...form.register('notes')}
              placeholder="Describe what you saw and why it may relate to this case…"
            />
          </Field>
          <Field label="Safe contact information (optional)" error={errs.safe_contact?.message}>
            <input
              {...form.register('safe_contact')}
              placeholder="An email or phone where reviewers can contact you"
            />
          </Field>
          {user ? (
            <Field
              label="Supporting photograph (optional)"
              hint="JPEG, PNG or WebP · Maximum 5 MB. Metadata is removed."
            >
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (
                    f &&
                    (f.size > 5242880 ||
                      !['image/jpeg', 'image/png', 'image/webp'].includes(f.type))
                  ) {
                    setError('Choose a supported image under 5 MB.')
                    e.target.value = ''
                    setFile(null)
                  } else {
                    setError('')
                    setFile(f || null)
                  }
                }}
              />
            </Field>
          ) : (
            <p className="muted">
              <Link to="/login" state={{ from: `/cases/${caseCode}/sighting` }}>
                Sign in
              </Link>{' '}
              to add a supporting photograph and track your sighting.
            </p>
          )}
          <label className="check-label">
            <input type="checkbox" {...form.register('consent')} />
            <span>
              I submit this information in good faith and consent to its private review for this
              case.
            </span>
          </label>
          {errs.consent && <p className="field-error">{errs.consent.message}</p>}
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          <div className="button-row">
            <Submit pending={form.formState.isSubmitting}>Submit private sighting</Submit>
            <Link className="button secondary" to={`/cases/${caseCode}`}>
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </>
  )
}
