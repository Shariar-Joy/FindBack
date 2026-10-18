import {
  ArrowRight,
  Bell,
  Check,
  Clock3,
  FilePlus2,
  HeartHandshake,
  Map,
  MapPin,
  MoveUpRight,
  Search,
  ShieldCheck,
  UsersRound,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion, useReducedMotion } from 'motion/react'
import { get, date } from '../services/api'
import type { Page, PublicCase, PublicStats } from '../types'
import { CaseCard, Empty, ErrorState, Skeletons } from '../components/ui'
import { CommunityIllustration } from '../components/dashboard/CommunityIllustration'
export default function Home() {
  const reduced = useReducedMotion()
  const stats = useQuery({
    queryKey: ['public-stats'],
    queryFn: () => get<PublicStats>('/dashboard/public-stats'),
  })
  const cases = useQuery({
    queryKey: ['recent-cases'],
    queryFn: () => get<Page<PublicCase>>('/cases', { page_size: 3, status: 'APPROVED' }),
  })
  const alerts = useQuery({
    queryKey: ['home-alerts'],
    queryFn: () => get<Page<PublicCase>>('/alerts'),
  })
  const cards = [
    {
      label: 'Active cases',
      value: stats.data?.active_cases,
      icon: UsersRound,
      tone: 'red',
      note: 'Open for community support',
    },
    {
      label: 'People found',
      value: stats.data?.people_found,
      icon: HeartHandshake,
      tone: 'green',
      note: 'Cases recorded as resolved',
    },
    {
      label: 'Community alerts',
      value: stats.data?.active_alerts,
      icon: Bell,
      tone: 'orange',
      note: 'Published cases in our network',
    },
    {
      label: 'Average response time',
      value: stats.data?.average_response_hours ? `${stats.data.average_response_hours}h` : '—',
      icon: Clock3,
      tone: 'blue',
      note: 'Not enough data to measure',
    },
  ]
  return (
    <>
      <div className="welcome-row">
        <div>
          <span className="eyebrow">A COMMUNITY THAT CARES</span>
          <h1>Together, we can make a difference.</h1>
        </div>
        <span className="region-chip">
          <MapPin size={14} /> Bangladesh network
        </span>
      </div>
      <motion.section
        className="hero"
        initial={reduced ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="hero-copy">
          <span className="hero-kicker">
            <span className="white-dot" /> HOPE STARTS WITH A CONNECTION
          </span>
          <h2>
            Helping missing people
            <br />
            find their way <span>home.</span>
          </h2>
          <p>
            FindBack connects families, communities, and volunteers through secure reports,
            community sightings, and location-based alerts.
          </p>
          <div className="hero-actions">
            <Link to="/report-missing" className="button white">
              <FilePlus2 size={17} /> Report Missing Person <ArrowRight size={16} />
            </Link>
            <Link to="/cases" className="hero-secondary">
              Explore active cases <MoveUpRight size={16} />
            </Link>
          </div>
          <div className="hero-trust">
            <ShieldCheck size={14} /> Private by default <span /> Reviewed before publication{' '}
            <span /> Community powered
          </div>
        </div>
        <CommunityIllustration />
      </motion.section>
      <div className="stats-grid">
        {cards.map(({ label, value, icon: Icon, tone, note }) => (
          <div className="stat-card" key={label}>
            <div>
              <p>{label}</p>
              <strong>
                {stats.isPending ? (
                  <span className="skeleton stat-skeleton" />
                ) : stats.isError ? (
                  '—'
                ) : (
                  (value ?? 0)
                )}
              </strong>
              <small>{note}</small>
            </div>
            <span className={`stat-icon ${tone}`}>
              <Icon size={21} />
            </span>
          </div>
        ))}
      </div>
      {stats.isError && <ErrorState error={stats.error} retry={() => stats.refetch()} />}
      <div className="home-columns">
        <section className="recent-section">
          <div className="section-heading">
            <div>
              <h2>Every face has a story</h2>
              <p>Recent cases approved for community support.</p>
            </div>
            <Link className="text-link" to="/cases">
              View all cases <ArrowRight size={15} />
            </Link>
          </div>
          {cases.isPending ? (
            <Skeletons />
          ) : cases.isError ? (
            <ErrorState error={cases.error} retry={() => cases.refetch()} />
          ) : cases.data.items.length ? (
            <div className="case-grid home-case-grid">
              {cases.data.items.map((c) => (
                <CaseCard key={c.case_code} item={c} />
              ))}
            </div>
          ) : (
            <div className="panel">
              <Empty
                title="No public cases right now"
                description="Approved reports will appear here. Every submission is reviewed before it reaches the community."
                action={
                  <Link className="button secondary" to="/report-missing">
                    Submit a report <ArrowRight size={15} />
                  </Link>
                }
              />
            </div>
          )}
          <div className="publication-note">
            <ShieldCheck size={14} /> Publication approval means reviewed for sharing, not official
            verification.
          </div>
        </section>
        <aside className="alerts-panel panel">
          <div className="section-heading">
            <h2>
              <span className="mini-icon orange">
                <Bell size={17} />
              </span>
              Community alerts
            </h2>
            <span className="live-label">
              <span className="status-dot" />
              LATEST
            </span>
          </div>
          <p className="muted">Local awareness. Meaningful action.</p>
          {alerts.isPending ? (
            <div className="skeleton alert-skeleton" />
          ) : alerts.isError ? (
            <ErrorState error={alerts.error} />
          ) : alerts.data.items.length ? (
            <div className="home-alerts">
              {alerts.data.items.slice(0, 3).map((c) => (
                <Link key={c.case_code} to={`/cases/${c.case_code}`}>
                  <span className="alert-pin">
                    <MapPin size={17} />
                  </span>
                  <div>
                    <strong>Community alert in {c.district}</strong>
                    <p>
                      {c.case_code} {c.is_demo ? '· Demo case' : ''}
                    </p>
                    <small>{date(c.published_at)}</small>
                  </div>
                  <ArrowRight size={14} />
                </Link>
              ))}
            </div>
          ) : (
            <Empty
              title="You’re all caught up"
              description="Newly published community alerts will appear here."
            />
          )}
          <div className="alert-subscribe">
            <div className="mini-icon red">
              <MapPin size={19} />
            </div>
            <h3>Stay connected to your area</h3>
            <p>Choose the districts you care about and receive relevant email alerts.</p>
            <Link className="button secondary full" to="/alerts">
              Manage area alerts <ArrowRight size={15} />
            </Link>
          </div>
        </aside>
      </div>
      <section className="quick-section">
        <div className="section-heading">
          <div>
            <h2>A small action can go a long way</h2>
            <p>There’s more than one way to help someone find their way home.</p>
          </div>
          <span className="subtle-label">HOW WILL YOU HELP TODAY?</span>
        </div>
        <div className="quick-grid">
          {[
            {
              to: '/report-missing',
              title: 'Report a missing person',
              text: 'Start a secure report. We’ll guide you through each step.',
              icon: FilePlus2,
              tone: 'red',
            },
            {
              to: '/cases?mode=sighting',
              title: 'Share a possible sighting',
              text: 'Seen someone? Pass information to reviewers privately.',
              icon: Search,
              tone: 'orange',
            },
            {
              to: '/map',
              title: 'Explore the search map',
              text: 'See published cases by their approximate general area.',
              icon: Map,
              tone: 'blue',
            },
          ].map(({ to, title, text, icon: Icon, tone }) => (
            <Link to={to} className="quick-card" key={to}>
              <span className={`stat-icon ${tone}`}>
                <Icon size={24} />
              </span>
              <div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
              <ArrowRight size={18} />
            </Link>
          ))}
        </div>
      </section>
      <section className="how-section">
        <div className="how-intro">
          <span className="eyebrow">BUILT ON TRUST</span>
          <h2>
            A safer way to
            <br />
            bring people together.
          </h2>
          <Link to="/about" className="text-link">
            How FindBack works <ArrowRight size={15} />
          </Link>
        </div>
        <div className="steps-grid">
          {[
            { title: 'Submit a report', text: 'Share the details through a guided, private form.' },
            {
              title: 'A moderator reviews',
              text: 'Information is checked for safe public sharing.',
            },
            {
              title: 'Your community is alerted',
              text: 'Subscribers in the area receive the approved case.',
            },
            {
              title: 'Share possible sightings',
              text: 'Helpful observations go privately to reviewers.',
            },
          ].map((s, i) => (
            <div className="how-step" key={s.title}>
              <span className="step-number">
                0{i + 1}
                {i === 3 && <Check size={13} />}
              </span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </div>
          ))}
        </div>
      </section>
      <div className="emergency-note">
        <ShieldCheck size={20} />
        <p>
          <strong>In an emergency, contact the appropriate local authorities first.</strong>{' '}
          FindBack supports community awareness and does not replace emergency or law enforcement
          services.
        </p>
        <Link to="/safety">
          Stay safe <ArrowRight size={15} />
        </Link>
      </div>
    </>
  )
}
