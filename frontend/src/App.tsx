import { lazy, Suspense, useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { Layout } from './components/layout/Layout'
import { Spinner } from './components/ui'
import { Protected } from './routes/Protected'
import Home from './pages/Home'
import Auth from './pages/Auth'
import Cases from './pages/Cases'
import Information from './pages/Information'
const Report = lazy(() => import('./pages/ReportMissing'))
const Details = lazy(() => import('./pages/CaseDetails'))
const Sighting = lazy(() => import('./pages/Sighting'))
const MapView = lazy(() => import('./pages/MapView'))
const Alerts = lazy(() => import('./pages/Alerts'))
const Dashboard = lazy(() => import('./pages/UserDashboard'))
const Moderator = lazy(() => import('./pages/Moderator'))
const ModeratorReview = lazy(() =>
  import('./pages/Moderator').then((m) => ({ default: m.ModeratorReview })),
)
const Admin = lazy(() => import('./pages/Admin'))
export default function App() {
  const location = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
    document.title = `${location.pathname === '/' ? 'FindBack' : location.pathname.split('/')[1].replaceAll('-', ' ')} · Connecting communities`
  }, [location.pathname])
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="login" element={<Auth key="login" mode="login" />} />
          <Route path="register" element={<Auth key="register" mode="register" />} />
          <Route path="forgot-password" element={<Auth key="forgot" mode="forgot" />} />
          <Route path="reset-password" element={<Auth key="reset" mode="reset" />} />
          <Route
            path="report-missing/:caseCode?"
            element={
              <Protected>
                <Report />
              </Protected>
            }
          />
          <Route path="cases" element={<Cases />} />
          <Route path="search" element={<Cases searchTools />} />
          <Route path="cases/:caseCode" element={<Details />} />
          <Route path="cases/:caseCode/sighting" element={<Sighting />} />
          <Route path="map" element={<MapView />} />
          <Route path="alerts" element={<Alerts />} />
          <Route
            path="dashboard"
            element={
              <Protected>
                <Dashboard />
              </Protected>
            }
          />
          <Route
            path="dashboard/reports/:caseCode"
            element={
              <Protected>
                <Details privateView />
              </Protected>
            }
          />
          <Route
            path="moderator"
            element={
              <Protected roles={['MODERATOR', 'ADMIN']}>
                <Moderator />
              </Protected>
            }
          />
          <Route
            path="moderator/cases/:caseCode"
            element={
              <Protected roles={['MODERATOR', 'ADMIN']}>
                <ModeratorReview />
              </Protected>
            }
          />
          <Route
            path="admin"
            element={
              <Protected roles={['ADMIN']}>
                <Admin />
              </Protected>
            }
          />
          {['about', 'privacy', 'terms', 'safety', 'contact'].map((page) => (
            <Route path={page} key={page} element={<Information page={page} />} />
          ))}
          <Route path="*" element={<Information page="404" />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
