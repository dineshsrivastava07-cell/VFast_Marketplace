import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

const Ctx = createContext(null);

const STORAGE_KEY = "vfast_cart_v1";

function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
  catch { return {}; }
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(load); // { [product_id]: { product, qty } }
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const add = (product, qty = 1) => {
    setItems((prev) => {
      const cur = prev[product.id] || { product, qty: 0 };
      const nextQty = Math.min(cur.qty + qty, product.stock || 50);
      return { ...prev, [product.id]: { product, qty: nextQty } };
    });
  };

  const remove = (productId, qty = 1) => {
    setItems((prev) => {
      const cur = prev[productId];
      if (!cur) return prev;
      const nextQty = cur.qty - qty;
      const next = { ...prev };
      if (nextQty <= 0) delete next[productId];
      else next[productId] = { ...cur, qty: nextQty };
      return next;
    });
  };

  const setQty = (productId, qty) => {
    setItems((prev) => {
      if (qty <= 0) {
        const n = { ...prev }; delete n[productId]; return n;
      }
      return { ...prev, [productId]: { ...prev[productId], qty } };
    });
  };

  const clear = () => setItems({});

  const lines = useMemo(() => Object.values(items), [items]);
  const itemCount = lines.reduce((s, l) => s + l.qty, 0);
  const subtotal = lines.reduce((s, l) => s + l.product.price * l.qty, 0);
  const mrpTotal = lines.reduce((s, l) => s + l.product.mrp * l.qty, 0);
  const savings = Math.max(0, mrpTotal - subtotal);

  return (
    <Ctx.Provider value={{
      items, lines, itemCount, subtotal, savings,
      add, remove, setQty, clear,
      drawerOpen, setDrawerOpen,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export const useCart = () => useContext(Ctx);
