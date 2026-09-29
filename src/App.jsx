import { Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";

import AuroraBackground from "./components/layout/AuroraBackground.jsx";

// Citizen / Public Pages
import LandingPage from "./pages/LandingPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import ForgotPasswordPage from "./pages/ForgotPasswordPage.jsx";
import ResetPasswordPage from "./pages/ResetPasswordPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import ReportIssuePage from "./pages/ReportIssuePage.jsx";
import TrackComplaintPage from "./pages/TrackComplaintPage.jsx";
import PublicDashboard from "./pages/public/Dashboard.jsx";
import NotFoundPage from "./pages/NotFoundPage.jsx";

// Role-protected Routes
import ProtectedRoute from "./components/auth/ProtectedRoute.jsx";
import RoleRoute from "./components/auth/RoleRoute.jsx";
import AdminRoute from "./components/auth/AdminRoute.jsx";
import { ROLES } from "./constants/workflow.js";

// Admin Pages
import AdminLoginPage from "./pages/admin/Login.jsx";
import AdminDashboardPage from "./pages/admin/Dashboard.jsx";
import AdminComplaintsPage from "./pages/admin/Complaints.jsx";
import AdminUsersPage from "./pages/admin/Users.jsx";
import AIModelConfig from "./pages/admin/AIModelConfig.jsx";

// Department & Engineer Dashboards
import DepartmentDashboard from "./pages/department/Dashboard.jsx";
import EngineerDashboard from "./pages/engineer/Dashboard.jsx";

export default function App() {
  const location = useLocation();

  return (
    <>
      <AuroraBackground />

      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/track" element={<TrackComplaintPage />} />
          <Route path="/public-dashboard" element={<PublicDashboard />} />

          {/* Citizen Protected Routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/report"
            element={
              <ProtectedRoute>
                <ReportIssuePage />
              </ProtectedRoute>
            }
          />

          {/* Department Protected Routes */}
          <Route
            path="/department/dashboard"
            element={
              <RoleRoute allowedRoles={[ROLES.DEPARTMENT]}>
                <DepartmentDashboard />
              </RoleRoute>
            }
          />

          {/* Engineer Protected Routes */}
          <Route
            path="/engineer/dashboard"
            element={
              <RoleRoute allowedRoles={[ROLES.ENGINEER]}>
                <EngineerDashboard />
              </RoleRoute>
            }
          />

          {/* Admin Protected Routes */}
          <Route path="/admin/login" element={<AdminLoginPage />} />
          <Route
            path="/admin/dashboard"
            element={
              <AdminRoute>
                <AdminDashboardPage />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/complaints"
            element={
              <AdminRoute>
                <AdminComplaintsPage />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <AdminRoute>
                <AdminUsersPage />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/ai-config"
            element={
              <AdminRoute>
                <AIModelConfig />
              </AdminRoute>
            }
          />

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AnimatePresence>
    </>
  );
}