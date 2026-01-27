const fallbackApiUrl = 'http://localhost:3001'

export const API_URL = import.meta.env.VITE_API_URL ?? fallbackApiUrl
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? API_URL

const domain = import.meta.env.VITE_METERED_DOMAIN
const room = import.meta.env.VITE_METERED_ROOM
const meetingUrl = import.meta.env.VITE_METERED_MEETING_URL

export const METERED_MEETING_URL =
  meetingUrl ?? (domain && room ? `https://${domain}.metered.live/${room}` : undefined)
