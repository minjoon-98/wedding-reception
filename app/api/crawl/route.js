import { NextResponse } from 'next/server'
import { scrapeToMarkdown } from '@/lib/crawl/firecrawl'
import { extractWithRegex } from '@/lib/crawl/regex-extractor'
import { extractWithGroq } from '@/lib/crawl/groq-extractor'

export async function POST(request) {
  try {
    const body = await request.json()
    const { url } = body

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

    // Step 2: Regex extraction
    const regexResult = extractWithRegex(scrapeResult.markdown)
    if (regexResult.success && regexResult.confidence >= 0.5) {
      return NextResponse.json({
        success: true,
        method: 'regex',
        data: regexResult.data,
        confidence: regexResult.confidence,
      })
    }

    // Step 3: Groq AI fallback
    const groqResult = await extractWithGroq(scrapeResult.markdown)
    if (groqResult.success) {
      return NextResponse.json({
        success: true,
        method: 'ai',
        data: groqResult.data,
      })
    }

    // Step 4: All methods failed
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
