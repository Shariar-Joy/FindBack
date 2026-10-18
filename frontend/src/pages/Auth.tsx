import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, ArrowRight, HeartHandshake, LockKeyhole, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { api, message } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { Field, Submit } from '../components/ui'
const password = z
  .string()
  .min(12, 'Use at least 12 characters')
  .max(128)
  .regex(/[A-Z]/, 'Include an uppercase letter')
  .regex(/[a-z]/, 'Include a lowercase letter')
  .regex(/[0-9]/, 'Include a number')
const schema = z.object({
  display_name: z.string(),
  email: z.string(),
  password: z.string(),
  confirm: z.string(),
  accept: z.boolean(),
  remember: z.boolean(),
})
type Values = z.infer<typeof schema>
export default function Auth({ mode }: { mode: 'login' | 'register' | 'forgot' | 'reset' }) {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const [error, setError] = useState('')
  const [done, setDone] = useState('')
  const [token] = useState(
    () =>
      new URLSearchParams(window.location.hash.slice(1)).get('token') || params.get('token') || '',
  )
  useEffect(() => {
    if (mode === 'reset' && window.location.hash)
      window.history.replaceState(null, '', window.location.pathname)
  }, [mode])
  const form = useForm<Values>({
    resolver: zodResolver(
      schema.superRefine((v, c) => {
        if (mode === 'login' || mode === 'register' || mode === 'forgot') {
          if (!z.email().safeParse(v.email).success)
            c.addIssue({ code: 'custom', path: ['email'], message: 'Enter a valid email address' })
        }
        if (mode === 'register') {
          if (v.display_name.trim().length < 2)
            c.addIssue({ code: 'custom', path: ['display_name'], message: 'Enter your full name' })
          if (!v.accept)
            c.addIssue({
              code: 'custom',
              path: ['accept'],
              message: 'Please accept the terms and privacy policy',
            })
        }
        if (mode === 'register' || mode === 'reset') {
          const result = password.safeParse(v.password)
          if (!result.success)
            c.addIssue({
              code: 'custom',
              path: ['password'],
              message: result.error.issues[0].message,
            })
          if (v.password !== v.confirm)
            c.addIssue({ code: 'custom', path: ['confirm'], message: 'Passwords must match' })
        }
        if (mode === 'login' && !v.password)
          c.addIssue({ code: 'custom', path: ['password'], message: 'Enter your password' })
      }),
    ),
    defaultValues: {
      display_name: '',
      email: '',
      password: '',
      confirm: '',
      accept: false,
      remember: false,
    },
  })
  const titles = {
    login: ['Welcome back.', 'Sign in to stay connected with your community.'],
    register: [
      'A stronger community starts with you.',
      'Create your FindBack account. It only takes a moment.',
    ],
    forgot: ['Let’s get you back in.', 'We’ll email you a private password reset link.'],
    reset: ['A fresh start.', 'Choose a strong new password for your account.'],
  }
  async function submit(v: Values) {
    setError('')
    try {
      if (mode === 'login') {
        await login({ email: v.email, password: v.password, remember: v.remember })
        const target = (location.state as { from?: string } | null)?.from
        navigate(target?.startsWith('/') && !target.startsWith('//') ? target : '/dashboard')
        toast.success('Welcome back.')
      } else if (mode === 'register') {
        const r = await api.post<{ message: string }>('/auth/register', {
          display_name: v.display_name,
          email: v.email,
          password: v.password,
          accept_terms: v.accept,
        })
        setDone(r.data.message)
      } else if (mode === 'forgot') {
        setDone(
          (await api.post<{ message: string }>('/auth/forgot-password', { email: v.email })).data
            .message,
        )
      } else {
        setDone(
          (
            await api.post<{ message: string }>('/auth/reset-password', {
              token,
              password: v.password,
            })
          ).data.message,
        )
      }
    } catch (e) {
      setError(message(e))
    }
  }
  return (
    <div className="auth-shell">
      <aside className="auth-story">
        <div className="auth-story-icon">
          <HeartHandshake size={50} strokeWidth={1.2} />
        </div>
        <span className="eyebrow">EVERY CONNECTION COUNTS</span>
        <h2>
          Hope is stronger
          <br />
          when we’re connected.
        </h2>
        <p>
          Join a community of people helping families find their way forward, one safe connection at
          a time.
        </p>
        <div className="auth-values">
          <span>
            <ShieldCheck size={18} /> Your personal details stay private
          </span>
          <span>
            <LockKeyhole size={18} /> Secure, thoughtful, community first
          </span>
        </div>
      </aside>
      <div className="auth-form">
        <Link to="/" className="text-link muted">
          <ArrowLeft size={14} /> Back to FindBack
        </Link>
        <h1>{titles[mode][0]}</h1>
        <p className="muted">{titles[mode][1]}</p>
        {done ? (
          <div className="success-box" role="status">
            <ShieldCheck size={32} />
            <h3>All set</h3>
            <p>{done}</p>
            <Link to="/login" className="button primary">
              Go to login <ArrowRight size={16} />
            </Link>
          </div>
        ) : (
          <form onSubmit={form.handleSubmit(submit)} noValidate>
            {mode === 'register' && (
              <Field label="Full name" error={form.formState.errors.display_name?.message}>
                <input
                  autoComplete="name"
                  {...form.register('display_name')}
                  placeholder="Your full name"
                />
              </Field>
            )}
            {mode !== 'reset' && (
              <Field label="Email address" error={form.formState.errors.email?.message}>
                <input
                  type="email"
                  autoComplete="email"
                  {...form.register('email')}
                  placeholder="you@example.com"
                />
              </Field>
            )}
            {mode !== 'forgot' && (
              <Field
                label={mode === 'reset' ? 'New password' : 'Password'}
                error={form.formState.errors.password?.message}
                hint={
                  mode === 'register' || mode === 'reset'
                    ? 'At least 12 characters with uppercase, lowercase and a number.'
                    : undefined
                }
              >
                <input
                  type="password"
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  {...form.register('password')}
                  placeholder="Enter your password"
                />
              </Field>
            )}
            {(mode === 'register' || mode === 'reset') && (
              <Field label="Confirm password" error={form.formState.errors.confirm?.message}>
                <input
                  type="password"
                  autoComplete="new-password"
                  {...form.register('confirm')}
                  placeholder="Repeat your password"
                />
              </Field>
            )}
            {mode === 'login' && (
              <div className="form-inline">
                <label className="check-label">
                  <input type="checkbox" {...form.register('remember')} />
                  Remember this session
                </label>
                <Link className="text-link" to="/forgot-password">
                  Forgot password?
                </Link>
              </div>
            )}
            {mode === 'register' && (
              <>
                <label className="check-label">
                  <input type="checkbox" {...form.register('accept')} />
                  <span>
                    I agree to the <Link to="/terms">Terms</Link> and{' '}
                    <Link to="/privacy">Privacy Policy</Link>.
                  </span>
                </label>
                {form.formState.errors.accept && (
                  <p className="field-error">{form.formState.errors.accept.message}</p>
                )}
              </>
            )}
            {error && (
              <div className="form-error" role="alert">
                {error}
              </div>
            )}
            <Submit pending={form.formState.isSubmitting}>
              {mode === 'login'
                ? 'Sign in'
                : mode === 'register'
                  ? 'Create account'
                  : mode === 'forgot'
                    ? 'Send reset link'
                    : 'Update password'}{' '}
              <ArrowRight size={16} />
            </Submit>
          </form>
        )}
        {mode === 'login' ? (
          <p className="auth-switch">
            New to FindBack? <Link to="/register">Join the community</Link>
          </p>
        ) : (
          <p className="auth-switch">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        )}
        <p className="auth-footnote">
          <ShieldCheck size={14} /> Your information is handled with care.
        </p>
      </div>
    </div>
  )
}
