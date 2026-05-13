import { createContext, useContext, useState } from 'react'
import type { UploadResponse } from './types'

interface AppContextType {
  uploadData: UploadResponse | null
  setUploadData: (data: UploadResponse) => void
}

const AppContext = createContext<AppContextType | null>(null)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [uploadData, setUploadData] = useState<UploadResponse | null>(null)
  return (
    <AppContext.Provider value={{ uploadData, setUploadData }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be inside AppProvider')
  return ctx
}
