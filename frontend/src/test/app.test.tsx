import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '../contexts/AuthContext'
import Auth from '../pages/Auth'
import Cases from '../pages/Cases'
import { Layout } from '../components/layout/Layout'
import { ErrorState, Skeletons } from '../components/ui'
import { Protected } from '../routes/Protected'
import { api, get } from '../services/api'
vi.mock('../services/api', async (importOriginal) => {
  const original = await importOriginal<typeof import('../services/api')>()
  return {
    ...original,
    get: vi.fn(),
    useRegions: () => ({
      data: { divisions: { Dhaka: ['Dhaka'] }, areas: [{ name: 'Dhaka', code: 'BD:Dhaka' }] },
    }),
    api: { post: vi.fn() },
  }
})
function mount(ui: React.ReactNode, path = '/') {
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={cache}>
      <MemoryRouter initialEntries={[path]}>
        <AuthProvider>{ui}</AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
describe('FindBack client workflows', () => {
  it('validates registration before sending to the backend', async () => {
    vi.mocked(get).mockResolvedValue(null)
    mount(<Auth mode="register" />)
    await userEvent.click(screen.getByRole('button', { name: /create account/i }))
    expect(await screen.findByText('Enter your full name')).toBeInTheDocument()
    expect(screen.getByText('Enter a valid email address')).toBeInTheDocument()
    expect(api.post).not.toHaveBeenCalled()
  })
  it('renders navigation, working destinations, and mobile control', async () => {
    vi.mocked(get).mockResolvedValue(null)
    mount(
      <Routes>
        <Route element={<Layout />}>
          <Route path="*" element={<p>Page content</p>} />
        </Route>
      </Routes>,
    )
    expect(screen.getByRole('link', { name: 'Active Cases' })).toHaveAttribute('href', '/cases')
    expect(screen.getByRole('link', { name: 'Report Missing' })).toHaveAttribute(
      'href',
      '/report-missing',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Open navigation' }))
    expect(screen.getByRole('button', { name: 'Close navigation' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
  })
  it('blocks a regular account from the moderation view', async () => {
    vi.mocked(get).mockResolvedValue({
      id: 'u',
      display_name: 'User',
      email: 'u@example.com',
      role: 'USER',
    })
    mount(
      <Protected roles={['MODERATOR', 'ADMIN']}>
        <p>Secret queue</p>
      </Protected>,
    )
    expect(await screen.findByText('This space is restricted')).toBeInTheDocument()
    expect(screen.queryByText('Secret queue')).not.toBeInTheDocument()
  })
  it('filters cases through server query parameters', async () => {
    vi.mocked(get).mockImplementation(async (url) =>
      url === '/auth/me' ? null : { items: [], total: 0, page: 1, page_size: 12 },
    )
    mount(<Cases />, '/cases')
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Search name or case reference' }),
      'FB-TEST',
    )
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith('/cases', expect.objectContaining({ q: 'FB-TEST' })),
    )
    await userEvent.click(screen.getByRole('button', { name: /^filters$/i }))
    expect(screen.getByLabelText('Division')).toBeInTheDocument()
    expect(await screen.findByText('No cases match your search')).toBeInTheDocument()
  })
  it('provides loading and actionable API errors', () => {
    const { unmount } = render(<Skeletons />)
    expect(screen.getByRole('status')).toHaveAttribute('aria-label', 'Loading cases')
    unmount()
    const retry = vi.fn()
    render(<ErrorState error={new Error('Database unavailable')} retry={retry} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Database unavailable')
    screen.getByRole('button', { name: /try again/i }).click()
    expect(retry).toHaveBeenCalledOnce()
  })
})
