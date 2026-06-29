import React from "react";
import { useCart } from "../../context/CartContext";
import { ShoppingCart } from "lucide-react";

export default function BottomCartBar() {
  const { itemCount, subtotal, setDrawerOpen } = useCart();
  if (itemCount === 0) return null;
  return (
    <div
      data-testid="sticky-bottom-cart"
      className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-gray-100 px-4 py-3 shadow-[0_-6px_20px_rgba(0,0,0,0.06)]"
    >
      <button onClick={() => setDrawerOpen(true)} className="w-full flex items-center justify-between btn-primary px-4 py-3">
        <span className="flex items-center gap-2 text-sm">
          <ShoppingCart className="h-4 w-4" />
          {itemCount} item{itemCount === 1 ? "" : "s"} · ₹{Math.round(subtotal)}
        </span>
        <span className="text-sm">View Cart →</span>
      </button>
    </div>
  );
}
