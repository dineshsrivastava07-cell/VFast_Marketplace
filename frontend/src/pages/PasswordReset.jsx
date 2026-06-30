import React, { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Helmet } from "../components/Helmet";
import { toast } from "sonner";

export default function PasswordReset() {
  const { confirmPasswordReset } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (pw.length < 6) return setErr("Password must be at least 6 characters");
    if (pw !== pw2) return setErr("Passwords don't match");
    setLoading(true);
    try {
      await confirmPasswordReset(token, pw);
      toast.success("Password updated. Please sign in.");
      navigate("/admin/login");
    } catch (e) {
      setErr(e.response?.data?.detail || "Reset failed");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gray-50" data-testid="password-reset-page">
      <Helmet title="Reset password" />
      <form onSubmit={submit} className="w-full max-w-md bg-white rounded-2xl border border-gray-100 p-6 sm:p-8 shadow-sm">
        <h1 className="font-display text-2xl font-bold">Reset your password</h1>
        <p className="text-sm text-gray-500 mt-1">Enter a new password for your VFast account.</p>
        {!token && <div className="mt-3 bg-red-50 border border-red-100 text-red-700 text-sm rounded-lg p-3">Missing token — open the reset link from your email.</div>}
        <div className="mt-5 space-y-3 text-sm">
          <input data-testid="reset-pw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password (min 6 chars)" className="w-full px-4 py-3 border border-gray-200 rounded-xl" />
          <input data-testid="reset-pw2" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Confirm new password" className="w-full px-4 py-3 border border-gray-200 rounded-xl" />
          {err && <div data-testid="reset-error" className="text-red-600 text-sm">{err}</div>}
          <button data-testid="reset-confirm" disabled={loading || !token} className="w-full btn-primary py-3 disabled:opacity-60">{loading ? "Saving..." : "Set new password"}</button>
          <Link to="/admin/login" className="text-xs text-gray-500 underline block text-center">Back to staff login</Link>
        </div>
      </form>
    </div>
  );
}
