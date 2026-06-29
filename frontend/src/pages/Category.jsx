import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import api from "../lib/api";
import ProductCard from "../components/ProductCard";
import { Helmet } from "../components/Helmet";
import { Filter, X } from "lucide-react";

export default function Category() {
  const { slug } = useParams();
  const [category, setCategory] = useState(null);
  const [subs, setSubs] = useState([]);
  const [activeSub, setActiveSub] = useState(null);
  const [products, setProducts] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState({
    brand: "", veg: "", min_price: "", max_price: "", min_discount: "", in_stock: false, sort: "",
  });

  // load category + subcategories
  useEffect(() => {
    setActiveSub(null);
    api.get(`/catalog/categories/${slug}`).then(r => {
      setCategory(r.data);
      setSubs(r.data.subcategories || []);
    });
    api.get(`/catalog/brands?category=${slug}`).then(r => setBrands(r.data));
  }, [slug]);

  // load products with filters
  useEffect(() => {
    const target = activeSub || slug;
    setLoading(true);
    const params = new URLSearchParams({ category: target, limit: "120" });
    Object.entries(filters).forEach(([k, v]) => { if (v !== "" && v !== false && v !== null) params.append(k, v); });
    api.get(`/catalog/products?${params}`).then(r => setProducts(r.data)).finally(() => setLoading(false));
  }, [slug, activeSub, filters]);

  const clearFilters = () => setFilters({ brand: "", veg: "", min_price: "", max_price: "", min_discount: "", in_stock: false, sort: "" });
  const activeFilterCount = useMemo(() => Object.values(filters).filter(v => v !== "" && v !== false).length, [filters]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6" data-testid="category-page">
      <Helmet title={category?.name || "Category"} />
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold">{category?.name || "Products"}</h1>
          <div className="text-sm text-gray-500 mt-1">{products.length} item{products.length === 1 ? "" : "s"}</div>
        </div>
        <button data-testid="open-filters" onClick={() => setFiltersOpen(true)} className="lg:hidden inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-sm font-semibold">
          <Filter className="h-4 w-4" /> Filters {activeFilterCount > 0 && <span className="bg-[#E4002B] text-white text-[10px] rounded-full px-1.5">{activeFilterCount}</span>}
        </button>
      </div>

      {/* Subcategory chips */}
      {subs.length > 0 && (
        <div className="mt-4 flex gap-2 overflow-x-auto pb-2 -mx-1 px-1" data-testid="sub-chips">
          <button data-testid="sub-chip-all" onClick={() => setActiveSub(null)} className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border ${!activeSub ? "bg-[#E4002B] text-white border-[#E4002B]" : "bg-white text-gray-700 border-gray-200"}`}>All</button>
          {subs.map(s => (
            <button key={s.id} data-testid={`sub-chip-${s.slug}`} onClick={() => setActiveSub(s.slug)} className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border ${activeSub === s.slug ? "bg-[#E4002B] text-white border-[#E4002B]" : "bg-white text-gray-700 border-gray-200"}`}>{s.name}</button>
          ))}
        </div>
      )}

      <div className="mt-4 grid lg:grid-cols-[240px_1fr] gap-6">
        {/* Filters sidebar (desktop) */}
        <aside className="hidden lg:block bg-white border border-gray-100 rounded-2xl p-4 h-fit sticky top-24">
          <FiltersPanel filters={filters} setFilters={setFilters} brands={brands} clearFilters={clearFilters} activeFilterCount={activeFilterCount} />
        </aside>

        <div>
          {/* sort row */}
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs text-gray-500">{loading ? "Loading…" : `${products.length} products`}</div>
            <select data-testid="sort-select" value={filters.sort} onChange={(e) => setFilters({ ...filters, sort: e.target.value })} className="px-3 py-2 rounded-xl border border-gray-200 text-xs">
              <option value="">Sort: Relevance</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="discount">Discount %</option>
              <option value="newest">Newest</option>
            </select>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {loading ? Array.from({ length: 8 }).map((_, i) => (<div key={i} className="aspect-square rounded-2xl shimmer" />)) :
              products.length === 0 ? <div className="col-span-full text-gray-500 py-12 text-center">No products match your filters. <button onClick={clearFilters} className="text-[#E4002B] font-semibold ml-2">Reset filters</button></div> :
              products.map(p => <ProductCard key={p.id} product={p} />)}
          </div>
        </div>
      </div>

      {/* Mobile filters drawer */}
      {filtersOpen && (
        <div className="fixed inset-0 z-[60] bg-black/40 lg:hidden" onClick={() => setFiltersOpen(false)}>
          <div className="absolute right-0 top-0 h-full w-80 max-w-[85%] bg-white p-5 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="font-display font-bold text-lg">Filters</div>
              <button data-testid="close-filters" onClick={() => setFiltersOpen(false)}><X /></button>
            </div>
            <FiltersPanel filters={filters} setFilters={setFilters} brands={brands} clearFilters={clearFilters} activeFilterCount={activeFilterCount} />
          </div>
        </div>
      )}
    </div>
  );
}

function FiltersPanel({ filters, setFilters, brands, clearFilters, activeFilterCount }) {
  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-center justify-between">
        <div className="font-display font-bold">Filters</div>
        {activeFilterCount > 0 && <button data-testid="clear-filters" onClick={clearFilters} className="text-xs text-[#E4002B] font-semibold">Clear ({activeFilterCount})</button>}
      </div>
      <div>
        <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Dietary</div>
        <div className="flex flex-wrap gap-1">
          {[
            { v: "", label: "All" },
            { v: "veg", label: "Veg" },
            { v: "vegan", label: "Vegan" },
            { v: "nonveg", label: "Non-Veg" },
          ].map(o => (
            <button key={o.label} data-testid={`filter-veg-${o.label.toLowerCase()}`} onClick={() => setFilters({ ...filters, veg: o.v })}
              className={`px-2.5 py-1 rounded-full text-xs border ${filters.veg === o.v ? "bg-[#E4002B] text-white border-[#E4002B]" : "bg-white border-gray-200"}`}>{o.label}</button>
          ))}
        </div>
      </div>
      <div>
        <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Brand</div>
        <select data-testid="filter-brand" value={filters.brand} onChange={(e) => setFilters({ ...filters, brand: e.target.value })}
          className="w-full px-3 py-2 rounded-xl border border-gray-200">
          <option value="">All brands</option>
          {brands.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
      </div>
      <div>
        <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Price (₹)</div>
        <div className="flex gap-2">
          <input data-testid="filter-min-price" inputMode="numeric" placeholder="Min" value={filters.min_price}
            onChange={(e) => setFilters({ ...filters, min_price: e.target.value.replace(/\D/g, "") })}
            className="w-1/2 px-3 py-2 rounded-xl border border-gray-200" />
          <input data-testid="filter-max-price" inputMode="numeric" placeholder="Max" value={filters.max_price}
            onChange={(e) => setFilters({ ...filters, max_price: e.target.value.replace(/\D/g, "") })}
            className="w-1/2 px-3 py-2 rounded-xl border border-gray-200" />
        </div>
      </div>
      <div>
        <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Min discount %</div>
        <input data-testid="filter-discount" inputMode="numeric" placeholder="e.g. 10" value={filters.min_discount}
          onChange={(e) => setFilters({ ...filters, min_discount: e.target.value.replace(/\D/g, "") })}
          className="w-full px-3 py-2 rounded-xl border border-gray-200" />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input data-testid="filter-instock" type="checkbox" checked={filters.in_stock} onChange={(e) => setFilters({ ...filters, in_stock: e.target.checked })} />
        In-stock only
      </label>
    </div>
  );
}

export function SearchPage() {
  const [params] = useSearchParams();
  const q = params.get("q") || "";
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    api.get(`/catalog/products?q=${encodeURIComponent(q)}`).then(r => setProducts(r.data)).finally(() => setLoading(false));
  }, [q]);
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" data-testid="search-page">
      <Helmet title={`Search · ${q}`} />
      <h1 className="font-display text-2xl font-bold">Results for "{q}"</h1>
      <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
        {loading ? Array.from({ length: 5 }).map((_, i) => (<div key={i} className="aspect-square rounded-2xl shimmer" />)) :
          products.length === 0 ? <div className="col-span-full text-gray-500">No products match your search.</div> :
          products.map(p => <ProductCard key={p.id} product={p} />)}
      </div>
    </div>
  );
}
