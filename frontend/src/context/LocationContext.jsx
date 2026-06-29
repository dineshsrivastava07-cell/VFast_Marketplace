import React, { createContext, useContext, useEffect, useState } from "react";
import api from "../lib/api";

const Ctx = createContext(null);

const STORAGE_KEY = "vfast_loc_v1";

export function LocationProvider({ children }) {
  const [pincode, setPincode] = useState(() => localStorage.getItem(STORAGE_KEY) || "");
  const [serviceability, setServiceability] = useState(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!/^\d{6}$/.test(pincode)) { setServiceability(null); return; }
    setChecking(true);
    api.get(`/serviceability/check/${pincode}`)
      .then((r) => setServiceability(r.data))
      .finally(() => setChecking(false));
    localStorage.setItem(STORAGE_KEY, pincode);
  }, [pincode]);

  return (
    <Ctx.Provider value={{ pincode, setPincode, serviceability, checking }}>
      {children}
    </Ctx.Provider>
  );
}

export const useLocation = () => useContext(Ctx);
