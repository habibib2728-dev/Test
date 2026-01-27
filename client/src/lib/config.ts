const fallbackApiUrl = 'http://localhost:3001'

export const API_URL = import.meta.env.VITE_API_URL ?? fallbackApiUrl
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? API_URL

const domain = import.meta.env.VITE_METERED_DOMAIN
const room = import.meta.env.VITE_METERED_ROOM
const meetingUrl = import.meta.env.VITE_METERED_MEETING_URL

const normalizeUrl = (value: string) => (value.startsWith('http') ? value : `https://${value}`)
const normalizeDomain = (value: string) => (value.includes('.') ? value : `${value}.metered.live`)

const domainUrl = domain ? normalizeUrl(normalizeDomain(domain)) : undefined
const meetingUrlValue = meetingUrl ? normalizeUrl(meetingUrl) : undefined

export const METERED_ROOM_URL =
  meetingUrlValue ?? (domainUrl && room ? `${domainUrl.replace(/\/$/, '')}/${room}` : undefined)
