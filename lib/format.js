export function formatDateTime(isoString) {
  if (!isoString) return ''
  const date = new Date(isoString)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  const timeStr = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  if (isToday) return `오늘 ${timeStr}`
  const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  return `${dateStr} ${timeStr}`
}

export function formatAmount(num) {
  if (!num) return '0'
  return num.toLocaleString()
}

export function formatAmountShort(num) {
  if (num >= 10000) {
    const man = num / 10000
    return `${man}만`
  }
  return formatAmount(num)
}
