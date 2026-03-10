'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface AICommentProps {
  chartType: string
  data: any
}

export function AIComment({ chartType, data }: AICommentProps) {
  const [comment, setComment] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cacheKey, setCacheKey] = useState<string>('')

  useEffect(() => {
    const key = `${chartType}-${JSON.stringify(data)}`

    if (cacheKey === key && comment !== null) {
      return // Already cached
    }

    setCacheKey(key)
    setLoading(true)
    setError(null)

    const fetchComment = async () => {
      try {
        const response = await fetch('/api/ai/comment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chartType, data }),
        })

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`)
        }

        const result = await response.json()
        setComment(result.comment)
      } catch (err) {
        console.error('Failed to fetch AI comment:', err)
        setError('AI 분석을 불러올 수 없습니다')
      } finally {
        setLoading(false)
      }
    }

    fetchComment()
  }, [chartType, data, cacheKey, comment])

  if (loading) {
    return <Skeleton className="h-20 w-full" />
  }

  if (error) {
    return (
      <Card className="p-4 bg-gray-50">
        <p className="text-sm text-gray-500">{error}</p>
      </Card>
    )
  }

  return (
    <Card className="p-4 bg-blue-50 border-blue-100">
      <div className="flex gap-3">
        <span className="text-lg">💡</span>
        <p className="text-sm text-gray-700">{comment}</p>
      </div>
    </Card>
  )
}
