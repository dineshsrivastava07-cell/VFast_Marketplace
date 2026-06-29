import React from "react";
import { X, Plus, Minus, ShoppingBag } from "lucide-react";
import { useCart } from "../context/CartContext";
import { useNavigate } from "react-router-dom";

export default function CartDrawer() {
  const { drawerOpen, setDrawerOpen, lines, subtotal, savings, add, remove, itemCount } = useCart();
  const navigate = useNavigate();
  if (!drawerOpen) return null;
  const goCheckout = () => { setDrawerOpen(false); navigate("/checkout"); };

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex justify-end" onClick={() => setDrawerOpen(false)}>
      <div
        data-testid="cart-drawer"
        className="bg-white w-full sm:max-w-md h-full flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="font-display font-bold text-lg">Your cart</div>
          <button data-testid="cart-close" onClick={() => setDrawerOpen(false)} className="p-2 rounded-lg hover:bg-gray-50"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
          {itemCount === 0 && (
            <div className="text-center text-gray-500 py-12">
              <ShoppingBag className="h-10 w-10 mx-auto text-gray-300" />
              <div className="mt-3 text-sm">Your cart is empty.</div>
            </div>
          )}
          <div className="space-y-3">
            {lines.map(({ product, qty }) => (
              <div key={product.id} data-testid={`cart-line-${product.slug}`} className="flex items-center gap-3 bg-white p-3 rounded-xl border border-gray-100">
                <img src={product.image} alt={product.name} className="h-14 w-14 rounded-lg object-cover bg-gray-50" />
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{product.name}</div>
                  <div className="text-xs text-gray-500">{product.pack_size}</div>
                  <div className="font-display font-bold mt-1">₹{product.price * qty}</div>
                </div>
                <div className="flex items-center gap-1 bg-[#E4002B] text-white rounded-lg h-9 px-1 w-24 justify-between font-bold">
                  <button onClick={() => remove(product.id)} className="w-8 h-9 flex items-center justify-center"><Minus className="h-4 w-4" /></button>
                  <span className="text-sm">{qty}</span>
                  <button onClick={() => add(product)} className="w-8 h-9 flex items-center justify-center"><Plus className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {itemCount > 0 && (
          <div className="p-4 border-t border-gray-100 bg-white space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span className="font-display font-bold">₹{Math.round(subtotal)}</span>
            </div>
            {savings > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-green-700">You're saving</span>
                <span className="font-bold text-green-700">₹{Math.round(savings)}</span>
              </div>
            )}
            <button data-testid="checkout-btn" onClick={goCheckout} className="w-full btn-primary py-3 text-sm">
              Proceed to checkout →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
