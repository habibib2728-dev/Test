const fallbackApiUrl = 'http://localhost:3001'
const runtimeOrigin =
  typeof window !== 'undefined' && window.location?.origin ? window.location.origin : fallbackApiUrl

const apiUrl = import.meta.env.VITE_API_URL
export const API_URL = apiUrl && apiUrl.length > 0 ? apiUrl : runtimeOrigin

const socketUrl = import.meta.env.VITE_SOCKET_URL
export const SOCKET_URL = socketUrl && socketUrl.length > 0 ? socketUrl : API_URL

const domain = import.meta.env.VITE_METERED_DOMAIN
const room = import.meta.env.VITE_METERED_ROOM
const meetingUrl = import.meta.env.VITE_METERED_MEETING_URL

const normalizeUrl = (value: string) => (value.startsWith('http') ? value : `https://${value}`)
const normalizeDomain = (value: string) => (value.includes('.') ? value : `${value}.metered.live`)

const domainUrl = domain ? normalizeUrl(normalizeDomain(domain)) : undefined
const meetingUrlValue = meetingUrl ? normalizeUrl(meetingUrl) : undefined

export const METERED_ROOM_URL =
  meetingUrlValue ?? (domainUrl && room ? `${domainUrl.replace(/\/$/, '')}/${room}` : undefined)
