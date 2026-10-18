import type { ReactNode } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import type { Role } from '../types'
import { Empty, Spinner } from '../components/ui'
export function Protected({ children, roles }: { children: ReactNode; roles?: Role[] }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) return <Spinner />
  if (!user)
    return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />
  if (roles && !roles.includes(user.role))
    return (
      <Empty
        title="This space is restricted"
        description="Your account does not have permission to access this page."
        action={
          <Link className="button primary" to="/dashboard">
            Go to my dashboard
          </Link>
        }
      />
    )
  return <>{children}</>
}
