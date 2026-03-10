"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import {
  Menu,
  LayoutDashboard,
  FileText,
  ClipboardList,
  Bot,
  Package,
  Factory,
  Database,
  ShieldAlert,
  Truck,
  Globe,
  MessageCircle,
} from "lucide-react"
import { useState } from "react"
import { useFactory, FactoryType } from "@/contexts/factory-context"

const allLinks = [
  { label: "메인 대시보드", href: "/", icon: <LayoutDashboard className="h-4 w-4" />, group: "대시보드" },
  { label: "일보 (일일보고)", href: "/daily-report", icon: <FileText className="h-4 w-4" />, group: "대시보드" },
  { label: "생산보고", href: "/production-report", icon: <ClipboardList className="h-4 w-4" />, group: "대시보드" },
  { label: "안전 재고 대시보드", href: "/safety-stock", icon: <ShieldAlert className="h-4 w-4" />, group: "대시보드" },
  { label: "출하량 대시보드", href: "/shipment-dashboard", icon: <Truck className="h-4 w-4" />, group: "대시보드" },
  { label: "판매 채널 전략", href: "/channel-analysis", icon: <Globe className="h-4 w-4" />, group: "대시보드" },
  { label: "AI 인사이트", href: "/ai-insight", icon: <Bot className="h-4 w-4" />, group: "AI" },
  { label: "AI 챗봇", href: "/ai-chat", icon: <MessageCircle className="h-4 w-4" />, group: "AI" },
  { label: "장비 관리", href: "/admin/equipment", icon: <Factory className="h-4 w-4" />, group: "데이터 관리" },
  { label: "제품 관리", href: "/admin/products", icon: <Package className="h-4 w-4" />, group: "데이터 관리" },
  { label: "출하량 관리", href: "/admin/shipments", icon: <Truck className="h-4 w-4" />, group: "데이터 관리" },
  { label: "ERP 제품표", href: "/admin/erp-items", icon: <Database className="h-4 w-4" />, group: "데이터 관리" },
  { label: "생산기록 관리", href: "/admin/production", icon: <ClipboardList className="h-4 w-4" />, group: "데이터 관리" },
]

const factories: { value: FactoryType; label: string; color: string }[] = [
  { value: "지기생산부", label: "지기생산부", color: "bg-blue-500" },
  { value: "성형부", label: "성형부", color: "bg-emerald-500" },
]

export function MobileNav() {
  const pathname = usePathname()
  const { factory, setFactory } = useFactory()
  const [open, setOpen] = useState(false)

  const groups = Array.from(new Set(allLinks.map((l) => l.group)))

  return (
    <div className="lg:hidden flex items-center h-14 px-4 border-b border-gray-200 bg-white sticky top-0 z-50">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0">
          <div className="h-14 flex items-center px-6 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xs">S</span>
              </div>
              <span className="font-bold text-gray-900">SEIL</span>
            </div>
          </div>

          {/* Factory Selector */}
          <div className="px-3 py-3 border-b border-gray-200">
            <div className="bg-gray-100 p-1 rounded-lg flex">
              {factories.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFactory(f.value)}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-medium transition-all",
                    factory === f.value
                      ? "bg-white shadow-sm text-gray-900"
                      : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  <span className={cn("w-2 h-2 rounded-full", f.color)} />
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <nav className="py-4 px-3">
            {groups.map((group) => (
              <div key={group} className="mb-4">
                <p className="px-3 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {group}
                </p>
                {allLinks
                  .filter((l) => l.group === group)
                  .map((item) => {
                    const isActive = pathname === item.href
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                          isActive
                            ? "bg-blue-50 text-blue-700 font-medium"
                            : "text-gray-600 hover:bg-gray-50"
                        )}
                      >
                        {item.icon}
                        {item.label}
                      </Link>
                    )
                  })}
              </div>
            ))}
          </nav>
        </SheetContent>
      </Sheet>
      <div className="flex-1 flex items-center justify-center">
        <span className="font-bold text-gray-900">SEIL 생산관리</span>
      </div>
    </div>
  )
}
