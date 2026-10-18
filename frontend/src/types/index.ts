export type Role = 'USER' | 'MODERATOR' | 'ADMIN'
export type CaseStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'RESOLVED'
export interface User {
  id: string
  email: string
  display_name: string
  role: Role
  email_alerts: boolean
  is_demo: boolean
}
export interface PublicCase {
  case_code: string
  person_name: string
  approximate_age: number | null
  description: string
  clothing_description: string
  additional_context: string
  last_seen_date: string
  country_code: string
  division: string
  district: string
  city: string
  area_name: string
  status: CaseStatus
  publication_visibility: 'PUBLIC' | 'PRIVATE'
  public_location: [number, number] | null
  photo_url: string | null
  published_at: string | null
  is_demo: boolean
}
export interface PrivateCase extends PublicCase {
  created_at: string
  last_seen_at: string
  rejection_reason: string | null
  contact: { relationship: string; method: string; value: string } | null
  reporter?: { display_name: string; email: string }
  moderation_notes?: string
  possible_duplicates?: { case_code: string; person_name: string; status: CaseStatus }[]
}
export interface Page<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}
export interface Area {
  code: string
  name: string
  division: string
  centroid: [number, number] | null
}
export interface Regions {
  divisions: Record<string, string[]>
  areas: Area[]
}
export interface Subscription {
  id: string
  area_code: string
  area_name: string
  created_at: string
}
export interface Sighting {
  id: string
  case_code: string
  observed_at: string
  location_description: string
  notes: string
  status: string
  created_at: string
  attachment_url: string | null
  safe_contact?: string
  review_notes?: string
}
export interface Notice {
  id: string
  case_code: string | null
  area: string
  status: string
  created_at: string
  sent_at: string | null
}
export interface PublicStats {
  active_cases: number
  people_found: number
  active_alerts: number
  average_response_hours: number | null
}
export interface Group {
  name: string
  count: number
}
export interface Analytics {
  users: number
  cases: number
  by_status: Group[]
  by_district: Group[]
  submissions: Group[]
  sightings: Group[]
  notifications: Group[]
}
export interface ManagedUser {
  id: string
  email: string
  display_name: string
  role: Role
  is_active: boolean
  created_at: string
}
export interface Job {
  id: string
  case_code: string
  status: string
  attempts: number
  last_error: string | null
  created_at: string
  sent_at: string | null
}
export interface Audit {
  id: string
  actor: string
  action: string
  case_code: string | null
  details: Record<string, unknown>
  created_at: string
}
export interface Abuse {
  id: string
  case_code: string
  reason: string
  status: string
  decision: string
  created_at: string
}
