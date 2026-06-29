import React from "react";
import { Link } from "react-router-dom";
import { Plus, Minus, Clock, Zap } from "lucide-react";
import { useCart } from "../context/CartContext";
import VegMark from "./VegMark";

export default function ProductCard({ product }) {
  const { items, add, remove } = useCart();
  const inCart = items[product.id]?.qty || 0;
  const discount = product.discount_percent || (product.mrp > product.price
    ? Math.round((1 - product.price / product.mrp) * 100) : 0);
  const outOfStock = !product.in_stock || product.stock === 0;
  const lowStock = product.low_stock || (product.stock > 0 && product.stock <= 5);

  return (
    <div data-testid={`product-card-${product.slug}`} className="product-card relative bg-white border border-gray-100 rounded-2xl p-3 flex flex-col">
      {discount > 0 && (
        <div className="absolute top-0 left-0 bg-green-600 text-white text-[10px] font-bold px-2 py-1 rounded-br-xl rounded-tl-2xl z-10">
          {discount}% OFF
        </div>
      )}
      {product.express_eligible && (
        <div className="absolute top-2 right-2 bg-[#E4002B] text-white text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md z-10 inline-flex items-center gap-0.5">
          <Zap className="h-2.5 w-2.5" /> {product.eta_minutes}m
        </div>
      )}
      <Link to={`/p/${product.slug}`} className="block">
        <div className="aspect-square bg-gray-50 rounded-xl flex items-center justify-center overflow-hidden relative">
          <img src={product.image} alt={product.name} loading="lazy" className={`w-full h-full object-cover ${outOfStock ? "opacity-40" : ""}`} />
          {outOfStock && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/40">
              <span className="bg-gray-800 text-white text-[10px] font-bold uppercase px-2 py-1 rounded-md">Out of stock</span>
            </div>
          )}
        </div>
      </Link>
      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <VegMark type={product.veg_type} />
          {product.brand && <div className="text-[10px] uppercase tracking-wide text-gray-500 font-bold truncate">{product.brand}</div>}
        </div>
        <div className="flex items-center gap-1 text-[10px] text-gray-500 font-medium">
          <Clock className="h-3 w-3" /> {product.eta_minutes || 12}m
        </div>
      </div>
      <Link to={`/p/${product.slug}`} className="mt-1 font-semibold text-sm text-gray-900 line-clamp-2 leading-snug">{product.name}</Link>
      <div className="text-xs text-gray-500">{product.pack_size}</div>
      {product.per_unit_label && (
        <div className="text-[10px] text-gray-400">{product.per_unit_label}</div>
      )}
      {lowStock && !outOfStock && (
        <div className="mt-1 text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-md w-max">
          Only {product.stock} left
        </div>
      )}
      <div className="mt-2 flex items-end justify-between gap-2">
        <div>
          <div className="font-display text-lg font-bold text-gray-900">₹{product.price}</div>
          {product.mrp > product.price && <div className="text-xs text-gray-400 line-through">₹{product.mrp}</div>}
        </div>
        {outOfStock ? (
          <button disabled data-testid={`oos-${product.slug}`} className="h-9 px-3 rounded-lg border border-gray-200 text-gray-400 font-bold text-xs cursor-not-allowed">N/A</button>
        ) : inCart === 0 ? (
          <button
            data-testid={`add-btn-${product.slug}`}
            onClick={() => add(product)}
            className="h-9 px-3 rounded-lg border border-[#E4002B] text-[#E4002B] font-bold text-sm bg-[#E4002B]/5 hover:bg-[#E4002B] hover:text-white transition"
          >ADD</button>
        ) : (
          <div data-testid={`stepper-${product.slug}`} className="flex items-center justify-between bg-[#E4002B] text-white rounded-lg h-9 w-24 px-1 font-bold">
            <button data-testid={`decrement-${product.slug}`} onClick={() => remove(product.id)} className="w-8 h-9 flex items-center justify-center"><Minus className="h-4 w-4" /></button>
            <span data-testid={`qty-${product.slug}`} className="text-sm">{inCart}</span>
            <button data-testid={`increment-${product.slug}`} onClick={() => add(product)} className="w-8 h-9 flex items-center justify-center"><Plus className="h-4 w-4" /></button>
          </div>
        )}
      </div>
    </div>
  );
}
