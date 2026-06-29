import React, { useEffect, useState } from "react";
import { Helmet } from "../components/Helmet";
import api from "../lib/api";
import CategoryTile from "../components/CategoryTile";
import ProductCard from "../components/ProductCard";
import { useI18n } from "../lib/i18n";
import { useLocation as useLoc } from "../context/LocationContext";
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";

export default function Home() {
  const { t } = useI18n();
  const { pincode, serviceability } = useLoc();
  const { user } = useAuth();
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [banners, setBanners] = useState([]);
  const [buyAgain, setBuyAgain] = useState([]);

  useEffect(() => {
    api.get("/catalog/categories").then((r) => setCategories(r.data));
    api.get("/catalog/products?limit=15&sort=discount").then((r) => setProducts(r.data));
    api.get("/catalog/banners").then((r) => setBanners(r.data));
  }, []);

  useEffect(() => {
    if (user) api.get("/catalog/buy-again").then((r) => setBuyAgain(r.data)).catch(() => {});
    else setBuyAgain([]);
  }, [user]);

  return (
    <div data-testid="home-page">
      <Helmet title="Home" />

      {/* Hero */}
      <section className="bg-gradient-to-br from-[#FDE6EA] via-white to-[#FFF8E7] border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-14 grid md:grid-cols-2 gap-8 items-center">
          <div>
            <span className="pill bg-white text-gray-800 border border-gray-200">
              <span className="bg-[#E4002B] text-white text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-md">{serviceability?.eta_minutes || 10} {t("minutes")}</span>
              Delivery to {pincode || "your door"}
            </span>
            <h1 className="mt-4 text-4xl sm:text-5xl lg:text-6xl font-display font-extrabold tracking-tight text-gray-900">
              Quick delivery in <span className="text-[#E4002B]">10 Minutes</span>
            </h1>
            <p className="mt-3 text-gray-600 max-w-md">
              Atta, oil, milk, snacks, personal care & home essentials — delivered fast across India by VFast, a V-Mart Retail Ltd. company.
            </p>
            <div className="mt-6 flex gap-3">
              <Link to="/c/staples" className="btn-primary px-5 py-3 text-sm" data-testid="hero-shop-now">Shop staples →</Link>
              <Link to="/c/food-beverages" className="px-5 py-3 text-sm rounded-xl border border-gray-200 font-semibold hover:bg-white">Food & beverages</Link>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {banners.slice(0, 2).map((b, i) => (
              <div key={i} className={`rounded-2xl overflow-hidden h-44 md:h-64 relative ${i === 0 ? "col-span-2" : ""}`}>
                <img src={b.image} alt={b.title} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/0 to-transparent" />
                <div className="absolute bottom-3 left-3 right-3 text-white">
                  <div className="font-display font-bold text-lg leading-tight">{b.title}</div>
                  <div className="text-xs opacity-90">{b.subtitle}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10" data-testid="home-categories">
        <h2 className="font-display text-2xl sm:text-3xl font-bold mb-5">Shop by category</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
          {categories.map((c) => <CategoryTile key={c.id} cat={c} />)}
        </div>
      </section>

      {/* Buy again */}
      {buyAgain.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6" data-testid="buy-again">
          <h2 className="font-display text-2xl font-bold mb-5">Buy again</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
            {buyAgain.map(p => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}

      {/* Best deals */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="flex items-end justify-between mb-5">
          <h2 className="font-display text-2xl sm:text-3xl font-bold">Best deals on essentials</h2>
          <Link to="/c/food-beverages" className="text-sm text-[#E4002B] font-semibold">View all →</Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
          {products.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      </section>
    </div>
  );
}
