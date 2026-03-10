import type { Metadata } from "next"
import "./globals.css"
import { ClientLayout } from "@/components/layout/client-layout"

export const metadata: Metadata = {
  title: "SEIL 생산관리 시스템",
  description: "SEIL 지기사업부 생산관리 대시보드",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body className="antialiased bg-gray-50 text-gray-900">
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  )
}
