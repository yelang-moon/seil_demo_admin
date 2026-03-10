"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  FileText,
  ClipboardList,
  Bot,
  Settings,
  Package,
  Factory,
  Database,
  ChevronDown,
  ChevronRight,
} from "lucide-react"
import { useState } from "react"
import { useFactory, FactoryType } from "@/contexts/factory-context"

interface NavItem {
  label: string
  href?: string
  icon: React.ReactNode
  children?: { label: string; href: string; icon: React.ReactNode }[]
}

const navItems: NavItem[] = [
  {
    label: "대시보드",
    icon: <LayoutDashboard className="h-4 w-4" />,
    children: [
      { label: "메인 대시보드", href: "/", icon: <LayoutDashboard className="h-4 w-4" /> },
      { label: "일보 (일일보고)", href: "/daily-report", icon: <FileText className="h-4 w-4" /> },
      { label: "생산보고", href: "/production-report", icon: <ClipboardList className="h-4 w-4" /> },
      { label: "AI 인사이트", href: "/ai-insight", icon: <Bot className="h-4 w-4" /> },
    ],
  },
  {
    label: "데이터 관리",
    icon: <Settings className="h-4 w-4" />,
    children: [
      { label: "장비 관리", href: "/admin/equipment", icon: <Factory className="h-4 w-4" /> },
      { label: "제품 관리", href: "/admin/products", icon: <Package className="h-4 w-4" /> },
      { label: "ERP 제품표", href: "/admin/erp-items", icon: <Database className="h-4 w-4" /> },
      { label: "생산기록 관리", href: "/admin/production", icon: <ClipboardList className="h-4 w-4" /> },
    ],
  },
]

const factories: { value: FactoryType; label: string; color: string }[] = [
  { value: "지기생산부", label: "지기생산부", color: "bg-blue-500" },
  { value: "성형부", label: "성형부", color: "bg-emerald-500" },
]

export function Sidebar() {
  const pathname = usePathname()
  const { factory, setFactory } = useFactory()
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    "대시보드": true,
    "데이터 관리": true,
  })

  const toggleSection = (label: string) => {
    setOpenSections((prev) => ({ ...prev, [label]: !prev[label] }))
  }

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 bg-white border-r border-gray-200 h-screen sticky top-0">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-gray-200">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">S</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">SEIL</h1>
            <p className="text-[10px] text-gray-500 -mt-1">생산관리 시스템</p>
          </div>
        </Link>
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

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        {navItems.map((section) => (
          <div key={section.label} className="mb-2">
            <button
              onClick={() => toggleSection(section.label)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-700"
            >
              <span className="flex items-center gap-2">
                {section.icon}
                {section.label}
              </span>
              {openSections[section.label] ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </button>
            {openSections[section.label] && section.children && (
              <div className="mt-1 space-y-1">
                {section.children.map((item) => {
                  const isActive = pathname === item.href
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                        isActive
                          ? "bg-blue-50 text-blue-700 font-medium"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      )}
                    >
                      {item.icon}
                      {item.label}
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200">
        <p className="text-xs text-gray-400 text-center">SEIL Demo v1.0</p>
      </div>
    </aside>
  )
}
