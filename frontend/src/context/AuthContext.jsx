import React, { createContext, useContext, useEffect, useState } from "react";
import api from "../lib/api";

const Ctx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = loading
  const [token, setToken] = useState(() => localStorage.getItem("vfast_token"));
  const [googleConfig, setGoogleConfig] = useState({ enabled: false, client_id: null });

  useEffect(() => {
    api.get("/auth/google/config").then((r) => setGoogleConfig(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!token) { setUser(null); return; }
    api.get("/auth/me").then((r) => setUser(r.data)).catch(() => {
      localStorage.removeItem("vfast_token");
      setToken(null);
      setUser(null);
    });
  }, [token]);

  const _persist = (data) => {
    localStorage.setItem("vfast_token", data.token);
    setToken(data.token); setUser(data.user);
    return data.user;
  };

  const requestOtp = async (phone) => (await api.post("/auth/otp/request", { phone })).data;
  const verifyOtp = async (phone, code) => _persist((await api.post("/auth/otp/verify", { phone, code })).data);
  const emailLogin = async (email, password) => _persist((await api.post("/auth/login", { email, password })).data);
  const googleCustomer = async (credential) => _persist((await api.post("/auth/google/customer", { credential })).data);
  const googleStaff = async (credential) => _persist((await api.post("/auth/google/staff", { credential })).data);
  const requestPasswordReset = async (email) => (await api.post("/auth/password-reset/request", { email })).data;
  const confirmPasswordReset = async (token, new_password) => (await api.post("/auth/password-reset/confirm", { token, new_password })).data;
  const logout = () => {
    localStorage.removeItem("vfast_token");
    setToken(null); setUser(null);
  };

  return (
    <Ctx.Provider value={{
      user, token, googleConfig,
      requestOtp, verifyOtp, emailLogin,
      googleCustomer, googleStaff,
      requestPasswordReset, confirmPasswordReset,
      logout, setUser,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
