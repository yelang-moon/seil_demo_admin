import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json()

    const adminPassword = process.env.ADMIN_PASSWORD

    if (!adminPassword) {
      return NextResponse.json({ success: false, error: '시스템 오류' }, { status: 500 })
    }

    const isValid = password === adminPassword

    if (isValid) {
      const response = NextResponse.json({ success: true })
      response.cookies.set('seil_auth', 'authenticated', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
      })
      return response
    } else {
      return NextResponse.json({ success: false }, { status: 401 })
    }
  } catch (error) {
    console.error('Auth error:', error)
    return NextResponse.json({ success: false, error: '인증 중 오류가 발생했습니다' }, { status: 500 })
  }
}
