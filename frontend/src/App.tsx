import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppProvider, useApp } from '@/lib/context'
import { Layout } from '@/components/Layout'
import { UploadPage } from '@/features/upload/UploadPage'
import { OverviewPage } from '@/features/overview/OverviewPage'
import { TeamPage } from '@/features/team/TeamPage'
import { CaDetailPage } from '@/features/ca-detail/CaDetailPage'
import { ForecastPage } from '@/features/forecast/ForecastPage'
import { SmoothingPage } from '@/features/smoothing/SmoothingPage'
import { DecisionsPage } from '@/features/decisions/DecisionsPage'
import { ComplexityPage } from '@/features/complexity/ComplexityPage'
import { DataWarningsPage } from '@/features/data-warnings/DataWarningsPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
})

function ProtectedRoute() {
  const { uploadData } = useApp()
  if (!uploadData) return <Navigate to="/upload" replace />
  return <Outlet />
}

export default function App() {
  return (
    <AppProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route path="/upload" element={<UploadPage />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<Layout />}>
                <Route path="/overview" element={<OverviewPage />} />
                <Route path="/team" element={<TeamPage />} />
                <Route path="/ca/:caId" element={<CaDetailPage />} />
                <Route path="/forecast" element={<ForecastPage />} />
                <Route path="/smoothing" element={<SmoothingPage />} />
                <Route path="/complexity" element={<ComplexityPage />} />
                <Route path="/decisions" element={<DecisionsPage />} />
                <Route path="/data-warnings" element={<DataWarningsPage />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/upload" replace />} />
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </AppProvider>
  )
}
