import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Helmet } from "../components/Helmet";
import { toast } from "sonner";
import GoogleSignInButton from "../components/GoogleSignInButton";

export default function Login() {
  const { requestOtp, verifyOtp } = useAuth();
  const navigate = useNavigate();
  const [phone, setPhone] = useState("+91");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState("");
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");

  const formatPhone = (v) => {
    let p = v.replace(/\s/g, "");
    if (!p.startsWith("+91") && /^\d/.test(p)) p = "+91" + p.replace(/^\+?91/, "");
    return p;
  };

  const sendOtp = async (e) => {
    e?.preventDefault();
    setError(""); setLoading(true);
    try {
      const r = await requestOtp(phone);
      setDevCode(r.dev_code || "");
      setStep(2);
      toast.success(r.dev_code ? `OTP sent to ${phone}. Use ${r.dev_code} (mock mode).` : `OTP sent to ${phone}.`);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to send OTP");
    } finally { setLoading(false); }
  };

  const resendOtp = async () => {
    setResending(true); setError("");
    try {
      const r = await requestOtp(phone);
      setDevCode(r.dev_code || "");
      toast.success("OTP resent.");
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to resend OTP");
    } finally { setResending(false); }
  };

  const verify = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      await verifyOtp(phone, code);
      toast.success("Welcome to VFast!");
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.detail || "Invalid OTP");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4" data-testid="login-page">
      <Helmet title="Login" />
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
        <div className="flex items-center gap-2 mb-2">
          <img src="/icons/vfast-logo.png" alt="VFast" className="h-9 w-9 rounded-lg"/>
          <div className="font-display font-extrabold text-[#E4002B] text-xl">VFast</div>
        </div>
        <h1 className="font-display text-2xl font-bold">Login or sign up</h1>
        <p className="text-sm text-gray-500 mt-1">Indian mobile numbers only. We'll send a one-time password.</p>

        {step === 1 && (
          <form className="mt-6 space-y-3" onSubmit={sendOtp}>
            <label className="block text-xs font-semibold text-gray-500">Mobile number</label>
            <input
              data-testid="login-phone"
              autoFocus
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#E4002B] focus:ring-2 focus:ring-[#E4002B]/10"
              placeholder="Enter your 10-digit mobile"
            />
            {error && <div data-testid="login-error" className="text-red-600 text-sm">{error}</div>}
            <button data-testid="send-otp-btn" disabled={loading} className="w-full btn-primary py-3 disabled:opacity-60">
              {loading ? "Sending..." : "Send OTP"}
            </button>

            <div className="relative my-4 text-center">
              <span className="absolute inset-0 flex items-center"><span className="w-full border-t border-gray-100" /></span>
              <span className="relative bg-white px-2 text-[11px] uppercase tracking-wider text-gray-400">or</span>
            </div>
            <GoogleSignInButton
              audience="customer"
              onSuccess={() => { toast.success("Welcome to VFast!"); navigate("/"); }}
              onError={(m) => setError(m)}
            />
            <p className="text-[11px] text-gray-400 text-center mt-2">
              Staff / Admin / Rider / Seller? <a href="/admin/login" data-testid="goto-staff-login" className="text-[#E4002B] font-semibold">Sign in here →</a>
            </p>
          </form>
        )}

        {step === 2 && (
          <form className="mt-6 space-y-3" onSubmit={verify}>
            {devCode && <div data-testid="dev-otp-banner" className="bg-amber-50 border border-amber-100 text-amber-800 rounded-xl p-3 text-xs">Mock mode — your OTP is <span className="font-bold">{devCode}</span></div>}
            <label className="block text-xs font-semibold text-gray-500">Enter 6-digit OTP sent to {phone}</label>
            <input
              data-testid="login-otp"
              autoFocus
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl tracking-[0.4em] text-center font-display font-bold text-2xl focus:outline-none focus:border-[#E4002B] focus:ring-2 focus:ring-[#E4002B]/10"
              placeholder="000000"
            />
            {error && <div data-testid="login-error" className="text-red-600 text-sm">{error}</div>}
            <button data-testid="verify-otp-btn" disabled={loading || code.length !== 6} className="w-full btn-primary py-3 disabled:opacity-60">
              {loading ? "Verifying..." : "Verify & continue"}
            </button>
            <div className="flex justify-between text-xs">
              <button type="button" onClick={() => setStep(1)} className="text-gray-500 underline">Change number</button>
              <button type="button" data-testid="resend-otp-btn" disabled={resending} onClick={resendOtp} className="text-[#E4002B] font-semibold disabled:opacity-50">
                {resending ? "Sending…" : "Resend OTP"}
              </button>
            </div>
          </form>
        )}

        <p className="mt-6 text-[11px] text-gray-400 leading-relaxed">By continuing you agree to VFast's Terms and acknowledge our Privacy Notice (DPDP Act, India).</p>
      </div>
    </div>
  );
}
