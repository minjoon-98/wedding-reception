import FirecrawlApp from '@mendable/firecrawl-js'

export async function scrapeToMarkdown(url) {
  const apiKey = process.env.FIRECRAWL_API_KEY
  if (!apiKey) {
    return { success: false, error: 'FIRECRAWL_API_KEY가 설정되지 않았습니다' }
  }
  try {
    const app = new FirecrawlApp({ apiKey })
    const result = await app.scrapeUrl(url, { formats: ['markdown'] })
    if (!result.success) {
      return { success: false, error: '크롤링에 실패했습니다' }
    }
    return { success: true, markdown: result.markdown }
  } catch (err) {
    return { success: false, error: err.message }
  }
}
