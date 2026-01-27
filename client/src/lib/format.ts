export const formatTime = (iso: string) => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return 'Just now'
  }
  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const formatDateTime = (iso: string) => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) {
    return 'Just now'
  }
  return date.toLocaleString()
}
