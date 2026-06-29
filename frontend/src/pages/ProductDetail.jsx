import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../lib/api";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { Plus, Minus, Clock, Zap, ShieldCheck, Heart, Star } from "lucide-react";
import { Helmet } from "../components/Helmet";
import VegMark from "../components/VegMark";
import { toast } from "sonner";

const Row = ({ k, v }) => v ? (
  <div className="flex justify-between text-sm py-1.5 border-b border-gray-100 last:border-0"><span className="text-gray-500">{k}</span><span className="font-semibold text-gray-800">{v}</span></div>
) : null;

export default function ProductDetail() {
  const { slug } = useParams();
  const { items, add, remove } = useCart();
  const { user } = useAuth();
  const [p, setP] = useState(null);
  const [reviews, setReviews] = useState({ reviews: [], rating: 0, count: 0 });
  const [wished, setWished] = useState(false);
  const [reviewForm, setReviewForm] = useState({ rating: 5, title: "", body: "" });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get(`/catalog/products/${slug}`).then((r) => {
      setP(r.data);
      // load reviews + wishlist state once product is known
      api.get(`/products/${r.data.id}/reviews`).then((rr) => setReviews(rr.data)).catch(() => {});
      if (user) {
        api.get("/wishlist").then((w) => setWished(!!w.data.items.find((x) => x.id === r.data.id))).catch(() => {});
      }
    });
  }, [slug, user]);
  if (!p) return <div className="max-w-7xl mx-auto p-8 text-gray-500">Loading...</div>;
  const qty = items[p.id]?.qty || 0;
  const discount = p.discount_percent || (p.mrp > p.price ? Math.round((1 - p.price / p.mrp) * 100) : 0);
  const outOfStock = !p.in_stock || p.stock === 0;

  const toggleWishlist = async () => {
    if (!user) { toast.error("Login to save items"); return; }
    try {
      if (wished) { await api.delete(`/wishlist/${p.id}`); setWished(false); toast.success("Removed from wishlist"); }
      else { await api.post(`/wishlist/${p.id}`); setWished(true); toast.success("Saved to wishlist ❤"); }
    } catch { toast.error("Failed"); }
  };

  const submitReview = async () => {
    if (!user) { toast.error("Login to leave a review"); return; }
    setSubmitting(true);
    try {
      await api.post(`/products/${p.id}/reviews`, reviewForm);
      toast.success("Review submitted — awaiting moderation");
      setReviewForm({ rating: 5, title: "", body: "" });
    } catch (e) { toast.error(e.response?.data?.detail || "Failed"); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid md:grid-cols-2 gap-8" data-testid="product-detail">
      <Helmet title={p.name} />
      <div className="rounded-2xl bg-gray-50 aspect-square overflow-hidden">
        <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
      </div>

      <div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          {p.brand && <span className="bg-gray-100 px-2 py-0.5 rounded-md font-bold uppercase text-[10px] tracking-wider">{p.brand}</span>}
          <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />Delivery in ~{p.eta_minutes || 12} min</span>
          {p.express_eligible && <span className="inline-flex items-center gap-1 bg-[#FDE6EA] text-[#E4002B] font-bold text-[10px] uppercase px-1.5 py-0.5 rounded-md"><Zap className="h-3 w-3" /> Express</span>}
        </div>

        <h1 className="mt-2 font-display text-3xl font-bold">{p.name}</h1>
        <div className="flex items-center gap-2 mt-1">
          <VegMark type={p.veg_type} size={16} />
          <span className="text-sm text-gray-500">{p.pack_size}</span>
          {reviews.count > 0 && (
            <span className="ml-2 inline-flex items-center gap-1 text-sm" data-testid="pd-rating">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
              <b>{reviews.rating}</b><span className="text-gray-500">({reviews.count})</span>
            </span>
          )}
        </div>

        <div className="mt-4 flex items-center gap-3">
          <div className="font-display text-3xl font-extrabold">₹{p.price}</div>
          {p.mrp > p.price && <div className="text-gray-400 line-through">₹{p.mrp}</div>}
          {discount > 0 && <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-md">{discount}% OFF</span>}
        </div>
        {p.per_unit_label && <div className="text-xs text-gray-500 mt-1">{p.per_unit_label}</div>}

        <p className="mt-4 text-sm text-gray-600 leading-relaxed">{p.description}</p>

        <div className="mt-6 flex items-center gap-3 flex-wrap">
          {outOfStock ? (
            <button disabled className="px-6 py-3 text-sm rounded-xl border border-gray-200 text-gray-400 font-bold">Out of stock</button>
          ) : qty === 0 ? (
            <button data-testid="pd-add-btn" onClick={() => add(p)} className="btn-primary px-6 py-3 text-sm">ADD TO CART</button>
          ) : (
            <div className="inline-flex items-center justify-between bg-[#E4002B] text-white rounded-xl h-12 w-36 px-2 font-bold">
              <button onClick={() => remove(p.id)} className="h-12 w-10 flex items-center justify-center"><Minus /></button>
              <span data-testid="pd-qty">{qty}</span>
              <button onClick={() => add(p)} className="h-12 w-10 flex items-center justify-center"><Plus /></button>
            </div>
          )}
          <button data-testid="pd-wishlist-btn" onClick={toggleWishlist}
            className={`h-12 w-12 rounded-xl border flex items-center justify-center ${wished ? "border-[#E4002B] bg-[#FDE6EA]" : "border-gray-200"}`} aria-label="Save to wishlist">
            <Heart className={`h-5 w-5 ${wished ? "text-[#E4002B] fill-[#E4002B]" : "text-gray-500"}`} />
          </button>
        </div>
        {p.stock > 0 && p.stock <= 5 && !outOfStock && <div className="mt-2 text-xs font-semibold text-amber-700">Hurry — only {p.stock} left in stock.</div>}

        {/* FMCG details */}
        <div className="mt-8 bg-white border border-gray-100 rounded-2xl p-4">
          <h3 className="font-display font-bold mb-2 flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-green-600" /> Product information</h3>
          <Row k="Brand" v={p.brand} />
          <Row k="Net quantity" v={`${p.pack_size}`} />
          <Row k="Storage" v={p.storage && p.storage.charAt(0).toUpperCase() + p.storage.slice(1)} />
          <Row k="Country of origin" v={p.country_of_origin} />
          <Row k="Shelf life" v={p.shelf_life_days ? `${p.shelf_life_days} days` : null} />
          <Row k="FSSAI licence" v={p.fssai_no} />
          <Row k="HSN code" v={p.hsn_code} />
          {(p.allergens && p.allergens.length > 0) && <Row k="Allergens" v={p.allergens.join(", ")} />}
        </div>

        {p.nutrition_per_100 && (
          <div className="mt-4 bg-white border border-gray-100 rounded-2xl p-4">
            <h3 className="font-display font-bold mb-2">Nutrition (per 100g/ml)</h3>
            <div className="grid grid-cols-3 gap-2 text-xs">
              {Object.entries(p.nutrition_per_100).map(([k, v]) => (
                <div key={k} className="bg-gray-50 rounded-lg p-2">
                  <div className="uppercase text-[10px] text-gray-500">{k}</div>
                  <div className="font-display font-bold">{v}{["calories"].includes(k) ? " kcal" : "g"}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reviews */}
        <div className="mt-6 bg-white border border-gray-100 rounded-2xl p-4" data-testid="pd-reviews-block">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-display font-bold flex items-center gap-2"><Star className="h-4 w-4 text-amber-400 fill-amber-400" />Ratings & reviews</h3>
            {reviews.count > 0 && <span className="text-sm font-semibold">{reviews.rating} ★ <span className="text-gray-400 font-normal">({reviews.count})</span></span>}
          </div>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {reviews.reviews.map((r) => (
              <div key={r.id} className="border-t border-gray-50 pt-2" data-testid={`review-${r.id}`}>
                <div className="flex items-center gap-2 text-sm">
                  <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded text-xs font-bold">{r.rating} ★</span>
                  <span className="font-semibold">{r.title || "Review"}</span>
                  {r.verified_purchase && <span className="text-[10px] uppercase bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">Verified</span>}
                </div>
                <p className="text-xs text-gray-600 mt-1">{r.body}</p>
                <div className="text-[10px] text-gray-400 mt-0.5">— {r.author} · {new Date(r.created_at).toLocaleDateString("en-IN")}</div>
              </div>
            ))}
            {!reviews.reviews.length && <div className="text-xs text-gray-400">No reviews yet. Be the first to share your experience.</div>}
          </div>
          <div className="border-t border-gray-100 mt-3 pt-3">
            <div className="text-xs font-semibold mb-1">Write a review</div>
            <div className="flex items-center gap-1 mb-2">
              {[1, 2, 3, 4, 5].map((s) => (
                <button key={s} data-testid={`pd-star-${s}`} onClick={() => setReviewForm({ ...reviewForm, rating: s })} className="p-0.5">
                  <Star className={`h-5 w-5 ${s <= reviewForm.rating ? "fill-amber-400 text-amber-400" : "text-gray-300"}`} />
                </button>
              ))}
            </div>
            <input data-testid="pd-review-title" value={reviewForm.title} onChange={(e) => setReviewForm({ ...reviewForm, title: e.target.value })} placeholder="Title (optional)" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm mb-2" />
            <textarea data-testid="pd-review-body" rows={2} value={reviewForm.body} onChange={(e) => setReviewForm({ ...reviewForm, body: e.target.value })} placeholder="Tell others what you think" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
            <button data-testid="pd-submit-review" disabled={submitting} onClick={submitReview} className="mt-2 btn-primary py-2 px-4 text-sm disabled:opacity-60">{submitting ? "Submitting…" : "Submit review"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
