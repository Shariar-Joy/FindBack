import { createContext, useContext, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { api, get } from '../services/api'
import type { User } from '../types'
interface Auth {
  user: User | null
  loading: boolean
  login: (values: { email: string; password: string; remember: boolean }) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}
const Context = createContext<Auth | null>(null)
export function AuthProvider({ children }: { children: ReactNode }) {
  const cache = useQueryClient()
  const query = useQuery({
    queryKey: ['auth'],
    queryFn: async () => {
      try {
        return await get<User>('/auth/me')
      } catch (e) {
        if (axios.isAxiosError(e) && e.response?.status === 401) return null
        throw e
      }
    },
    retry: false,
    staleTime: 60000,
  })
  const login = async (values: { email: string; password: string; remember: boolean }) => {
    const { data } = await api.post<User>('/auth/login', values)
    await cache.cancelQueries()
    cache.removeQueries({ predicate: (entry) => entry.queryKey[0] !== 'auth' })
    cache.setQueryData(['auth'], data)
  }
  const logout = async () => {
    await api.post('/auth/logout')
    await cache.cancelQueries()
    cache.removeQueries({ predicate: (entry) => entry.queryKey[0] !== 'auth' })
    cache.setQueryData(['auth'], null)
  }
  return (
    <Context.Provider
      value={{
        user: query.data ?? null,
        loading: query.isPending,
        login,
        logout,
        refresh: async () => {
          await cache.invalidateQueries({ queryKey: ['auth'] })
        },
      }}
    >
      {children}
    </Context.Provider>
  )
}
export function useAuth() {
  const value = useContext(Context)
  if (!value) throw new Error('AuthProvider required')
  return value
}
