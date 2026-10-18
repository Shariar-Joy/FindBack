import axios from 'axios'
import { useQuery } from '@tanstack/react-query'
import type { Regions } from '../types'
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
  withCredentials: true,
  timeout: 20000,
})
api.interceptors.request.use((config) => {
  const csrf = document.cookie
    .split('; ')
    .find((x) => x.startsWith('findback_csrf='))
    ?.split('=')[1]
  if (csrf && !['get', 'head', 'options'].includes(config.method || 'get'))
    config.headers.set('X-CSRF-Token', decodeURIComponent(csrf))
  return config
})
export async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  return (await api.get<T>(url, { params })).data
}
export function message(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      { error?: { message?: string; fields?: { field: string; message: string }[] } } | undefined
    if (data?.error?.fields?.length)
      return data.error.fields
        .map((f) => `${f.field.replaceAll('_', ' ')}: ${f.message}`)
        .join(' · ')
    return (
      data?.error?.message ||
      (error.code === 'ECONNABORTED'
        ? 'The request timed out. Please try again.'
        : 'Unable to reach FindBack. Check your connection and try again.')
    )
  }
  return error instanceof Error ? error.message : 'Something went wrong.'
}
export function useRegions() {
  return useQuery({
    queryKey: ['regions'],
    queryFn: () => get<Regions>('/regions'),
    staleTime: Infinity,
  })
}
export function mediaUrl(path: string) {
  const base = import.meta.env.VITE_API_URL as string | undefined
  return base ? new URL(path, base).href : path
}
export function date(value: string | null) {
  return value
    ? new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(
        new Date(value),
      )
    : '—'
}
export async function uploadPhoto(url: string, file: File) {
  const data = new FormData()
  data.append('file', file)
  await api.post(url, data)
}
