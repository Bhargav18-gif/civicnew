import RoleRoute from "./RoleRoute.jsx";
import { ROLES } from "../../constants/workflow.js";

export default function AdminRoute({ children }) {
  return (
    <RoleRoute allowedRoles={[ROLES.ADMIN]}>
      {children}
    </RoleRoute>
  );
}
