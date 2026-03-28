import Groq from 'groq-sdk'

export async function extractWithGroq(markdown) {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return { success: false, error: 'GROQ_API_KEY가 설정되지 않았습니다' }

  const groq = new Groq({ apiKey })
  try {
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content: `너는 한국 결혼식 모바일 청첩장에서 정보를 추출하는 전문가야.
주어진 마크다운 텍스트에서 결혼식 정보를 JSON으로 추출해.
반드시 아래 형식의 JSON만 반환해. 다른 텍스트는 포함하지 마.
찾을 수 없는 필드는 null로 설정해.

추출 힌트:
- 신랑/신부 이름: "신랑 OOO · 신부 OOO", "OOO ♥ OOO", 또는 페이지 제목에서 찾아.
- 날짜: "YYYY년 M월 D일", "오후 N시" 등에서 추출. ISO 8601로 변환.
- 예식장: "오시는 길", "LOCATION" 섹션 근처의 장소명.
- 주소: "서울 OO구 OO로 123" 같은 도로명 주소. "오시는 길" 섹션에 반드시 있음.
- 부모님: "OOO · OOO의 아들/딸" 패턴. "ABOUT US" 섹션이 아닌 본문의 혼주 소개에서 찾아.

{
  "groomName": "신랑 성+이름 (예: 김용준)",
  "brideName": "신부 성+이름 (예: 장문희)",
  "weddingDate": "ISO 8601 (예: 2026-04-19T14:00:00)",
  "venueName": "예식장 이름 (예: 더컨벤션 영등포)",
  "venueDetail": "층/홀 (예: 1층 그랜드볼룸홀)",
  "venueAddress": "도로명 주소 (예: 서울 영등포구 국회대로38길 2). 반드시 추출할 것.",
  "groomFather": "신랑 부친 성+이름",
  "groomMother": "신랑 모친 성+이름",
  "brideFather": "신부 부친 성+이름",
  "brideMother": "신부 모친 성+이름"
}`,
        },
        { role: 'user', content: markdown.substring(0, 8000) },
      ],
      temperature: 0,
      max_tokens: 500,
      response_format: { type: 'json_object' },
    })
    const content = response.choices[0]?.message?.content
    if (!content) return { success: false, error: 'AI 응답이 비어있습니다' }
    return { success: true, data: JSON.parse(content) }
  } catch (err) {
    return { success: false, error: err.message }
  }
}
