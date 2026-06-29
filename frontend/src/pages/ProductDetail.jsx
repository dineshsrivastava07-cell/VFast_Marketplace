import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../lib/api";
import { useCart } from "../context/CartContext";
import { Plus, Minus, Clock, Zap, ShieldCheck } from "lucide-react";
import { Helmet } from "../components/Helmet";
import VegMark from "../components/VegMark";

const Row = ({ k, v }) => v ? (
  <div className="flex justify-between text-sm py-1.5 border-b border-gray-100 last:border-0"><span className="text-gray-500">{k}</span><span className="font-semibold text-gray-800">{v}</span></div>
) : null;

export default function ProductDetail() {
  const { slug } = useParams();
  const { items, add, remove } = useCart();
  const [p, setP] = useState(null);

  useEffect(() => { api.get(`/catalog/products/${slug}`).then(r => setP(r.data)); }, [slug]);
  if (!p) return <div className="max-w-7xl mx-auto p-8 text-gray-500">Loading...</div>;
  const qty = items[p.id]?.qty || 0;
  const discount = p.discount_percent || (p.mrp > p.price ? Math.round((1 - p.price / p.mrp) * 100) : 0);
  const outOfStock = !p.in_stock || p.stock === 0;

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
        </div>

        <div className="mt-4 flex items-center gap-3">
          <div className="font-display text-3xl font-extrabold">₹{p.price}</div>
          {p.mrp > p.price && <div className="text-gray-400 line-through">₹{p.mrp}</div>}
          {discount > 0 && <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-md">{discount}% OFF</span>}
        </div>
        {p.per_unit_label && <div className="text-xs text-gray-500 mt-1">{p.per_unit_label}</div>}

        <p className="mt-4 text-sm text-gray-600 leading-relaxed">{p.description}</p>

        <div className="mt-6">
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
          {p.stock > 0 && p.stock <= 5 && !outOfStock && <div className="mt-2 text-xs font-semibold text-amber-700">Hurry — only {p.stock} left in stock.</div>}
        </div>

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
      </div>
    </div>
  );
}
