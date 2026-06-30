import React, { useEffect } from "react";
import { GoogleOAuthProvider, GoogleLogin } from "@react-oauth/google";
import { useAuth } from "../context/AuthContext";

/**
 * Compact wrapper around @react-oauth/google's <GoogleLogin>.
 * REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
 *
 * Props:
 *   audience: "customer" | "staff" — picks which backend endpoint to call.
 *   onSuccess(user): called with the user object after JWT is stored.
 *   onError(msg): called with a friendly error message.
 */
export default function GoogleSignInButton({ audience = "customer", onSuccess, onError, label = "Continue with Google" }) {
  const { googleConfig, googleCustomer, googleStaff } = useAuth();
  const enabled = !!googleConfig?.enabled && !!googleConfig?.client_id;

  // Lazy-set provider container size for the Google button via CSS hack.
  useEffect(() => {}, []);

  if (!enabled) {
    return (
      <button
        type="button"
        disabled
        data-testid={`google-signin-${audience}-disabled`}
        className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-400 text-sm font-semibold flex items-center justify-center gap-2"
        title="Google Sign-In coming soon — admin can configure GOOGLE_CLIENT_ID in backend env"
      >
        <GoogleLogo />
        Google Sign-In · coming soon
      </button>
    );
  }

  const handle = async (resp) => {
    const credential = resp?.credential;
    if (!credential) { onError?.("Google did not return a credential"); return; }
    try {
      const user = audience === "staff"
        ? await googleStaff(credential)
        : await googleCustomer(credential);
      onSuccess?.(user);
    } catch (e) {
      onError?.(e.response?.data?.detail || "Google sign-in failed");
    }
  };

  return (
    <GoogleOAuthProvider clientId={googleConfig.client_id}>
      <div data-testid={`google-signin-${audience}`} className="w-full flex justify-center">
        <GoogleLogin
          onSuccess={handle}
          onError={() => onError?.("Google sign-in failed")}
          text={label === "Continue with Google" ? "continue_with" : "signin_with"}
          size="large"
          width="320"
          shape="pill"
        />
      </div>
    </GoogleOAuthProvider>
  );
}

function GoogleLogo() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84c-.21 1.12-.84 2.07-1.79 2.71v2.25h2.9c1.7-1.56 2.69-3.87 2.69-6.6z" /><path fill="#34A853" d="M9 18c2.43 0 4.47-.81 5.96-2.19l-2.9-2.25c-.81.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.32A9 9 0 0 0 9 18z" /><path fill="#FBBC05" d="M3.95 10.7a5.4 5.4 0 0 1 0-3.4V4.96H.96a9 9 0 0 0 0 8.08l2.99-2.34z" /><path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l2.99 2.34C4.66 5.17 6.65 3.58 9 3.58z" /></svg>
  );
}
