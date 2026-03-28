const TOTAL_FIELDS = 6

// === 이름 패턴 ===
// 우선순위: 가장 신뢰할 수 있는 패턴부터
const NAME_PATTERNS = [
  // "신랑 차현욱 · 신부 박주현" (가장 보편적)
  /신랑\s*([가-힣]{2,4})\s*[·•‧]\s*신부\s*([가-힣]{2,4})/,
  // "신랑 X\n신부 Y" (줄바꿈 포함, 30자 이내)
  /신랑\s*([가-힣]{2,4})[\s\S]{0,30}?신부\s*([가-힣]{2,4})/,
  // "김용준 ♥ 장문희" (하트 기호)
  /([가-힣]{2,4})\s*[♥❤️💕♡&]\s*([가-힣]{2,4})/,
  // "김용준 ❤ 장문희 결혼합니다" (결혼 키워드 앞에 두 이름)
  /([가-힣]{2,4})\s*[♥❤️💕♡]\s*([가-힣]{2,4})\s*결혼/,
]

// === 날짜 패턴 ===
const DATE_PATTERNS = [
  // "2026년 5월 2일" (연도 포함)
  { pattern: /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/, hasYear: true },
  // "2026. 05. 02" 또는 "2026.05.02"
  { pattern: /(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})/, hasYear: true },
  // "May 2, 2026" 또는 "May 2 2026" (영문)
  { pattern: /(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s*(\d{4})/, hasYear: true, english: true },
  // "4월 19일" (연도 없음 → 올해/내년 추정)
  { pattern: /(\d{1,2})월\s*(\d{1,2})일/, hasYear: false },
]

const MONTH_MAP = {
  January: 1, February: 2, March: 3, April: 4, May: 5, June: 6,
  July: 7, August: 8, September: 9, October: 10, November: 11, December: 12,
}

// === 시간 패턴 ===
const TIME_PATTERNS = [
  // "오후 2시 30분" 또는 "오후 2시"
  { pattern: /(오전|오후)\s*(\d{1,2})시(?:\s*(\d{1,2})분)?/, korean: true },
  // "PM 12:00" 또는 "AM 11:30"
  { pattern: /(AM|PM)\s*(\d{1,2}):(\d{2})/, english: true },
  // "14:00" (24시간)
  { pattern: /(\d{2}):(\d{2})/, h24: true },
]

// === 장소 패턴 ===
// 키워드 목록: 웨딩 관련 장소명에 자주 등장하는 단어
const VENUE_KEYWORDS = [
  '웨딩홀', '컨벤션', '호텔', '예식장', '그랜드볼룸', '컨벤션홀',
  '연회장', '채플', '가든', '하우스', '팰리스', '아트홀', '센터',
  '플라자', '파티움', '더채플', '시그니처', '크리스탈',
]

// === 주소 패턴 ===
const CITY_PREFIXES = '서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주'
const ADDRESS_PATTERN = new RegExp(
  `((?:${CITY_PREFIXES})(?:특별시|광역시|도|특별자치시|특별자치도)?\\s*[가-힣]+(?:시|구|군)\\s*[가-힣0-9\\s\\-]+(?:로|길|동|읍|면)[가-힣0-9\\s\\-]*)`
)

// === 층/홀 패턴 ===
const FLOOR_HALL_PATTERNS = [
  // "1층 그랜드볼룸홀"
  /(\d+층\s*[가-힣a-zA-Z0-9\s]*홀)/,
  // "(22층)" 괄호 포함
  /\((\d+층)\)/,
  // "OO홀" 단독
  /([가-힣a-zA-Z]{2,10}홀)/,
  // "N층" 단독
  /(\d+층)/,
]

// === 부모 패턴 ===
const PARENT_PATTERNS = {
  // "차석진 · 이민서 의 아들 신랑 현욱" → 아버지, 어머니
  groom: /([가-힣]{2,4})\s*[·•‧]\s*([가-힣]{2,4})\s*의\s*(?:아들|장남|차남|삼남)\s*(?:신랑\s*)?([가-힣]{1,4})/,
  bride: /([가-힣]{2,4})\s*[·•‧]\s*([가-힣]{2,4})\s*의\s*(?:딸|장녀|차녀|삼녀)\s*(?:신부\s*)?([가-힣]{1,4})/,
}

// ===== 추출 함수들 =====

function extractNames(text) {
  for (const pattern of NAME_PATTERNS) {
    const match = text.match(pattern)
    if (match && match[1] && match[2]) {
      return { groomName: match[1], brideName: match[2] }
    }
  }
  return null
}

function extractDate(text) {
  for (const { pattern, hasYear, english } of DATE_PATTERNS) {
    const match = text.match(pattern)
    if (!match) continue

    if (english) {
      const month = MONTH_MAP[match[1]]
      const day = parseInt(match[2])
      const year = parseInt(match[3])
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    }

    if (hasYear) {
      const [, year, month, day] = match
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
    }

    // 연도 없는 경우: 올해 또는 내년
    const month = parseInt(match[1])
    const day = parseInt(match[2])
    const now = new Date()
    let year = now.getFullYear()
    // 이미 지난 달이면 내년으로 추정
    if (month < now.getMonth() + 1 || (month === now.getMonth() + 1 && day < now.getDate())) {
      year++
    }
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }
  return null
}

function extractTime(text) {
  for (const { pattern, korean, english, h24 } of TIME_PATTERNS) {
    const match = text.match(pattern)
    if (!match) continue

    if (korean) {
      let hour = parseInt(match[2])
      const minute = match[3] ? parseInt(match[3]) : 0
      if (match[1] === '오후' && hour < 12) hour += 12
      if (match[1] === '오전' && hour === 12) hour = 0
      return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
    }

    if (english) {
      let hour = parseInt(match[2])
      const minute = parseInt(match[3])
      if (match[1] === 'PM' && hour < 12) hour += 12
      if (match[1] === 'AM' && hour === 12) hour = 0
      return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
    }

    if (h24) {
      return `${match[1]}:${match[2]}`
    }
  }
  return null
}

function extractVenue(text) {
  // 줄 단위로 분석하여 장소 키워드가 포함된 줄만 추출
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

  for (const line of lines) {
    // 날짜/시간 패턴이 포함된 줄은 스킵 (오염 방지)
    if (/\d{1,2}월|\d{4}년|오전|오후|AM|PM/.test(line)) continue
    // 너무 긴 줄 스킵
    if (line.length > 50) continue

    for (const keyword of VENUE_KEYWORDS) {
      if (line.includes(keyword)) {
        return line.substring(0, 40).trim()
      }
    }
  }

  // 폴백: "오시는 길" 섹션 다음 줄
  const locationIdx = text.indexOf('오시는 길')
  if (locationIdx !== -1) {
    const after = text.substring(locationIdx + 5, locationIdx + 200)
    const afterLines = after.split('\n').map(l => l.trim()).filter(l => l.length > 2 && l.length < 40)
    if (afterLines.length > 0) {
      return afterLines[0]
    }
  }

  return null
}

function extractAddress(text) {
  // 줄 단위로 주소 추출 (오염 방지)
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  for (const line of lines) {
    if (line.length > 80) continue
    const match = line.match(ADDRESS_PATTERN)
    if (match) {
      // 줄바꿈 이후 불필요한 텍스트 제거
      return match[1].trim().split('\n')[0].trim()
    }
  }
  return null
}

function extractFloorHall(text) {
  for (const pattern of FLOOR_HALL_PATTERNS) {
    const match = text.match(pattern)
    if (match) return match[1].trim()
  }
  return null
}

function extractParents(text) {
  const result = {
    groomFather: null,
    groomMother: null,
    brideFather: null,
    brideMother: null,
  }

  const groomMatch = text.match(PARENT_PATTERNS.groom)
  if (groomMatch) {
    result.groomFather = groomMatch[1]
    result.groomMother = groomMatch[2]
  }

  const brideMatch = text.match(PARENT_PATTERNS.bride)
  if (brideMatch) {
    result.brideFather = brideMatch[1]
    result.brideMother = brideMatch[2]
  }

  return result
}

// ===== 메인 함수 =====

export function extractWithRegex(markdown) {
  try {
    const names = extractNames(markdown)
    const date = extractDate(markdown)
    const time = extractTime(markdown)
    const venueName = extractVenue(markdown)
    const venueAddress = extractAddress(markdown)
    const venueDetail = extractFloorHall(markdown)
    const parents = extractParents(markdown)

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
      weddingDate: date && time ? `${date}T${time}:00` : date ? `${date}T12:00:00` : null,
      venueName: venueName ?? null,
      venueDetail: venueDetail ?? null,
      venueAddress: venueAddress ?? null,
      ...parents,
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
