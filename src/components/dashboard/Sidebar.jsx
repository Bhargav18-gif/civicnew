import {
  LayoutDashboard,
  FileText,
  Search,
  Bell,
  Settings,
  LogOut,
} from "lucide-react";
import Logo from "../ui/Logo.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { useNavigate, useLocation } from "react-router-dom";

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: "Overview" },
  { icon: FileText, label: "My Reports" },
  { icon: Search, label: "Track" },
  { icon: Bell, label: "Notifications" },
  { icon: Settings, label: "Settings" },
];

export default function Sidebar({ active, setActive }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  function handleLogout() {
    logout();
    navigate("/");
  }

  return (
    <aside className="hidden lg:flex flex-col w-64 h-screen sticky top-0 glass border-r border-white/5 px-5 py-7">

      <div className="mb-10 px-1 cursor-pointer" onClick={() => navigate("/")}>
        <Logo size={30} />
      </div>

      <nav className="flex-1 space-y-2">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.label}
            onClick={() => {
              if (item.label === "Track") {
                if (location.pathname !== "/track") {
                  navigate("/track");
                }
              } else {
                if (location.pathname !== "/dashboard") {
                  navigate("/dashboard", { state: { defaultTab: item.label } });
                }
                if (setActive) {
                  setActive(item.label);
                }
              }
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition ${
              active === item.label
                ? "bg-cyan-500/20 text-white"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <item.icon size={18} />
            {item.label}
          </button>
        ))}
      </nav>

      <div className="border-t border-white/10 pt-5">

        <div className="flex items-center gap-3 px-2 mb-4">
          <div className="w-9 h-9 rounded-full bg-cyan-500 flex items-center justify-center font-bold text-white">
            {user?.name?.[0] || "C"}
          </div>

          <div className="overflow-hidden">
            <p className="truncate font-medium">{user?.name || "Citizen"}</p>
            <p className="text-xs text-slate-400 truncate">{user?.email || "Guest User"}</p>
          </div>
        </div>

        {user ? (
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-red-500/10 text-slate-300 hover:text-red-400 transition"
          >
            <LogOut size={18} />
            Logout
          </button>
        ) : (
          <button
            onClick={() => navigate("/login")}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-cyan-500/10 text-cyan-400 transition"
          >
            <LogOut size={18} />
            Sign In
          </button>
        )}

      </div>
    </aside>
  );
}