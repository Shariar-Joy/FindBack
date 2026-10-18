import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, MapPin, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { api, get, message, useRegions } from '../../services/api'
import type { Subscription } from '../../types'
import { Empty, ErrorState, Spinner } from '../ui'
export function Subscriptions() {
  const [area, setArea] = useState('')
  const cache = useQueryClient()
  const regions = useRegions()
  const query = useQuery({
    queryKey: ['subscriptions'],
    queryFn: () => get<Subscription[]>('/me/subscriptions'),
  })
  const add = useMutation({
    mutationFn: () => api.post('/me/subscriptions', { area_code: area }),
    onSuccess: () => {
      cache.invalidateQueries({ queryKey: ['subscriptions'] })
      setArea('')
      toast.success('District subscription added.')
    },
    onError: (e) => toast.error(message(e)),
  })
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/me/subscriptions/${id}`),
    onSuccess: () => {
      cache.invalidateQueries({ queryKey: ['subscriptions'] })
      toast.success('Subscription removed.')
    },
    onError: (e) => toast.error(message(e)),
  })
  return (
    <div className="panel padded-panel">
      <div className="section-heading">
        <div>
          <h2>
            <Bell size={20} /> Your area alerts
          </h2>
          <p>
            Choose the districts you care about. New publication alerts go to your account email.
          </p>
        </div>
      </div>
      <form
        className="subscription-form"
        onSubmit={(e) => {
          e.preventDefault()
          if (area) add.mutate()
        }}
      >
        <label className="sr-only" htmlFor="subscription-area">
          District to subscribe
        </label>
        <select
          id="subscription-area"
          value={area}
          required
          onChange={(e) => setArea(e.target.value)}
        >
          <option value="">Choose a district</option>
          {regions.data?.areas
            .filter((a) => !query.data?.some((s) => s.area_code === a.code))
            .map((a) => (
              <option value={a.code} key={a.code}>
                {a.name} · {a.division}
              </option>
            ))}
        </select>
        <button className="button primary" disabled={!area || add.isPending}>
          <Plus size={17} />
          Subscribe
        </button>
      </form>
      {regions.isError && <ErrorState error={regions.error} retry={() => regions.refetch()} />}{' '}
      {query.isPending ? (
        <Spinner />
      ) : query.isError ? (
        <ErrorState error={query.error} />
      ) : query.data.length ? (
        <div className="subscription-list">
          {query.data.map((s) => (
            <div key={s.id}>
              <span className="mini-icon red">
                <MapPin size={18} />
              </span>
              <strong>{s.area_name}</strong>
              <span>Email alerts</span>
              <button
                className="icon-button"
                aria-label={`Unsubscribe from ${s.area_name}`}
                disabled={remove.isPending}
                onClick={() => remove.mutate(s.id)}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <Empty
          title="Make your community a little closer"
          description="Add a district to receive relevant alerts when a case is approved for publication."
        />
      )}
      <p className="muted small-text">
        Email delivery depends on your notification preference. Pending and rejected reports never
        generate community alerts.
      </p>
    </div>
  )
}
