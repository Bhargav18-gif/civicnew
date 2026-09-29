import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { ROLES } from "../../constants/workflow.js";

/**
 * Enforces role-based route access.
 * Only users with matching roles (or Admin, who has universal oversight) may access.
 */
export default function RoleRoute({ allowedRoles = [], children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="w-10 h-10 rounded-full border-2 border-cyan-400/30 border-t-cyan-400 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const userRole = (user.role || ROLES.CITIZEN).toLowerCase();
  const normalizedAllowed = allowedRoles.map(r => r.toLowerCase());

  // Admins can inspect all role workspaces
  const isAuthorized = userRole === ROLES.ADMIN || normalizedAllowed.includes(userRole);

  if (!isAuthorized) {
    // Redirect to the appropriate home for their role
    if (userRole === ROLES.DEPARTMENT) return <Navigate to="/department/dashboard" replace />;
    if (userRole === ROLES.ENGINEER) return <Navigate to="/engineer/dashboard" replace />;
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
