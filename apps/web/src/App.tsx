import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProtectedRoute } from '@/components/shared/ProtectedRoute'
import { AdminLayout } from '@/layouts/AdminLayout'
import { SupervisorLayout } from '@/layouts/SupervisorLayout'
import { LoginPage } from '@/pages/auth/LoginPage'
import { DashboardPage } from '@/pages/admin/DashboardPage'
import { OrdersPage } from '@/pages/admin/OrdersPage'
import { AlertsAdminPage } from '@/pages/admin/AlertsAdminPage'
import { MapPage } from '@/pages/supervisor/MapPage'
import { AlertsPage } from '@/pages/supervisor/AlertsPage'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 10_000, retry: 1 } },
})

// Placeholder pages
const Placeholder = ({ title }: { title: string }) => (
  <div className="flex h-full items-center justify-center text-slate-400">
    <div className="text-center">
      <p className="text-lg font-medium">{title}</p>
      <p className="text-sm">В разработке</p>
    </div>
  </div>
)

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          {/* ORG_ADMIN / ADMIN */}
          <Route element={<ProtectedRoute allowedRoles={['ADMIN', 'ORG_ADMIN']} />}>
            <Route element={<AdminLayout />}>
              <Route path="/admin"            element={<DashboardPage />} />
              <Route path="/admin/orders"     element={<OrdersPage />} />
              <Route path="/admin/couriers"   element={<Placeholder title="Курьеры" />} />
              <Route path="/admin/shifts"     element={<Placeholder title="Смены" />} />
              <Route path="/admin/zones"      element={<Placeholder title="Зоны" />} />
              <Route path="/admin/warehouses" element={<Placeholder title="Склады" />} />
              <Route path="/admin/payments"   element={<Placeholder title="Платежи" />} />
              <Route path="/admin/alerts"     element={<AlertsAdminPage />} />
              <Route path="/admin/settings"   element={<Placeholder title="Настройки" />} />
            </Route>
          </Route>

          {/* SUPERVISOR */}
          <Route element={<ProtectedRoute allowedRoles={['SUPERVISOR', 'ORG_ADMIN', 'ADMIN']} />}>
            <Route element={<SupervisorLayout />}>
              <Route path="/supervisor"          element={<MapPage />} />
              <Route path="/supervisor/orders"   element={<OrdersPage />} />
              <Route path="/supervisor/couriers" element={<Placeholder title="Курьеры" />} />
              <Route path="/supervisor/alerts"   element={<AlertsPage />} />
            </Route>
          </Route>

          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
