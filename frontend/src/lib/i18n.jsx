// Minimal i18n with EN/HI dictionary fetched from backend. Falls back to a built-in copy.
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import api from "./api";

const FALLBACK = {
  en: {
    delivery_to: "Delivery to",
    search_placeholder: "Search for milk, bread, eggs...",
    view_cart: "View Cart",
    add: "ADD",
    place_order: "Place Order",
    cod: "Cash on Delivery",
    upi_qr: "UPI QR (Scan & Pay)",
    login_with_otp: "Login with OTP",
    phone_label: "Mobile number",
    send_otp: "Send OTP",
    verify: "Verify",
    minutes: "min",
    shop_categories: "Shop by category",
    popular_now: "Popular right now",
    free_delivery_above: "Free delivery on orders above",
    your_cart: "Your cart",
  },
  hi: {},
};

const Ctx = createContext({ t: (k) => k, lang: "en", setLang: () => {} });

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(() => localStorage.getItem("vfast_lang") || "en");
  const [dict, setDict] = useState(FALLBACK);

  useEffect(() => {
    api.get("/i18n/dictionary").then((r) => setDict(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    localStorage.setItem("vfast_lang", lang);
    document.documentElement.lang = lang === "hi" ? "hi-IN" : "en-IN";
  }, [lang]);

  const value = useMemo(
    () => ({
      lang,
      setLang,
      t: (key) => (dict?.[lang]?.[key]) || dict?.en?.[key] || FALLBACK.en[key] || key,
    }),
    [lang, dict]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);
