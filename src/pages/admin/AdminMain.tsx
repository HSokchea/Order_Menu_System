import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import Dashboard from "../Dashboard";
import Categories from "./Categories";
import MenuItems from "./MenuItems";
import OrderDashboard from "./OrderDashboard";
import QRGenerator from "./QRGenerator";
import TableSessions from "./TableSessions";

const getPageInfo = (pathname: string) => {
  switch (pathname) {
    case "/admin":
    case "/admin/dashboard":
      return { title: "Dashboard", description: "Overview and statistics" };
    case "/admin/categories":
      return { title: "Categories", description: "Manage menu categories" };
    case "/admin/menu-items":
      return { title: "Menu Items", description: "Add and manage your menu items" };
    case "/admin/order-dashboard":
      return { title: "Order Dashboard", description: "Monitor live orders" };
    case "/admin/table-sessions":
      return { title: "Table Sessions", description: "Manage dining sessions and billing" };
    case "/admin/qr-generator":
      return { title: "QR Generator", description: "Create QR codes for tables" };
    case "/admin/analytics":
      return { title: "Analytics", description: "Advanced insights and metrics" };
    case "/admin/stock":
      return { title: "Stock Management", description: "Track inventory levels" };
    case "/admin/promotions":
      return { title: "Promotions & Discounts", description: "Manage special offers" };
    default:
      return { title: "Admin", description: "Restaurant Management" };
  }
};

export default function AdminMain() {
  const location = useLocation();
  const { title, description } = getPageInfo(location.pathname);

  return (
    <AdminLayout title={title} description={description}>
      <Routes>
        <Route index element={<Dashboard />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="categories" element={<Categories />} />
        <Route path="menu-items" element={<MenuItems />} />
        <Route path="order-dashboard" element={<OrderDashboard />} />
        <Route path="table-sessions" element={<TableSessions />} />
        <Route path="qr-generator" element={<QRGenerator />} />
        {/* Redirect root admin to dashboard */}
        <Route path="/" element={<Navigate to="/admin" replace />} />
      </Routes>
    </AdminLayout>
  );
}