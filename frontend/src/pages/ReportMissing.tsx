import { useEffect, useState } from 'react'
import { useForm, type FieldPath } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  FileText,
  ImagePlus,
  LockKeyhole,
  ShieldCheck,
  X,
} from 'lucide-react'
import { api, get, message, uploadPhoto, useRegions } from '../services/api'
import type { PrivateCase } from '../types'
import { ErrorState, Field, PageHeading, Spinner } from '../components/ui'
const schema = z.object({
  person_name: z.string().min(2, 'Enter the person’s name').max(120),
  approximate_age: z
    .string()
    .refine(
      (v) => !v || (+v >= 0 && +v <= 120 && Number.isInteger(+v)),
      'Enter an age between 0 and 120',
    ),
  description: z.string().min(10, 'Please add at least 10 characters').max(4000),
  clothing_description: z.string().min(3, 'Describe their clothing').max(2000),
  last_seen_at: z
    .string()
    .min(1, 'Choose a date and time')
    .refine((v) => new Date(v).getTime() <= Date.now(), 'Date cannot be in the future'),
  division: z.string().min(1, 'Select a division'),
  district: z.string().min(1, 'Select a district'),
  city: z.string().min(2, 'Enter a city or upazila'),
  area_name: z.string().min(2, 'Enter a general area').max(160),
  additional_context: z.string().max(4000),
  relationship: z.string().min(2, 'Enter your relationship'),
  private_contact_method: z.enum(['email', 'phone']),
  private_contact_value: z.string().min(5, 'Enter a safe contact').max(254),
  privacy: z.boolean().refine(Boolean, 'Please acknowledge the privacy guidance'),
  good_faith: z.boolean().refine(Boolean, 'Confirm this statement'),
  authority: z.boolean().refine(Boolean, 'Confirm this statement'),
  moderation: z.boolean().refine(Boolean, 'Confirm this statement'),
  policy: z.boolean().refine(Boolean, 'Confirm this statement'),
})
type Values = z.infer<typeof schema>
const steps = [
  { title: 'Person information', subtitle: 'Who are we looking for?' },
  { title: 'Last seen', subtitle: 'A place to start' },
  { title: 'Your information', subtitle: 'A safe way to reach you' },
  { title: 'Review & submit', subtitle: 'One final check' },
]
const fields: FieldPath<Values>[][] = [
  ['person_name', 'approximate_age', 'description', 'clothing_description'],
  ['last_seen_at', 'division', 'district', 'city', 'area_name', 'additional_context'],
  ['relationship', 'private_contact_method', 'private_contact_value', 'privacy'],
  ['good_faith', 'authority', 'moderation', 'policy'],
]
export default function ReportMissing() {
  const { caseCode } = useParams()
  const cache = useQueryClient()
  const regions = useRegions()
  const [step, setStep] = useState(0)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [uploading, setUploading] = useState(false)
  const existing = useQuery({
    queryKey: ['own-case', caseCode],
    queryFn: () => get<PrivateCase>(`/me/cases/${caseCode}`),
    enabled: !!caseCode,
  })
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      person_name: '',
      approximate_age: '',
      description: '',
      clothing_description: '',
      last_seen_at: '',
      division: '',
      district: '',
      city: '',
      area_name: '',
      additional_context: '',
      relationship: '',
      private_contact_method: 'email',
      private_contact_value: '',
      privacy: false,
      good_faith: false,
      authority: false,
      moderation: false,
      policy: false,
    },
  })
  useEffect(() => {
    if (existing.data) {
      const c = existing.data
      const local = new Date(c.last_seen_at)
      local.setMinutes(local.getMinutes() - local.getTimezoneOffset())
      form.reset({
        ...form.getValues(),
        ...c,
        approximate_age: c.approximate_age?.toString() || '',
        last_seen_at: local.toISOString().slice(0, 16),
        relationship: c.contact?.relationship || '',
        private_contact_method: c.contact?.method === 'phone' ? 'phone' : 'email',
        private_contact_value: c.contact?.value || '',
      })
    }
  }, [existing.data, form])
  useEffect(() => {
    if (!file) {
      setPreview('')
      return
    }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])
  function chooseFile(f: File | undefined) {
    if (!f) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type) || f.size > 5 * 1024 * 1024) {
      setError('Choose a JPEG, PNG or WebP image under 5 MB.')
      return
    }
    setError('')
    setFile(f)
  }
  async function sendPhoto(code: string) {
    if (!file) return
    setUploading(true)
    try {
      await uploadPhoto(`/cases/${code}/photo`, file)
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
      const { privacy, good_faith, authority, moderation, policy, ...rest } = v
      void privacy
      void good_faith
      void authority
      void moderation
      void policy
      const payload = {
        ...rest,
        approximate_age: v.approximate_age ? +v.approximate_age : null,
        last_seen_at: new Date(v.last_seen_at).toISOString(),
        acknowledgement: true,
      }
      const code =
        caseCode || (await api.post<{ case_code: string }>('/cases', payload)).data.case_code
      if (caseCode) await api.put(`/me/cases/${caseCode}`, payload)
      setSuccess(code)
      await sendPhoto(code)
      cache.invalidateQueries({ queryKey: ['my-cases'] })
      cache.invalidateQueries({ queryKey: ['user-stats'] })
    } catch (e) {
      setError(message(e))
    }
  }
  async function next() {
    if (await form.trigger(fields[step], { shouldFocus: true })) {
      setStep((s) => s + 1)
      window.scrollTo({ top: 140, behavior: 'smooth' })
    }
  }
  const values = form.watch()
  const errs = form.formState.errors
  if (caseCode && existing.isPending) return <Spinner />
  if (caseCode && existing.isError) return <ErrorState error={existing.error} />
  if (success)
    return (
      <div className="report-success panel">
        <span className="success-icon">
          <CheckCircle2 size={42} />
        </span>
        <span className="eyebrow">YOUR REPORT IS IN SAFE HANDS</span>
        <h1>Thank you for taking the first step.</h1>
        <p>
          Your report has been saved privately. A moderator will review it before anything is
          published.
        </p>
        <div className="reference-box">
          <small>Your case reference</small>
          <strong>{success}</strong>
          <span>Keep this reference for your records.</span>
        </div>
        {uploadError && (
          <div className="form-error" role="alert">
            Your report was saved, but the photo upload failed: {uploadError}
            <button
              className="button secondary small"
              disabled={uploading}
              onClick={() => sendPhoto(success)}
            >
              Retry photo upload
            </button>
          </div>
        )}
        <div className="button-row">
          <Link className="button primary" to={`/dashboard/reports/${success}`}>
            View my private report <ArrowRight size={16} />
          </Link>
          <Link to="/dashboard" className="button secondary">
            My dashboard
          </Link>
        </div>
        <p className="muted">If someone is in immediate danger, contact local authorities.</p>
      </div>
    )
  return (
    <>
      <PageHeading
        eyebrow="A FIRST STEP TOWARD HOME"
        title={caseCode ? 'Update your private report' : 'Report a missing person'}
        description="Share what you know. We’ll help you submit a clear, safe report."
      />
      <div className="report-layout">
        <aside>
          <div className="step-list">
            {steps.map((s, i) => (
              <div
                className={`report-step ${step === i ? 'current' : ''} ${step > i ? 'complete' : ''}`}
                key={s.title}
              >
                <span>{step > i ? <Check size={17} /> : i + 1}</span>
                <div>
                  <strong>{s.title}</strong>
                  <small>{s.subtitle}</small>
                </div>
              </div>
            ))}
          </div>
          <div className="private-note">
            <LockKeyhole size={24} />
            <h3>Private until reviewed</h3>
            <p>
              Your contact details stay private. A moderator checks your report before it is shared
              with the community.
            </p>
            <Link to="/privacy" className="text-link">
              Our privacy promise <ArrowRight size={13} />
            </Link>
          </div>
        </aside>
        <form
          className="panel report-form"
          onSubmit={form.handleSubmit(submit, () =>
            setError('Please check the highlighted information.'),
          )}
          noValidate
        >
          <div className="form-section-title">
            <span>STEP {step + 1} OF 4</span>
            <h2>{steps[step].title}</h2>
            <p>
              {
                [
                  'Help the community recognize the person.',
                  'Please share general areas, not exact private addresses.',
                  'These details are only available to you and authorized reviewers.',
                  'Check the information below before sending your report.',
                ][step]
              }
            </p>
          </div>
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          {step === 0 && (
            <>
              <div className="form-grid">
                <Field label="Person’s full name" error={errs.person_name?.message}>
                  <input
                    {...form.register('person_name')}
                    placeholder="Name of the missing person"
                  />
                </Field>
                <Field label="Approximate age (optional)" error={errs.approximate_age?.message}>
                  <input
                    type="number"
                    min="0"
                    max="120"
                    {...form.register('approximate_age')}
                    placeholder="Age in years"
                  />
                </Field>
              </div>
              <Field label="Physical description" error={errs.description?.message}>
                <textarea
                  rows={4}
                  {...form.register('description')}
                  placeholder="Height, hair, build, and other helpful identifying details…"
                />
              </Field>
              <Field label="Clothing when last seen" error={errs.clothing_description?.message}>
                <textarea
                  rows={3}
                  {...form.register('clothing_description')}
                  placeholder="Clothing, colours, shoes or accessories…"
                />
              </Field>
              <div className="field">
                <span>Photograph (optional)</span>
                {preview ? (
                  <div className="upload-preview">
                    <img src={preview} alt="Selected photograph preview" />
                    <button
                      type="button"
                      className="icon-button"
                      aria-label="Remove selected photo"
                      onClick={() => setFile(null)}
                    >
                      <X size={17} />
                    </button>
                    <span>{file?.name}</span>
                  </div>
                ) : (
                  <label className="upload-zone">
                    <ImagePlus size={29} />
                    <strong>Choose a clear photograph</strong>
                    <span>JPEG, PNG or WebP · Maximum 5 MB</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => chooseFile(e.target.files?.[0])}
                    />
                  </label>
                )}
                <small>
                  Images are private until reviewed. Location metadata is removed automatically.
                </small>
              </div>
            </>
          )}
          {step === 1 && (
            <>
              <Field label="Last-seen date & approximate time" error={errs.last_seen_at?.message}>
                <input type="datetime-local" {...form.register('last_seen_at')} />
              </Field>
              {regions.isError && (
                <ErrorState error={regions.error} retry={() => regions.refetch()} />
              )}
              <div className="form-grid">
                <Field label="Division" error={errs.division?.message}>
                  <select
                    {...form.register('division', {
                      onChange: () => form.setValue('district', ''),
                    })}
                  >
                    <option value="">Select division</option>
                    {Object.keys(regions.data?.divisions || {}).map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                </Field>
                <Field label="District" error={errs.district?.message}>
                  <select {...form.register('district')} disabled={!values.division}>
                    <option value="">Select district</option>
                    {regions.data?.divisions[values.division]?.map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                </Field>
                <Field label="City / Upazila" error={errs.city?.message}>
                  <input {...form.register('city')} placeholder="City or upazila" />
                </Field>
                <Field label="General area" error={errs.area_name?.message}>
                  <input
                    {...form.register('area_name')}
                    placeholder="Neighbourhood or general locality"
                  />
                </Field>
              </div>
              <Field label="Additional context (optional)" error={errs.additional_context?.message}>
                <textarea
                  rows={4}
                  {...form.register('additional_context')}
                  placeholder="Any other information that could help…"
                />
              </Field>
            </>
          )}
          {step === 2 && (
            <>
              <Field label="Your relationship to this person" error={errs.relationship?.message}>
                <input
                  {...form.register('relationship')}
                  placeholder="For example: parent, sibling, authorized representative"
                />
              </Field>
              <div className="form-grid">
                <Field label="Safe contact method">
                  <select {...form.register('private_contact_method')}>
                    <option value="email">Email</option>
                    <option value="phone">Phone</option>
                  </select>
                </Field>
                <Field
                  label={
                    values.private_contact_method === 'email'
                      ? 'Private email address'
                      : 'Private phone number'
                  }
                  error={errs.private_contact_value?.message}
                >
                  <input
                    {...form.register('private_contact_value')}
                    type={values.private_contact_method === 'email' ? 'email' : 'tel'}
                    placeholder={
                      values.private_contact_method === 'email' ? 'you@example.com' : '+880…'
                    }
                  />
                </Field>
              </div>
              <div className="info-box">
                <ShieldCheck size={20} />
                <p>
                  Your contact information will never appear on the public case page. Only
                  authorized reviewers can use it to follow up.
                </p>
              </div>
              <label className="check-label">
                <input type="checkbox" {...form.register('privacy')} />
                <span>
                  I understand how my information will be used and consent to its private use for
                  this report.
                </span>
              </label>
              {errs.privacy && <p className="field-error">{errs.privacy.message}</p>}
            </>
          )}
          {step === 3 && (
            <>
              <div className="review-summary">
                <FileText size={25} />
                <h3>{values.person_name}</h3>
                <dl>
                  {[
                    ['Approximate age', values.approximate_age || 'Not provided'],
                    ['Last seen', values.last_seen_at.replace('T', ' at ')],
                    ['Area', `${values.area_name}, ${values.city}, ${values.district}`],
                    ['Physical description', values.description],
                    ['Clothing', values.clothing_description],
                    ['Private contact', values.private_contact_value],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              {(
                [
                  ['good_faith', 'I confirm this information is submitted in good faith.'],
                  [
                    'authority',
                    'I have appropriate authority or a legitimate basis to submit this report.',
                  ],
                  [
                    'moderation',
                    'I understand that review approves publication and does not officially verify the information.',
                  ],
                  ['policy', 'I agree to the privacy policy and the safe use of this platform.'],
                ] as const
              ).map(([key, label]) => (
                <div key={key}>
                  <label className="check-label">
                    <input type="checkbox" {...form.register(key)} />
                    <span>{label}</span>
                  </label>
                  {errs[key] && <p className="field-error">{errs[key]?.message}</p>}
                </div>
              ))}
            </>
          )}
          <div className="form-navigation">
            <button
              type="button"
              className="button secondary"
              disabled={step === 0 || form.formState.isSubmitting}
              onClick={() => setStep(step - 1)}
            >
              <ArrowLeft size={16} /> Back
            </button>
            <span>All fields are required unless marked optional</span>
            {step < 3 ? (
              <button className="button primary" type="button" onClick={next}>
                Continue <ArrowRight size={16} />
              </button>
            ) : (
              <button
                type="submit"
                className="button primary"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? 'Submitting…' : 'Submit private report'}{' '}
                <ShieldCheck size={16} />
              </button>
            )}
          </div>
        </form>
      </div>
    </>
  )
}
