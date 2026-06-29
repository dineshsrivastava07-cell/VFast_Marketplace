import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Helmet } from "../../components/Helmet";
import { toast } from "sonner";
import { Bike } from "lucide-react";

export default function RiderLogin() {
  const { emailLogin } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("rider@vfast.local");
  const [password, setPassword] = useState("rider123");
  const [loading, setLoading] = useState(false);
  const submit = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      const u = await emailLogin(email, password);
      if (u.role !== "delivery_partner") { toast.error("Not a rider account"); setLoading(false); return; }
      navigate("/rider");
    } catch (e) { toast.error(e.response?.data?.detail || "Login failed"); }
    finally { setLoading(false); }
  };
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-rose-900 px-4 text-white" data-testid="rider-login-page">
      <Helmet title="Rider login" />
      <form onSubmit={submit} className="w-full max-w-sm bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-10 w-10 rounded-full bg-[#E4002B] flex items-center justify-center"><Bike className="h-5 w-5" /></div>
          <div>
            <div className="font-display font-extrabold text-xl">VFast</div>
            <div className="text-[10px] uppercase tracking-wider text-white/60">Rider app</div>
          </div>
        </div>
        <h1 className="font-display text-2xl font-bold">Rider login</h1>
        <p className="text-xs text-white/70 mb-4">Sign in to accept deliveries.</p>
        <input data-testid="rider-email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="w-full px-3 py-2.5 rounded-xl border border-white/20 bg-white/10 placeholder:text-white/40 mb-2" />
        <input data-testid="rider-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="w-full px-3 py-2.5 rounded-xl border border-white/20 bg-white/10 placeholder:text-white/40 mb-3" />
        <button data-testid="rider-login-btn" disabled={loading} className="w-full bg-[#E4002B] hover:bg-[#c50026] py-2.5 rounded-xl font-semibold disabled:opacity-60">{loading ? "Logging in…" : "Login"}</button>
        <div className="text-xs text-center text-white/60 mt-4">
          <Link to="/" className="underline">← Storefront</Link>
        </div>
      </form>
    </div>
  );
}
