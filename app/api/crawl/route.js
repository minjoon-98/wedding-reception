import { NextResponse } from 'next/server'
import { scrapeToMarkdown } from '@/lib/crawl/firecrawl'
import { extractWithRegex } from '@/lib/crawl/regex-extractor'
import { extractWithGroq } from '@/lib/crawl/groq-extractor'

export async function POST(request) {
  try {
    const body = await request.json()
    const { url, method: preferredMethod } = body
    // preferredMethod: 'auto' (기본) | 'regex' | 'ai'

    if (!url) {
      return NextResponse.json(
        { success: false, error: 'URL이 필요합니다' },
        { status: 400 },
      )
    }

    // Step 1: Firecrawl → markdown
    const scrapeResult = await scrapeToMarkdown(url)
    if (!scrapeResult.success) {
      return NextResponse.json(
        { success: false, error: scrapeResult.error, fallbackToManual: true },
        { status: 200 },
      )
    }

    const markdown = scrapeResult.markdown

    // AI만 선택한 경우
    if (preferredMethod === 'ai') {
      const groqResult = await extractWithGroq(markdown)
      if (groqResult.success) {
        return NextResponse.json({ success: true, method: 'ai', data: groqResult.data })
      }
      return NextResponse.json({ success: false, fallbackToManual: true, error: 'AI 추출에 실패했습니다.' })
    }

    // 정규식만 선택한 경우
    if (preferredMethod === 'regex') {
      const regexResult = extractWithRegex(markdown)
      return NextResponse.json({
        success: regexResult.success,
        method: 'regex',
        data: regexResult.data,
        confidence: regexResult.confidence,
        ...(regexResult.success ? {} : { fallbackToManual: true }),
      })
    }

    // auto (기본): 정규식 → AI 폴백
    const regexResult = extractWithRegex(markdown)
    if (regexResult.success && regexResult.confidence >= 0.5) {
      return NextResponse.json({
        success: true,
        method: 'regex',
        data: regexResult.data,
        confidence: regexResult.confidence,
      })
    }

    const groqResult = await extractWithGroq(markdown)
    if (groqResult.success) {
      return NextResponse.json({ success: true, method: 'ai', data: groqResult.data })
    }

    // 모든 방법 실패
    return NextResponse.json({
      success: false,
      fallbackToManual: true,
      error: '자동 추출에 실패했습니다. 수동으로 입력해주세요.',
    })
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 },
    )
  }
}
