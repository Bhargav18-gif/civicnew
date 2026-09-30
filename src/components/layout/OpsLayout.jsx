import { useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  UserCheck,
  ShieldCheck,
  BarChart3,
  Bell,
  User,
  Settings,
  LogOut,
  Menu,
  X,
  RefreshCw,
  Building2,
  Wrench,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Search,
  ExternalLink,
  ChevronDown,
  FileText
} from "lucide-react";
import Logo from "../ui/Logo.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { ROLES } from "../../constants/workflow.js";

const DEPT_NAV_ITEMS = [
  { id: "dashboard",   label: "Dashboard",           icon: LayoutDashboard },
  { id: "complaints",  label: "Complaints",          icon: ClipboardList },
  { id: "engineers",   label: "Engineer Management", icon: Users },
  { id: "assignments", label: "Assignments",         icon: UserCheck },
  { id: "verification",label: "Verification",        icon: ShieldCheck },
  { id: "analytics",   label: "Analytics",           icon: BarChart3 },
  { id: "notifications", label: "Notifications",     icon: Bell },
  { id: "profile",     label: "Profile",             icon: User },
  { id: "settings",    label: "Settings",            icon: Settings },
];

const ENG_NAV_ITEMS = [
  { id: "dashboard",     label: "Dashboard",       icon: LayoutDashboard },
  { id: "tasks",         label: "My Complaints",   icon: ClipboardList },
  { id: "active",        label: "Active Work",     icon: Wrench },
  { id: "report",        label: "Report Update",   icon: FileText },
  { id: "completed",     label: "Completed Work",  icon: CheckCircle2 },
  { id: "notifications", label: "Notifications",   icon: Bell },
  { id: "profile",       label: "Profile",         icon: User },
  { id: "settings",      label: "Settings",        icon: Settings },
];

export default function OpsLayout({
  role = ROLES.DEPARTMENT,
  activeTab = "dashboard",
  onTabChange,
  departmentName = "",
  onRefresh,
  refreshing = false,
  notificationCount = 0,
  liveStatus = "CONNECTED",
  onReconnect,
  children
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const isDepartment = role === ROLES.DEPARTMENT || user?.role === "department";
  const navItems = isDepartment ? DEPT_NAV_ITEMS : ENG_NAV_ITEMS;

  const roleTitle = isDepartment ? "Department Operations" : "Engineer Workspace";
  const roleSubtitle = isDepartment ? "Municipal Control Center" : "Field Execution Platform";
  const roleBadge = isDepartment ? "Department Portal" : "Field Engineer";

  async function handleLogout() {
    try {
      await logout();
    } catch (_) {}
    navigate("/login");
  }

  const sidebarContent = (
    <div className="flex flex-col h-full select-none">
      {/* Brand Header */}
      <div className="p-6 border-b border-white/5 flex items-center justify-between">
        <div className="cursor-pointer flex items-center gap-3" onClick={() => navigate("/")}>
          <Logo size={28} />
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">CivicConnect</div>
            <div className="text-sm font-semibold text-white truncate max-w-[130px]">
              {isDepartment ? (departmentName ? `${departmentName} Dept` : "Operations") : "Field Ops"}
            </div>
          </div>
        </div>
        <button
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition"
        >
          <X size={18} />
        </button>
      </div>

      {/* Role Pill */}
      <div className="px-5 py-3">
        <div className={`px-3 py-1.5 rounded-xl text-center text-xs font-semibold tracking-wide border flex items-center justify-center gap-2 ${
          isDepartment
            ? "bg-cyan-500/10 border-cyan-500/20 text-cyan-300 shadow-[0_0_12px_-3px_rgba(34,211,238,0.2)]"
            : "bg-teal-500/10 border-teal-500/20 text-teal-300 shadow-[0_0_12px_-3px_rgba(20,184,166,0.2)]"
        }`}>
          {isDepartment ? <Building2 size={13} /> : <Wrench size={13} />}
          <span>{roleBadge}</span>
        </div>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 px-4 py-2 space-y-1 overflow-y-auto custom-scrollbar">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                onTabChange?.(item.id);
                setSidebarOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? isDepartment
                    ? "bg-cyan-500/15 text-cyan-200 border-l-4 border-cyan-400 shadow-[0_0_15px_-4px_rgba(34,211,238,0.3)]"
                    : "bg-teal-500/15 text-teal-200 border-l-4 border-teal-400 shadow-[0_0_15px_-4px_rgba(20,184,166,0.3)]"
                  : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon size={17} className={isActive ? (isDepartment ? "text-cyan-400" : "text-teal-400") : "text-slate-400"} />
                <span>{item.label}</span>
              </div>
              {item.id === "notifications" && notificationCount > 0 && (
                <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-cyan-500 text-black">
                  {notificationCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* User Footer */}
      <div className="p-4 border-t border-white/5 bg-black/20 mt-auto">
        <div className="flex items-center gap-3 px-2 py-1.5 mb-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white shadow-md text-sm ${
            isDepartment
              ? "bg-gradient-to-br from-cyan-500 to-blue-600"
              : "bg-gradient-to-br from-teal-500 to-emerald-600"
          }`}>
            {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || (isDepartment ? "D" : "E")}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{user?.name || (isDepartment ? "Dept Officer" : "Field Engineer")}</p>
            <p className="text-[11px] text-slate-400 truncate">{user?.email || ""}</p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition"
        >
          <LogOut size={15} />
          <span>Sign out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col antialiased selection:bg-cyan-500/30">
      <div className="flex flex-1 relative">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:flex flex-col w-64 h-screen sticky top-0 bg-[#0a0f1d]/90 backdrop-blur-xl border-r border-white/5 z-30">
          {sidebarContent}
        </aside>

        {/* Mobile Sidebar Overlay */}
        <AnimatePresence>
          {sidebarOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden fixed inset-0 bg-black/70 backdrop-blur-sm z-40"
              />
              <motion.aside
                initial={{ x: -280 }}
                animate={{ x: 0 }}
                exit={{ x: -280 }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="lg:hidden fixed top-0 left-0 bottom-0 w-72 bg-[#0a0f1d] border-r border-white/10 z-50 flex flex-col"
              >
                {sidebarContent}
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Sticky Header */}
          <header className="h-16 sticky top-0 z-20 bg-[#070b14]/80 backdrop-blur-xl border-b border-white/5 px-4 lg:px-8 flex items-center justify-between gap-4">
            {/* Left Header Info */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 text-slate-400 hover:text-white rounded-xl hover:bg-white/5 transition"
                aria-label="Open navigation menu"
              >
                <Menu size={20} />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-bold text-white tracking-tight">{roleTitle}</h1>
                  {departmentName && (
                    <span className="hidden sm:inline-flex px-2 py-0.5 text-[11px] font-semibold rounded-md bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                      {departmentName}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 hidden sm:block">{roleSubtitle}</p>
              </div>
            </div>

            {/* Right Header Actions */}
            <div className="flex items-center gap-2.5">
              {/* Realtime Live Status Indicator */}
              <div
                onClick={liveStatus !== "CONNECTED" ? onReconnect : undefined}
                className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide border transition-all ${
                  liveStatus === "CONNECTED"
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_10px_-2px_rgba(16,185,129,0.3)]"
                    : liveStatus === "CONNECTING"
                    ? "bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-[0_0_10px_-2px_rgba(245,158,11,0.3)] cursor-pointer"
                    : "bg-rose-500/10 text-rose-400 border-rose-500/20 shadow-[0_0_10px_-2px_rgba(244,63,94,0.3)] cursor-pointer hover:bg-rose-500/20"
                }`}
                title={
                  liveStatus === "CONNECTED"
                    ? "Real-time sync active (Supabase Realtime)"
                    : liveStatus === "CONNECTING"
                    ? "Connecting to real-time events... Click to force sync"
                    : "Live updates temporarily unavailable. Click to reconnect."
                }
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    liveStatus === "CONNECTED"
                      ? "bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                      : liveStatus === "CONNECTING"
                      ? "bg-amber-400 animate-ping"
                      : "bg-rose-400"
                  }`}
                />
                <span>
                  {liveStatus === "CONNECTED"
                    ? "Live"
                    : liveStatus === "CONNECTING"
                    ? "Reconnecting..."
                    : "Offline (Click to sync)"}
                </span>
              </div>

              {/* Refresh Button */}
              {onRefresh && (
                <button
                  onClick={onRefresh}
                  disabled={refreshing}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 border border-white/5 transition disabled:opacity-50"
                  title="Refresh Data"
                >
                  <RefreshCw size={16} className={refreshing ? "animate-spin text-cyan-400" : ""} />
                </button>
              )}

              {/* Quick Notifications Button */}
              <button
                onClick={() => onTabChange?.("notifications")}
                className="relative p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 border border-white/5 transition"
                title="Notifications"
              >
                <Bell size={16} />
                {notificationCount > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                )}
              </button>

              {/* User Avatar & Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-white/5 border border-white/5 transition"
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-white text-xs ${
                    isDepartment
                      ? "bg-gradient-to-br from-cyan-500 to-blue-600"
                      : "bg-gradient-to-br from-teal-500 to-emerald-600"
                  }`}>
                    {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "U"}
                  </div>
                  <ChevronDown size={14} className="text-slate-400" />
                </button>

                <AnimatePresence>
                  {profileDropdownOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-30"
                        onClick={() => setProfileDropdownOpen(false)}
                      />
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute right-0 mt-2 w-56 bg-[#0c1220] border border-white/10 rounded-2xl shadow-2xl p-2 z-40"
                      >
                        <div className="px-3 py-2 border-b border-white/5 mb-1">
                          <p className="text-xs font-semibold text-white truncate">{user?.name || "User"}</p>
                          <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
                          <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-bold rounded uppercase bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                            {user?.role || "STAFF"}
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            onTabChange?.("profile");
                            setProfileDropdownOpen(false);
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-slate-300 hover:text-white hover:bg-white/5 transition"
                        >
                          <User size={14} />
                          <span>View Profile</span>
                        </button>
                        <button
                          onClick={() => {
                            onTabChange?.("settings");
                            setProfileDropdownOpen(false);
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-slate-300 hover:text-white hover:bg-white/5 transition"
                        >
                          <Settings size={14} />
                          <span>Settings</span>
                        </button>
                        <button
                          onClick={handleLogout}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-red-400 hover:bg-red-500/10 transition mt-1 border-t border-white/5 pt-2"
                        >
                          <LogOut size={14} />
                          <span>Log out</span>
                        </button>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </header>

          {/* Page Body */}
          <main className="flex-1 p-4 lg:p-8 max-w-[1600px] w-full mx-auto">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
