import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "../../components/Helmet";
import { toast } from "sonner";
import GoogleSignInButton from "../../components/GoogleSignInButton";

export default function AdminLogin() {
  const { emailLogin, requestPasswordReset } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@vfast.local");
  const [password, setPassword] = useState("admin123");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSending, setResetSending] = useState(false);

  const routeForRole = (role) => {
    if (role === "seller") return "/seller";
    if (role === "delivery_partner") return "/rider";
    return "/admin";
  };

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true); setErr("");
    try {
      const u = await emailLogin(email, password);
      toast.success(`Welcome, ${u.name || u.email}`);
      navigate(routeForRole(u.role));
    } catch (e) {
      setErr(e.response?.data?.detail || "Login failed");
    } finally { setLoading(false); }
  };

  const submitReset = async () => {
    if (!resetEmail) return;
    setResetSending(true);
    try {
      await requestPasswordReset(resetEmail);
      toast.success("If an account exists, a reset link has been emailed.");
      setResetOpen(false); setResetEmail("");
    } catch { toast.error("Failed"); }
    finally { setResetSending(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gray-50" data-testid="admin-login-page">
      <Helmet title="Staff Login" />
      <form onSubmit={submit} className="w-full max-w-md bg-white rounded-2xl border border-gray-100 p-6 sm:p-8 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <img src="/icons/vfast-logo.png" alt="VFast" className="h-9 w-9 rounded-lg" />
          <div className="font-display font-extrabold text-[#E4002B] text-xl">VFast · Staff</div>
        </div>
        <h1 className="font-display text-2xl font-bold">Staff / admin login</h1>
        <p className="text-sm text-gray-500 mt-1">For super admin, admin, ops, seller and rider accounts only.</p>
        <div className="mt-6 space-y-3 text-sm">
          <input data-testid="admin-email" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="Work email" className="w-full px-4 py-3 border border-gray-200 rounded-xl" />
          <input data-testid="admin-password" type="password" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="Password" className="w-full px-4 py-3 border border-gray-200 rounded-xl" />
          {err && <div data-testid="admin-login-error" className="text-red-600 text-sm">{err}</div>}
          <button data-testid="admin-login-submit" disabled={loading} className="w-full btn-primary py-3 disabled:opacity-60">{loading ? "Signing in..." : "Sign in"}</button>
          <div className="flex justify-between text-xs">
            <Link to="/login" className="text-gray-500 underline" data-testid="goto-customer-login">I'm a customer →</Link>
            <button type="button" data-testid="forgot-password-btn" onClick={() => { setResetEmail(email); setResetOpen(true); }} className="text-[#E4002B] font-semibold">Forgot password?</button>
          </div>
          <div className="relative my-3 text-center">
            <span className="absolute inset-0 flex items-center"><span className="w-full border-t border-gray-100" /></span>
            <span className="relative bg-white px-2 text-[11px] uppercase tracking-wider text-gray-400">or</span>
          </div>
          <GoogleSignInButton
            audience="staff"
            onSuccess={(u) => { toast.success(`Welcome, ${u.name || u.email}`); navigate(routeForRole(u.role)); }}
            onError={(m) => setErr(m)}
          />
        </div>
        <div className="mt-4 text-[11px] text-gray-500 leading-relaxed">
          Staff Google accounts must be on <code>@vmart.co.in</code> / <code>@vmartretail.com</code> / <code>@limeroad.com</code>.
        </div>
      </form>

      {resetOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setResetOpen(false)}>
          <div className="bg-white rounded-2xl max-w-sm w-full p-5" onClick={(e) => e.stopPropagation()} data-testid="forgot-password-modal">
            <h3 className="font-display font-bold text-lg mb-2">Reset password</h3>
            <p className="text-xs text-gray-500 mb-3">Enter your work email. We'll send a reset link valid for 2 hours.</p>
            <input data-testid="reset-email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} placeholder="you@vmart.co.in" className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm" />
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => setResetOpen(false)} className="text-sm text-gray-500">Cancel</button>
              <button data-testid="reset-submit" disabled={resetSending} onClick={submitReset} className="btn-primary px-4 py-2 text-sm disabled:opacity-60">{resetSending ? "Sending…" : "Send reset link"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
