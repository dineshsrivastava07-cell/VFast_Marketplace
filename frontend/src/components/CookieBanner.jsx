import React, { useEffect, useState } from "react";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";

const COOKIE_KEY = "vfast.consent";

function readChoice() { try { return JSON.parse(localStorage.getItem(COOKIE_KEY) || "null"); } catch { return null; } }

export default function CookieBanner() {
  const { user } = useAuth();
  const [banner, setBanner] = useState(null);
  const [choice, setChoice] = useState(readChoice());
  const [open, setOpen] = useState(false);

  useEffect(() => {
    api.get("/dpdp/banner-settings").then((r) => {
      setBanner(r.data);
      if (r.data?.enabled && !readChoice()) setOpen(true);
    }).catch(() => {});
  }, []);

  if (!banner || !banner.enabled || choice || !open) return null;

  const persist = async (granted) => {
    const next = { granted, policy_version: banner.policy_version || "v1.0", at: new Date().toISOString() };
    localStorage.setItem(COOKIE_KEY, JSON.stringify(next));
    setChoice(next); setOpen(false);
    if (user) {
      // Record consents for marketing + analytics
      try {
        await Promise.all(["marketing", "analytics"].map((purpose) =>
          api.post("/dpdp/consents", { purpose, granted, policy_version: next.policy_version })
        ));
      } catch { /* silent */ }
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-3 pointer-events-none" data-testid="cookie-banner">
      <div className="max-w-3xl mx-auto bg-white border border-gray-200 rounded-2xl shadow-xl p-4 pointer-events-auto">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <div className="font-display font-bold text-sm">{banner.title}</div>
            <p className="text-xs text-gray-600 mt-1 leading-relaxed">{banner.body}{" "}
              <a href={banner.policy_url || "/privacy-policy"} className="text-[#E4002B] underline">Read policy</a>
            </p>
          </div>
          <div className="flex flex-col gap-1 shrink-0">
            <button data-testid="cookie-accept" onClick={() => persist(true)} className="btn-primary py-1.5 px-3 text-xs">Accept</button>
            <button data-testid="cookie-reject" onClick={() => persist(false)} className="text-xs text-gray-600 hover:text-gray-900 px-2 py-1">Reject non-essential</button>
          </div>
        </div>
      </div>
    </div>
  );
}
