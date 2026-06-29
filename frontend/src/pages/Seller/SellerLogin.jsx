import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Helmet } from "../../components/Helmet";
import { toast } from "sonner";

export default function SellerLogin() {
  const { emailLogin } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("seller@vfast.local");
  const [password, setPassword] = useState("seller123");
  const [loading, setLoading] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      const u = await emailLogin(email, password);
      if (u.role !== "seller") { toast.error("Not a seller account"); setLoading(false); return; }
      navigate("/seller");
    } catch (e) { toast.error(e.response?.data?.detail || "Login failed"); }
    finally { setLoading(false); }
  };
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-rose-50 to-amber-50 px-4" data-testid="seller-login-page">
      <Helmet title="Seller login" />
      <form onSubmit={submit} className="w-full max-w-md bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8">
        <div className="flex items-center gap-2 mb-2">
          <img src="/icons/vfast-logo.png" alt="VFast" className="h-9 w-9 rounded-lg" />
          <div>
            <div className="font-display font-extrabold text-[#E4002B] text-lg">VFast</div>
            <div className="text-[10px] uppercase tracking-wider text-gray-500">Seller Portal</div>
          </div>
        </div>
        <h1 className="font-display text-2xl font-bold mt-3">Seller login</h1>
        <p className="text-xs text-gray-500 mb-4">Use your VFast seller credentials.</p>
        <input data-testid="seller-email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 mb-2" />
        <input data-testid="seller-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 mb-3" />
        <button data-testid="seller-login-btn" disabled={loading} className="w-full btn-primary py-2.5 disabled:opacity-60">{loading ? "Logging in…" : "Login"}</button>
        <div className="text-xs text-center text-gray-500 mt-4">
          <Link to="/" className="text-[#E4002B]">← Storefront</Link>
          <span className="mx-2">·</span>
          <Link to="/admin/login" className="text-[#E4002B]">Admin login</Link>
        </div>
      </form>
    </div>
  );
}
