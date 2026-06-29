import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { Helmet } from "../components/Helmet";
import { Heart, ShoppingCart, X } from "lucide-react";
import { toast } from "sonner";

export default function Wishlist() {
  const { user } = useAuth();
  const { addToCart } = useCart();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try { const r = await api.get("/wishlist"); setItems(r.data.items || []); }
    catch { /* silent */ } finally { setLoading(false); }
  };
  useEffect(() => { if (user) load(); }, [user]);

  if (!user) return <div className="p-8 max-w-3xl mx-auto" data-testid="wishlist-need-login">
    <h1 className="font-display text-2xl font-bold mb-2">Your wishlist</h1>
    <p className="text-sm text-gray-500">Please <Link to="/login" className="text-[#E4002B] font-semibold">login</Link> to view your saved items.</p>
  </div>;

  const remove = async (pid) => {
    try { await api.delete(`/wishlist/${pid}`); setItems((x) => x.filter((p) => p.id !== pid)); }
    catch { toast.error("Failed"); }
  };
  const moveToCart = async (p) => {
    try { await addToCart(p, 1); await api.delete(`/wishlist/${p.id}`); setItems((x) => x.filter((q) => q.id !== p.id)); toast.success("Moved to cart"); }
    catch { toast.error("Failed"); }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6" data-testid="wishlist-page">
      <Helmet title="My wishlist" />
      <div className="flex items-center gap-2 mb-4">
        <Heart className="h-6 w-6 text-[#E4002B]" />
        <h1 className="font-display text-2xl font-bold">My wishlist <span className="text-gray-400 text-base">({items.length})</span></h1>
      </div>
      {loading ? <div className="text-gray-500">Loading…</div> : items.length === 0 ? (
        <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center" data-testid="wishlist-empty">
          <Heart className="h-10 w-10 text-gray-300 mx-auto mb-2" />
          <h3 className="font-display font-bold">Save things you love</h3>
          <p className="text-sm text-gray-500 mb-3">Tap the heart on any product to add it here.</p>
          <button onClick={() => navigate("/")} className="btn-primary py-2 px-4 text-sm">Continue shopping</button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((p) => (
            <div key={p.id} className="bg-white border border-gray-100 rounded-2xl overflow-hidden relative" data-testid={`wl-${p.id}`}>
              <button onClick={() => remove(p.id)} className="absolute top-2 right-2 z-10 h-8 w-8 rounded-full bg-white border border-gray-100 flex items-center justify-center" data-testid={`wl-remove-${p.id}`}><X className="h-4 w-4 text-gray-500" /></button>
              <Link to={`/p/${p.slug}`}><img src={p.image} alt={p.name} className="w-full h-40 object-cover" /></Link>
              <div className="p-3">
                <Link to={`/p/${p.slug}`} className="font-semibold line-clamp-2 text-sm">{p.name}</Link>
                <div className="text-xs text-gray-500">{p.brand} · {p.pack_size}</div>
                <div className="flex items-center justify-between mt-2">
                  <div className="font-display font-extrabold">₹{p.price}</div>
                  <button data-testid={`wl-tocart-${p.id}`} onClick={() => moveToCart(p)} className="text-xs btn-primary py-1.5 px-3 flex items-center gap-1"><ShoppingCart className="h-3.5 w-3.5" />Move to cart</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
