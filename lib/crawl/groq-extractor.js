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
          content: `너는 한국 결혼식 모바일 청첩장에서 정보를 추출하는 도우미야.
주어진 마크다운 텍스트에서 결혼식 정보를 JSON으로 추출해.
반드시 아래 형식의 JSON만 반환해. 다른 텍스트는 포함하지 마.
찾을 수 없는 필드는 null로 설정해.

{
  "groomName": "신랑 풀네임",
  "brideName": "신부 풀네임",
  "weddingDate": "ISO 8601 형식 (예: 2026-04-19T14:00:00)",
  "venueName": "예식장 이름",
  "venueDetail": "층/홀 정보",
  "venueAddress": "주소",
  "groomFather": "신랑 부친",
  "groomMother": "신랑 모친",
  "brideFather": "신부 부친",
  "brideMother": "신부 모친"
}`,
        },
        { role: 'user', content: markdown.substring(0, 4000) },
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
