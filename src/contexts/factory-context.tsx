"use client"

import { createContext, useContext, useState, ReactNode } from "react"

export type FactoryType = "지기생산부" | "성형부"

interface FactoryContextType {
  factory: FactoryType
  setFactory: (factory: FactoryType) => void
}

const FactoryContext = createContext<FactoryContextType | undefined>(undefined)

export function FactoryProvider({ children }: { children: ReactNode }) {
  const [factory, setFactory] = useState<FactoryType>("지기생산부")

  return (
    <FactoryContext.Provider value={{ factory, setFactory }}>
      {children}
    </FactoryContext.Provider>
  )
}

export function useFactory() {
  const context = useContext(FactoryContext)
  if (!context) {
    throw new Error("useFactory must be used within a FactoryProvider")
  }
  return context
}
