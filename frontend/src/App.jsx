import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import PublicLayout from './components/PublicLayout'
import ErrorBoundary from './components/ErrorBoundary'
import PageLoader from './components/PageLoader'
import SplashGate from './components/SplashGate'
import Menu from './pages/Menu'
import ProductDetail from './pages/ProductDetail'
import Cart from './pages/Cart'
import OrderStatus from './pages/OrderStatus'
import Favorites from './pages/Favorites'
import MyOrders from './pages/MyOrders'
import NotFound from './pages/NotFound'
import ProtectedAdminRoute from './admin/ProtectedAdminRoute'

// Müştəri səhifələri əsas paketdədir (oflayn menyu üçün lazımdır — service worker onları birinci girişdə keşləyir).
// Admin/mətbəx səhifələri yalnız işçilər üçündür və çox böyükdür — ayrı chunk-larda tələb olunanda yüklənir (lazy loading).
const Login = lazy(() => import('./admin/Login'))
const ForgotPassword = lazy(() => import('./admin/ForgotPassword'))
const ResetPassword = lazy(() => import('./admin/ResetPassword'))
const VerifyEmail = lazy(() => import('./admin/VerifyEmail'))
const AdminLayout = lazy(() => import('./admin/AdminLayout'))
const Dashboard = lazy(() => import('./admin/Dashboard'))
const CategoriesAdmin = lazy(() => import('./admin/CategoriesAdmin'))
const MenuAdmin = lazy(() => import('./admin/MenuAdmin'))
const TablesAdmin = lazy(() => import('./admin/TablesAdmin'))
const OrdersAdmin = lazy(() => import('./admin/OrdersAdmin'))
const NotificationsAdmin = lazy(() => import('./admin/NotificationsAdmin'))
const PromotionsAdmin = lazy(() => import('./admin/PromotionsAdmin'))
const Settings = lazy(() => import('./admin/Settings'))
const StaffAdmin = lazy(() => import('./admin/StaffAdmin'))
const AuditLogsAdmin = lazy(() => import('./admin/AuditLogsAdmin'))
const KitchenDisplay = lazy(() => import('./admin/KitchenDisplay'))
const AccountAdmin = lazy(() => import('./admin/AccountAdmin'))
const ReviewsAdmin = lazy(() => import('./admin/ReviewsAdmin'))
const MediaAdmin = lazy(() => import('./admin/MediaAdmin'))
const IngredientsAdmin = lazy(() => import('./admin/IngredientsAdmin'))
const CustomersAdmin = lazy(() => import('./admin/CustomersAdmin'))
const InventoryAdmin = lazy(() => import('./admin/InventoryAdmin'))
const ReportsAdmin = lazy(() => import('./admin/ReportsAdmin'))

// PDF-də ümumi menyu linki /menu kimi göstərilir (Instagram bio, QR: /menu?table=...) — sorğu parametrləri saxlanılaraq /menyu-ya yönləndirilir
function MenuAlias() {
  const { search } = useLocation()
  return <Navigate to={{ pathname: '/menyu', search }} replace />
}

function App() {
  return (
    <ErrorBoundary>
      <SplashGate />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Navigate to="/menyu" replace />} />
          <Route path="/menu" element={<MenuAlias />} />

          <Route element={<PublicLayout />}>
            <Route path="/menyu" element={<Menu />} />
            <Route path="/product/:id" element={<ProductDetail />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/order/:id" element={<OrderStatus />} />
            <Route path="/favorites" element={<Favorites />} />
            <Route path="/orders" element={<MyOrders />} />
          </Route>

          <Route path="/admin/login" element={<Login />} />
          <Route path="/admin/forgot-password" element={<ForgotPassword />} />
          <Route path="/admin/reset-password" element={<ResetPassword />} />
          <Route path="/admin/verify-email" element={<VerifyEmail />} />
          <Route element={<ProtectedAdminRoute />}>
            <Route path="/kitchen" element={<KitchenDisplay />} />
          </Route>
          <Route path="/admin" element={<ProtectedAdminRoute />}>
            <Route element={<AdminLayout />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="account" element={<AccountAdmin />} />
              <Route path="reviews" element={<ReviewsAdmin />} />
              <Route path="media" element={<MediaAdmin />} />
              <Route path="ingredients" element={<IngredientsAdmin />} />
              <Route path="customers" element={<CustomersAdmin />} />
              <Route path="inventory" element={<InventoryAdmin />} />
              <Route path="reports" element={<ReportsAdmin />} />
              <Route path="staff" element={<StaffAdmin />} />
              <Route path="audit" element={<AuditLogsAdmin />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="orders" element={<OrdersAdmin />} />
              <Route path="notifications" element={<NotificationsAdmin />} />
              <Route path="menu" element={<MenuAdmin />} />
              <Route path="categories" element={<CategoriesAdmin />} />
              <Route path="tables" element={<TablesAdmin />} />
              <Route path="promotions" element={<PromotionsAdmin />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  )
}

export default App
