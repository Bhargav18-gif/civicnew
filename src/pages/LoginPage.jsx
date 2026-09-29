import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  AlertCircle,
  ShieldCheck
} from "lucide-react";
import { FcGoogle } from "react-icons/fc";

import AuthLayout from "../components/auth/AuthLayout.jsx";
import Input from "../components/ui/Input.jsx";
import Button from "../components/ui/Button.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { loginWithGoogle } from "../utils/googleAuth";
import { ROLES } from "../constants/workflow.js";

export default function LoginPage() {
  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  function handleChange(e) {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  }

  function redirectUserByRole(user) {
    const userRole = (user.role || ROLES.CITIZEN).toLowerCase();
    if (userRole === ROLES.ADMIN) {
      navigate("/admin/dashboard", { replace: true });
    } else if (userRole === ROLES.DEPARTMENT) {
      navigate("/department/dashboard", { replace: true });
    } else if (userRole === ROLES.ENGINEER) {
      navigate("/engineer/dashboard", { replace: true });
    } else {
      navigate(location.state?.from || "/dashboard", { replace: true });
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const user = await login(form.email, form.password);
      redirectUserByRole(user);
    } catch (err) {
      setError(err.message || "Invalid email or password.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    try {
      const user = await loginWithGoogle();
      if (!user) return;
      redirectUserByRole(user);
    } catch (err) {
      setError(err.message || "Google authentication failed.");
    }
  }

  return (
    <AuthLayout
      title="Welcome to CivicConnect"
      subtitle="Sign in securely to report issues or access your departmental dashboard."
    >
      <form onSubmit={handleSubmit}>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 bg-red-500/10 border border-red-400/30 text-red-300 text-sm rounded-xl px-4 py-3 mb-5"
          >
            <AlertCircle size={16} />
            {error}
          </motion.div>
        )}

        <div className="flex items-center gap-2 bg-slate-900/60 border border-slate-700/50 text-slate-300 text-xs rounded-xl px-4 py-3 mb-5">
          <ShieldCheck size={16} className="text-cyan-400 flex-shrink-0" />
          <span>Role-based access is authenticated securely via Firebase & Cloud Firestore.</span>
        </div>

        <Input
          label="Email address"
          type="email"
          name="email"
          icon={Mail}
          placeholder="your.email@example.com"
          value={form.email}
          onChange={handleChange}
          required
        />

        <Input
          label="Password"
          type={showPassword ? "text" : "password"}
          name="password"
          icon={Lock}
          placeholder="••••••••"
          value={form.password}
          onChange={handleChange}
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

        <div className="flex items-center justify-between mt-3 mb-5">
          <label className="flex items-center text-xs text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 rounded border-slate-700 bg-slate-950 text-cyan-400 focus:ring-0 mr-2"
            />
            Remember me
          </label>

          <Link
            to="/forgot-password"
            className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            Forgot password?
          </Link>
        </div>

        <Button
          type="submit"
          icon={LogIn}
          className="w-full py-3.5"
          disabled={loading}
        >
          {loading ? "Authenticating..." : "Sign in"}
        </Button>

        <div className="relative my-6 text-center text-xs text-slate-500">
          <span className="bg-slate-950 px-3 relative z-10">or continue with</span>
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-800" />
          </div>
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800/80 text-slate-200 text-sm font-medium transition-all"
        >
          <FcGoogle size={20} />
          Sign in with Google
        </button>

        <p className="mt-6 text-center text-xs text-slate-400">
          Don't have an account?{" "}
          <Link
            to="/register"
            className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors"
          >
            Create an account
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}