import { Routes, Route, Navigate } from 'react-router-dom'
import PublicLayout from './components/PublicLayout'
import Menu from './pages/Menu'
import ProductDetail from './pages/ProductDetail'
import Cart from './pages/Cart'
import OrderStatus from './pages/OrderStatus'
import Favorites from './pages/Favorites'
import MyOrders from './pages/MyOrders'
import NotFound from './pages/NotFound'

import Login from './admin/Login'
import ProtectedAdminRoute from './admin/ProtectedAdminRoute'
import AdminLayout from './admin/AdminLayout'
import Dashboard from './admin/Dashboard'
import CategoriesAdmin from './admin/CategoriesAdmin'
import MenuAdmin from './admin/MenuAdmin'
import TablesAdmin from './admin/TablesAdmin'
import OrdersAdmin from './admin/OrdersAdmin'
import PromotionsAdmin from './admin/PromotionsAdmin'
import Settings from './admin/Settings'
import StaffAdmin from './admin/StaffAdmin'
import AuditLogsAdmin from './admin/AuditLogsAdmin'
import KitchenDisplay from './admin/KitchenDisplay'
import AccountAdmin from './admin/AccountAdmin'
import ReviewsAdmin from './admin/ReviewsAdmin'
import MediaAdmin from './admin/MediaAdmin'
import CustomersAdmin from './admin/CustomersAdmin'
import InventoryAdmin from './admin/InventoryAdmin'
import ReportsAdmin from './admin/ReportsAdmin'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/menyu" replace />} />

      <Route element={<PublicLayout />}>
        <Route path="/menyu" element={<Menu />} />
        <Route path="/product/:id" element={<ProductDetail />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/order/:id" element={<OrderStatus />} />
        <Route path="/favorites" element={<Favorites />} />
        <Route path="/orders" element={<MyOrders />} />
      </Route>

      <Route path="/admin/login" element={<Login />} />
      <Route element={<ProtectedAdminRoute />}>
        <Route path="/kitchen" element={<KitchenDisplay />} />
      </Route>
      <Route path="/admin" element={<ProtectedAdminRoute />}>
        <Route element={<AdminLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="account" element={<AccountAdmin />} />
          <Route path="reviews" element={<ReviewsAdmin />} />
          <Route path="media" element={<MediaAdmin />} />
          <Route path="customers" element={<CustomersAdmin />} />
          <Route path="inventory" element={<InventoryAdmin />} />
          <Route path="reports" element={<ReportsAdmin />} />
          <Route path="staff" element={<StaffAdmin />} />
          <Route path="audit" element={<AuditLogsAdmin />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="orders" element={<OrdersAdmin />} />
          <Route path="menu" element={<MenuAdmin />} />
          <Route path="categories" element={<CategoriesAdmin />} />
          <Route path="tables" element={<TablesAdmin />} />
          <Route path="promotions" element={<PromotionsAdmin />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default App
