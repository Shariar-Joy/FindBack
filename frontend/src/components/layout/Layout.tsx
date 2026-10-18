import { useState } from 'react'
import { Bell, ChevronDown, Heart, LogOut, MapPinHouse, Menu, ShieldCheck, X } from 'lucide-react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '../../contexts/AuthContext'
import { message } from '../../services/api'
export function Logo() {
  return (
    <Link className="logo" to="/" aria-label="FindBack home">
      <span className="logo-mark">
        <MapPinHouse size={26} strokeWidth={1.8} />
      </span>
      <span>
        Find<span className="brand-red">Back</span>
        <small>EVERY CONNECTION COUNTS</small>
      </span>
    </Link>
  )
}
const links = [
  ['/', 'Dashboard'],
  ['/report-missing', 'Report Missing'],
  ['/cases', 'Active Cases'],
  ['/search', 'Search Tools'],
  ['/map', 'Map View'],
  ['/alerts', 'Community Alerts'],
  ['/about', 'About'],
]
export function Layout() {
  const { user, logout } = useAuth()
  const [mobile, setMobile] = useState(false)
  const [profile, setProfile] = useState(false)
  const navigate = useNavigate()
  async function signOut() {
    try {
      await logout()
      setProfile(false)
      navigate('/')
      toast.success('You’ve been signed out.')
    } catch (e) {
      toast.error(message(e))
    }
  }
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <div className="utility-bar">
        <div className="container utility-inner">
          <span>
            <span className="status-dot" />
            Connecting Communities. Bringing People Home.
          </span>
          <Link to="/safety">
            <ShieldCheck size={13} /> Your safety comes first{' '}
            <span className="utility-country">· Bangladesh</span>
          </Link>
        </div>
      </div>
      <header className="site-header">
        <div className="container header-top">
          <Logo />
          <div className="header-actions">
            {user ? (
              <>
                <Link
                  className="icon-button"
                  to="/dashboard?tab=notifications"
                  aria-label="Notifications"
                >
                  <Bell size={20} />
                </Link>
                <div className="profile-wrap">
                  <button
                    className="profile-button"
                    aria-expanded={profile}
                    onClick={() => setProfile(!profile)}
                  >
                    <span className="avatar">{user.display_name.charAt(0)}</span>
                    <span className="profile-name">{user.display_name.split(' ')[0]}</span>
                    <ChevronDown size={14} />
                  </button>
                  {profile && (
                    <>
                      <button
                        className="dropdown-dismiss"
                        aria-label="Close profile menu"
                        onClick={() => setProfile(false)}
                      />
                      <div className="profile-menu" onClick={() => setProfile(false)}>
                        <strong>
                          {user.display_name}
                          <small>{user.role.toLowerCase()} account</small>
                        </strong>
                        {[
                          ['overview', 'My Profile'],
                          ['reports', 'My Reports'],
                          ['sightings', 'My Sightings'],
                          ['subscriptions', 'Alert Subscriptions'],
                          ['settings', 'Settings'],
                        ].map(([tab, label]) => (
                          <Link key={tab} to={`/dashboard?tab=${tab}`}>
                            {label}
                          </Link>
                        ))}
                        {user.role !== 'USER' && <Link to="/moderator">Moderation Dashboard</Link>}
                        {user.role === 'ADMIN' && <Link to="/admin">Admin Dashboard</Link>}
                        <button onClick={signOut}>
                          <LogOut size={15} /> Logout
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <>
                <Link className="login-link" to="/login">
                  Log in
                </Link>
                <Link className="button primary small" to="/register">
                  Join the community <span aria-hidden="true">↗</span>
                </Link>
              </>
            )}
            <button
              className="icon-button mobile-menu-button"
              aria-label={mobile ? 'Close navigation' : 'Open navigation'}
              aria-expanded={mobile}
              onClick={() => setMobile(!mobile)}
            >
              {mobile ? <X /> : <Menu />}
            </button>
          </div>
        </div>
        <nav aria-label="Main navigation" className={`container main-nav ${mobile ? 'open' : ''}`}>
          {links.map(([to, label]) => (
            <NavLink key={to} to={to} end={to === '/'} onClick={() => setMobile(false)}>
              {label}
            </NavLink>
          ))}
          <span className="nav-note">
            <Heart size={13} /> Powered by community
          </span>
        </nav>
      </header>
      <main id="main" className="container main-content">
        <Outlet />
      </main>
      <footer className="site-footer">
        <div className="container footer-main">
          <div>
            <Logo />
            <p>
              A little information. A stronger community.
              <br />A better chance of finding the way home.
            </p>
          </div>
          <div className="footer-links">
            {[
              ['/about', 'About FindBack'],
              ['/privacy', 'Privacy Policy'],
              ['/terms', 'Terms of Use'],
              ['/safety', 'Safety Guidelines'],
              ['/contact', 'Contact'],
            ].map(([to, text]) => (
              <Link to={to} key={to}>
                {text}
              </Link>
            ))}
          </div>
        </div>
        <div className="container footer-bottom">
          <span>© {new Date().getFullYear()} FindBack. Built around people.</span>
          <p>
            FindBack is a community assistance platform, not an official emergency response service.
          </p>
        </div>
      </footer>
    </>
  )
}
