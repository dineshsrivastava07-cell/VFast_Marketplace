import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { Helmet } from "../../components/Helmet";
import { toast } from "sonner";

export default function AdminLogin() {
  const { emailLogin } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@vfast.local");
  const [password, setPassword] = useState("admin123");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true); setErr("");
    try {
      const u = await emailLogin(email, password);
      if (u.role === "customer") { setErr("Use the customer login (phone OTP) instead."); return; }
      toast.success(`Welcome, ${u.name || u.email}`);
      if (u.role === "seller") navigate("/seller");
      else if (u.role === "delivery_partner") navigate("/rider");
      else navigate("/admin");
    } catch (e) {
      setErr(e.response?.data?.detail || "Login failed");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4" data-testid="admin-login-page">
      <Helmet title="Staff Login" />
      <form onSubmit={submit} className="w-full max-w-md bg-white rounded-2xl border border-gray-100 p-6 sm:p-8 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <img src="/icons/vfast-logo.png" alt="VFast" className="h-9 w-9 rounded-lg" />
          <div className="font-display font-extrabold text-[#E4002B] text-xl">VFast · Staff</div>
        </div>
        <h1 className="font-display text-2xl font-bold">Staff / admin login</h1>
        <p className="text-sm text-gray-500 mt-1">For super admin, admin, ops, seller and rider accounts.</p>
        <div className="mt-6 space-y-3 text-sm">
          <input data-testid="admin-email" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="Email" className="w-full px-4 py-3 border border-gray-200 rounded-xl" />
          <input data-testid="admin-password" type="password" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="Password" className="w-full px-4 py-3 border border-gray-200 rounded-xl" />
          {err && <div data-testid="admin-login-error" className="text-red-600 text-sm">{err}</div>}
          <button data-testid="admin-login-submit" disabled={loading} className="w-full btn-primary py-3 disabled:opacity-60">{loading ? "Signing in..." : "Sign in"}</button>
        </div>
        <div className="mt-4 text-[11px] text-gray-500 leading-relaxed">
          Demo accounts: super.admin@vfast.local / admin@vfast.local / ops@vfast.local / seller@vfast.local / rider@vfast.local — all use the password from your seed env.
        </div>
      </form>
    </div>
  );
}
