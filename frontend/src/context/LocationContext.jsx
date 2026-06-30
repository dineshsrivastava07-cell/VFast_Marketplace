import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "../lib/api";

const Ctx = createContext(null);
const STORAGE_KEY = "vfast_loc_v1";

export function LocationProvider({ children }) {
  const [pincode, setPincode] = useState(() => localStorage.getItem(STORAGE_KEY) || "");
  const [serviceability, setServiceability] = useState(null);
  const [checking, setChecking] = useState(false);

  const runCheck = useCallback((pin) => {
    if (!/^\d{6}$/.test(pin)) { setServiceability(null); return; }
    setServiceability(null);
    setChecking(true);
    api.get(`/serviceability/check/${pin}`)
      .then((r) => setServiceability(r.data))
      .catch(() => setServiceability({ serviceable: false, pincode: pin }))
      .finally(() => setChecking(false));
    localStorage.setItem(STORAGE_KEY, pin);
  }, []);

  useEffect(() => {
    if (pincode) runCheck(pincode);
  }, [pincode, runCheck]);

  return (
    <Ctx.Provider value={{ pincode, setPincode, serviceability, setServiceability, checking, runCheck }}>
      {children}
    </Ctx.Provider>
  );
}

export const useLocation = () => useContext(Ctx);
