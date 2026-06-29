import React, { createContext, useContext, useEffect, useState } from "react";
import api from "../lib/api";

const Ctx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = loading
  const [token, setToken] = useState(() => localStorage.getItem("vfast_token"));

  useEffect(() => {
    if (!token) { setUser(null); return; }
    api.get("/auth/me").then((r) => setUser(r.data)).catch(() => {
      localStorage.removeItem("vfast_token");
      setToken(null);
      setUser(null);
    });
  }, [token]);

  const requestOtp = async (phone) => (await api.post("/auth/otp/request", { phone })).data;
  const verifyOtp = async (phone, code) => {
    const { data } = await api.post("/auth/otp/verify", { phone, code });
    localStorage.setItem("vfast_token", data.token);
    setToken(data.token); setUser(data.user);
    return data.user;
  };
  const emailLogin = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    localStorage.setItem("vfast_token", data.token);
    setToken(data.token); setUser(data.user);
    return data.user;
  };
  const logout = () => {
    localStorage.removeItem("vfast_token");
    setToken(null); setUser(null);
  };

  return (
    <Ctx.Provider value={{ user, token, requestOtp, verifyOtp, emailLogin, logout, setUser }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
