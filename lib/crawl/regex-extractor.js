const TOTAL_FIELDS = 6

// 패턴 우선순위: 가장 신뢰할 수 있는 패턴부터
const NAME_PATTERNS = [
  /신랑\s*([가-힣]{2,4})\s*[·•\s]+신부\s*([가-힣]{2,4})/,       // "신랑 차현욱 · 신부 박주현"
  /신랑\s*([가-힣]{2,4})[\s\S]{0,30}?신부\s*([가-힣]{2,4})/,    // "신랑 X\n신부 Y" (줄바꿈 포함)
  /([가-힣]{2,4})\s*[♥❤️💕♡&]\s*([가-힣]{2,4})/,              // "김용준 ♥ 장문희"
  /([가-힣]{2,4})\s*결혼합니다/,                                 // "김용준 장문희 결혼합니다" (단일 매칭, 부분)
]
const DATE_PATTERN_KR = /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/
const DATE_PATTERN_DOT = /(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/
const TIME_PATTERN_KR = /(오전|오후)\s*(\d{1,2})시(?:\s*(\d{1,2})분)?/
const TIME_PATTERN_24H = /(\d{2}):(\d{2})/
const VENUE_KEYWORDS = /(?:웨딩홀|컨벤션|호텔|예식장|웨딩|그랜드볼룸|컨벤션홀|연회장|채플|가든)/
const VENUE_PATTERN = new RegExp(`([가-힣a-zA-Z0-9\\s]{2,20}(?:${VENUE_KEYWORDS.source})[가-힣a-zA-Z0-9\\s]{0,10})`)
const ADDRESS_PATTERN = /((?:서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)[시도]?\s?[가-힣]+(?:시|구|군|동|읍|면|로|길)[가-힣0-9\s\-]*)/
const FLOOR_HALL_PATTERN = /(\d+층\s*[가-힣a-zA-Z0-9\s]*홀|[가-힣a-zA-Z]+홀|\d+층)/

function extractNames(text) {
  // "신랑 X · 신부 Y" 패턴 (가장 신뢰할 수 있음)
  for (const pattern of NAME_PATTERNS) {
    const match = text.match(pattern)
    if (match && match[1] && match[2]) {
      return { groomName: match[1], brideName: match[2] }
    }
  }
  return null
}

function extractDate(text) {
  const krMatch = text.match(DATE_PATTERN_KR)
  if (krMatch) {
    const [, year, month, day] = krMatch
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }
  const dotMatch = text.match(DATE_PATTERN_DOT)
  if (dotMatch) {
    const [, year, month, day] = dotMatch
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }
  return null
}

function extractTime(text) {
  const krMatch = text.match(TIME_PATTERN_KR)
  if (krMatch) {
    const [, period, hourStr, minuteStr] = krMatch
    let hour = parseInt(hourStr, 10)
    const minute = minuteStr ? parseInt(minuteStr, 10) : 0
    if (period === '오후' && hour < 12) hour += 12
    if (period === '오전' && hour === 12) hour = 0
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
  }
  const h24Match = text.match(TIME_PATTERN_24H)
  if (h24Match) {
    return `${h24Match[1]}:${h24Match[2]}`
  }
  return null
}

function extractVenue(text) {
  const match = text.match(VENUE_PATTERN)
  return match ? match[1].trim() : null
}

function extractAddress(text) {
  const match = text.match(ADDRESS_PATTERN)
  return match ? match[1].trim() : null
}

function extractFloorHall(text) {
  const match = text.match(FLOOR_HALL_PATTERN)
  return match ? match[1].trim() : null
}

export function extractWithRegex(markdown) {
  try {
    const names = extractNames(markdown)
    const date = extractDate(markdown)
    const time = extractTime(markdown)
    const venueName = extractVenue(markdown)
    const venueAddress = extractAddress(markdown)
    const venueDetail = extractFloorHall(markdown)

    const fields = [
      names !== null,
      date !== null,
      time !== null,
      venueName !== null,
      venueAddress !== null,
      venueDetail !== null,
    ]
    const matchedCount = fields.filter(Boolean).length
    const confidence = matchedCount / TOTAL_FIELDS

    const data = {
      groomName: names?.groomName ?? null,
      brideName: names?.brideName ?? null,
      weddingDate: date && time ? `${date}T${time}:00` : date ? `${date}T00:00:00` : null,
      venueName: venueName ?? null,
      venueDetail: venueDetail ?? null,
      venueAddress: venueAddress ?? null,
    }

    return {
      success: confidence >= 0.5,
      confidence,
      data,
    }
  } catch (err) {
    return { success: false, confidence: 0, data: null, error: err.message }
  }
}
