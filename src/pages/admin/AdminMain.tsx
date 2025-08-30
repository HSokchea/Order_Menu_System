import { Routes, Route, Navigate } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import Dashboard from "../Dashboard";
import Categories from "./Categories";
import MenuItems from "./MenuItems";
import OrderDashboard from "./OrderDashboard";
import QRGenerator from "./QRGenerator";

export default function AdminMain() {
  return (
    <AdminLayout>
      <Routes>
        <Route index element={<Dashboard />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="categories" element={<Categories />} />
        <Route path="menu-items" element={<MenuItems />} />
        <Route path="order-dashboard" element={<OrderDashboard />} />
        <Route path="qr-generator" element={<QRGenerator />} />
        {/* Redirect root admin to dashboard */}
        <Route path="/" element={<Navigate to="/admin" replace />} />
      </Routes>
    </AdminLayout>
  );
}