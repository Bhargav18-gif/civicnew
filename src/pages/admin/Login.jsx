import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Mail, Lock, Eye, EyeOff, LogIn, AlertCircle, ShieldAlert } from "lucide-react";
import { motion } from "framer-motion";
import AuthLayout from "../../components/auth/AuthLayout.jsx";
import Input from "../../components/ui/Input.jsx";
import Button from "../../components/ui/Button.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { ROLES } from "../../constants/workflow.js";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user, login } = useAuth();

  useEffect(() => {
    // If admin is already authenticated, route directly to admin dashboard
    if (user && (user.role === ROLES.ADMIN || user.role === 'admin')) {
      navigate("/admin/dashboard", { replace: true });
    }
  }, [user, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const authenticatedUser = await login(email.trim(), password);
      
      const userRole = (authenticatedUser.role || "").toLowerCase();
      if (userRole !== ROLES.ADMIN) {
        setError("Access restricted. This account does not possess administrator privileges.");
        return;
      }

      navigate("/admin/dashboard", { replace: true });
    } catch (err) {
      console.error("Admin login error:", err);
      setError(err.message || "Invalid administrator credentials or unauthorized account.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      title="Admin Portal"
      subtitle="Sign in with administrative privileges to manage civic infrastructure and AI exceptions."
    >
      <form onSubmit={handleSubmit}>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 bg-red-500/10 border border-red-400/30 text-red-300 text-sm rounded-xl px-4 py-3 mb-5"
          >
            <AlertCircle size={16} className="flex-shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}

        <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-400/20 text-amber-300 text-xs rounded-xl px-4 py-3 mb-6">
          <ShieldAlert size={16} className="flex-shrink-0 text-amber-400" />
          <span>Restricted system. Access requires verified administrative role in Cloud Firestore.</span>
        </div>

        <Input
          label="Administrator Email"
          type="email"
          icon={Mail}
          placeholder="admin@civicconnect.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <Input
          label="Password"
          type={showPassword ? "text" : "password"}
          icon={Lock}
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          rightElement={
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="text-slate-500 hover:text-slate-300 focus:outline-none transition-colors"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          }
        />

        <Button
          type="submit"
          icon={LogIn}
          className="w-full py-3.5 mt-2"
          disabled={loading}
        >
          {loading ? "Authenticating..." : "Admin Access"}
        </Button>
      </form>
    </AuthLayout>
  );
}