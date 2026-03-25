/**
 * 날짜+시간을 사용자 로케일에 맞게 포맷
 * DB의 timestamptz는 UTC로 저장되고, 브라우저가 자동으로 로컬 타임존으로 변환
 */
export function formatDateTime(isoString) {
  if (!isoString) return ''
  const date = new Date(isoString)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()

  const timeStr = date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  })

  if (isToday) {
    return `오늘 ${timeStr}`
  }

  const dateStr = date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })

  return `${dateStr} ${timeStr}`
}

/**
 * 금액 포맷 (로케일 적용)
 */
export function formatAmount(num) {
  if (!num) return '0'
  return num.toLocaleString()
}

/**
 * 금액 축약 (만원 단위)
 */
export function formatAmountShort(num) {
  if (num >= 10000) {
    const man = num / 10000
    return `${man}만`
  }
  return formatAmount(num)
}
