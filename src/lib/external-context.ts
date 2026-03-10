/**
 * 외부 뉴스 및 시장 데이터 수집 유틸리티
 * Google News RSS에서 업계 관련 뉴스를 가져와 AI 분석에 활용
 */

interface NewsItem {
  title: string
  link: string
  source: string
  pubDate: string
}

const SEARCH_QUERIES = [
  '일회용품+시장+동향',
  '식품+포장재+트렌드',
  '친환경+포장+규제',
  '일회용+플라스틱+수출',
  'PP+PET+원자재+가격',
]

/**
 * Google News RSS에서 뉴스를 가져옴
 */
async function fetchGoogleNewsRSS(query: string, limit: number = 5): Promise<NewsItem[]> {
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ko&gl=KR&ceid=KR:ko`
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000) // 5초 타임아웃

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
    clearTimeout(timeout)

    if (!res.ok) return []

    const xml = await res.text()
    const items: NewsItem[] = []

    // Simple XML parsing (no external dependency)
    const itemRegex = /<item>([\s\S]*?)<\/item>/g
    let match
    while ((match = itemRegex.exec(xml)) !== null && items.length < limit) {
      const itemXml = match[1]
      const title = itemXml.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim() || ''
      const link = itemXml.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim() || ''
      const source = itemXml.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1]?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim() || ''
      const pubDate = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim() || ''

      if (title) {
        items.push({ title, link, source, pubDate })
      }
    }

    return items
  } catch {
    return []
  }
}

/**
 * 여러 검색어로 뉴스를 수집하고 중복 제거
 */
export async function fetchIndustryNews(maxItems: number = 15): Promise<string> {
  const allNews: NewsItem[] = []
  const seenTitles = new Set<string>()

  // 병렬로 여러 검색어 실행
  const results = await Promise.allSettled(
    SEARCH_QUERIES.map(q => fetchGoogleNewsRSS(q, 4))
  )

  results.forEach(r => {
    if (r.status === 'fulfilled') {
      r.value.forEach(item => {
        // 제목 기반 중복 제거
        const shortTitle = item.title.substring(0, 30)
        if (!seenTitles.has(shortTitle)) {
          seenTitles.add(shortTitle)
          allNews.push(item)
        }
      })
    }
  })

  // 최신순 정렬
  allNews.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())

  const selected = allNews.slice(0, maxItems)

  if (selected.length === 0) {
    return '(최신 업계 뉴스를 가져올 수 없었습니다. 내부 데이터 기반으로 분석합니다.)'
  }

  let context = '## 최신 업계 뉴스 및 시장 동향 (참고 자료)\n\n'
  selected.forEach((item, idx) => {
    const dateStr = item.pubDate ? new Date(item.pubDate).toLocaleDateString('ko-KR') : ''
    context += `${idx + 1}. **${item.title}** ${item.source ? `(${item.source})` : ''} ${dateStr}\n`
    if (item.link) context += `   링크: ${item.link}\n`
  })

  context += '\n위 뉴스를 참고하여 업계 동향, 규제 변화, 시장 기회를 분석에 반영하세요.\n'

  return context
}

/**
 * 특정 주제에 대한 뉴스를 검색
 */
export async function fetchTopicNews(topic: string, maxItems: number = 5): Promise<string> {
  const items = await fetchGoogleNewsRSS(topic, maxItems)

  if (items.length === 0) {
    return ''
  }

  let context = `\n### 관련 뉴스: "${topic}"\n`
  items.forEach((item, idx) => {
    const dateStr = item.pubDate ? new Date(item.pubDate).toLocaleDateString('ko-KR') : ''
    context += `${idx + 1}. ${item.title} ${item.source ? `(${item.source})` : ''} ${dateStr}\n`
  })

  return context
}

/**
 * 질문 내용에 따라 관련 뉴스를 동적으로 검색
 */
export async function fetchContextualNews(question: string): Promise<string> {
  const q = question.toLowerCase()
  const queries: string[] = []

  // 질문 키워드에 따라 검색어 결정
  if (q.includes('해외') || q.includes('수출') || q.includes('아마존') || q.includes('글로벌')) {
    queries.push('일회용품 수출 동향', '한국 포장재 해외 진출')
  }
  if (q.includes('친환경') || q.includes('종이') || q.includes('소재') || q.includes('pla') || q.includes('바이오')) {
    queries.push('친환경 포장재 시장', '플라스틱 대체 소재 트렌드')
  }
  if (q.includes('원가') || q.includes('원자재') || q.includes('가격') || q.includes('pp') || q.includes('pet')) {
    queries.push('PP PET 원자재 가격 동향', '석유화학 원료 시세')
  }
  if (q.includes('규제') || q.includes('법') || q.includes('정책')) {
    queries.push('일회용품 규제 정책', '포장재 재활용 법안')
  }
  if (q.includes('시장') || q.includes('트렌드') || q.includes('전망')) {
    queries.push('식품포장 시장 전망', '일회용 포장 시장 규모')
  }

  // 기본 검색어 (키워드 매칭 안될 때)
  if (queries.length === 0) {
    queries.push('일회용 식품포장 시장 동향')
  }

  const results = await Promise.allSettled(
    queries.slice(0, 3).map(q => fetchTopicNews(q, 3))
  )

  let context = ''
  results.forEach(r => {
    if (r.status === 'fulfilled' && r.value) {
      context += r.value
    }
  })

  return context || ''
}
