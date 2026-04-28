import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ProtectedRoute } from '@/components/shared/ProtectedRoute'
import { AdminLayout } from '@/layouts/AdminLayout'
import { SupervisorLayout } from '@/layouts/SupervisorLayout'
import { ClientLayout } from '@/layouts/ClientLayout'
import { LoginPage } from '@/pages/auth/LoginPage'
import { RegisterPage } from '@/pages/auth/RegisterPage'
import { ClientDashboardPage } from '@/pages/client/DashboardPage'
import { ClientOrdersPage } from '@/pages/client/OrdersPage'
import { CreateOrderPage } from '@/pages/client/CreateOrderPage'
import { ClientOrderDetailPage } from '@/pages/client/OrderDetailPage'
import { ClientDocsPage } from '@/pages/client/DocsPage'
import { DashboardPage } from '@/pages/admin/DashboardPage'
import { OrdersPage } from '@/pages/admin/OrdersPage'
import { CouriersPage } from '@/pages/admin/CouriersPage'
import { ShiftsPage } from '@/pages/admin/ShiftsPage'
import { ZonesPage } from '@/pages/admin/ZonesPage'
import { WarehousesPage } from '@/pages/admin/WarehousesPage'
import { PaymentsPage } from '@/pages/admin/PaymentsPage'
import { SettingsPage } from '@/pages/admin/SettingsPage'
import { AlertsAdminPage } from '@/pages/admin/AlertsAdminPage'
import { MapPage } from '@/pages/supervisor/MapPage'
import { AlertsPage } from '@/pages/supervisor/AlertsPage'
import { SupervisorCouriersPage } from '@/pages/supervisor/CouriersPage'
import { CourierLayout } from '@/layouts/CourierLayout'
import { CourierDashboardPage } from '@/pages/courier/DashboardPage'
import { CourierOrdersPage } from '@/pages/courier/OrdersPage'
import { CourierPlanPage } from '@/pages/courier/PlanPage'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 10_000, retry: 1 } },
})

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login"    element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* ORG_ADMIN / ADMIN */}
          <Route element={<ProtectedRoute allowedRoles={['ADMIN', 'ORG_ADMIN']} />}>
            <Route element={<AdminLayout />}>
              <Route path="/admin"            element={<DashboardPage />} />
              <Route path="/admin/orders"     element={<OrdersPage />} />
              <Route path="/admin/couriers"   element={<CouriersPage />} />
              <Route path="/admin/shifts"     element={<ShiftsPage />} />
              <Route path="/admin/zones"      element={<ZonesPage />} />
              <Route path="/admin/warehouses" element={<WarehousesPage />} />
              <Route path="/admin/payments"   element={<PaymentsPage />} />
              <Route path="/admin/alerts"     element={<AlertsAdminPage />} />
              <Route path="/admin/settings"   element={<SettingsPage />} />
            </Route>
          </Route>

          {/* SUPERVISOR */}
          <Route element={<ProtectedRoute allowedRoles={['SUPERVISOR', 'ORG_ADMIN', 'ADMIN']} />}>
            <Route element={<SupervisorLayout />}>
              <Route path="/supervisor"          element={<MapPage />} />
              <Route path="/supervisor/orders"   element={<OrdersPage />} />
              <Route path="/supervisor/couriers" element={<SupervisorCouriersPage />} />
              <Route path="/supervisor/alerts"   element={<AlertsPage />} />
            </Route>
          </Route>

          {/* CLIENT */}
          <Route element={<ProtectedRoute allowedRoles={['CLIENT']} />}>
            <Route element={<ClientLayout />}>
              <Route path="/client"              element={<ClientDashboardPage />} />
              <Route path="/client/orders"       element={<ClientOrdersPage />} />
              <Route path="/client/orders/:id"   element={<ClientOrderDetailPage />} />
              <Route path="/client/new"          element={<CreateOrderPage />} />
              <Route path="/client/docs"         element={<ClientDocsPage />} />
            </Route>
          </Route>

          {/* COURIER */}
          <Route element={<ProtectedRoute allowedRoles={['COURIER']} />}>
            <Route element={<CourierLayout />}>
              <Route path="/courier"        element={<CourierDashboardPage />} />
              <Route path="/courier/orders" element={<CourierOrdersPage />} />
              <Route path="/courier/plan"   element={<CourierPlanPage />} />
            </Route>
          </Route>

          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
