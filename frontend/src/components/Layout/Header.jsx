import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, MapPin, User, ShoppingCart, ChevronDown, Languages } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import { useLocation as useLoc } from "../../context/LocationContext";
import { useI18n } from "../../lib/i18n";
import LocationPicker from "./LocationPicker";

export default function Header() {
  const { user, logout } = useAuth();
  const { itemCount, subtotal, setDrawerOpen } = useCart();
  const { pincode, serviceability } = useLoc();
  const { t, lang, setLang } = useI18n();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [openLoc, setOpenLoc] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const submitSearch = (e) => {
    e.preventDefault();
    if (query.trim()) navigate(`/search?q=${encodeURIComponent(query.trim())}`);
  };

  const eta = serviceability?.eta_minutes || 10;

  return (
    <header
      data-testid="site-header"
      className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-gray-100"
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 sm:gap-6 h-16">
          {/* Logo */}
          <Link to="/" data-testid="brand-logo" className="flex items-center gap-2 shrink-0">
            <img src="/icons/vfast-logo.png" alt="VFast" className="h-10 w-10 rounded-lg" />
            <div className="hidden sm:block leading-tight">
              <div className="font-display font-extrabold text-[#E4002B] text-xl tracking-tight">VFast</div>
              <div className="text-[10px] uppercase tracking-wider text-gray-500 -mt-0.5">by V-Mart</div>
            </div>
          </Link>

          {/* Location pill */}
          <button
            data-testid="location-pill"
            onClick={() => setOpenLoc(true)}
            className="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-gray-50 transition border border-gray-100"
          >
            <span className="bg-[#E4002B] text-white text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-md">{eta} {t("minutes")}</span>
            <MapPin className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-semibold text-gray-800">
              {pincode ? `${t("delivery_to")} ${pincode}` : "Set delivery location"}
            </span>
            <ChevronDown className="h-4 w-4 text-gray-400" />
          </button>

          {/* Search */}
          <form onSubmit={submitSearch} className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                data-testid="search-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("search_placeholder")}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-sm focus:outline-none focus:border-[#E4002B] focus:ring-2 focus:ring-[#E4002B]/10"
              />
            </div>
          </form>

          {/* Language */}
          <button
            data-testid="lang-toggle"
            onClick={() => setLang(lang === "en" ? "hi" : "en")}
            className="hidden sm:flex items-center gap-1 text-sm font-semibold text-gray-700 hover:text-[#E4002B]"
            title="Switch language"
          >
            <Languages className="h-4 w-4" />
            {lang === "en" ? "EN" : "हि"}
          </button>

          {/* User */}
          <div className="relative">
            <button
              data-testid="account-btn"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-1 text-sm font-semibold text-gray-800 hover:text-[#E4002B]"
            >
              <User className="h-5 w-5" />
              <span className="hidden sm:inline">{user ? (user.name || "Account") : "Login"}</span>
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-44 bg-white border border-gray-100 rounded-xl shadow-lg p-1 z-50">
                {!user ? (
                  <>
                    <Link to="/login" data-testid="menu-login" className="block px-3 py-2 text-sm rounded-lg hover:bg-gray-50">Customer login</Link>
                    <Link to="/admin/login" data-testid="menu-admin-login" className="block px-3 py-2 text-sm rounded-lg hover:bg-gray-50">Staff / Admin login</Link>
                  </>
                ) : user.role === "customer" ? (
                  <>
                    <Link to="/profile" data-testid="menu-profile" className="block px-3 py-2 text-sm rounded-lg hover:bg-gray-50">My profile</Link>
                    <Link to="/orders" data-testid="menu-orders" className="block px-3 py-2 text-sm rounded-lg hover:bg-gray-50">My Orders</Link>
                    <Link to="/wishlist" data-testid="menu-wishlist" className="block px-3 py-2 text-sm rounded-lg hover:bg-gray-50">My Wishlist</Link>
                    <button data-testid="menu-logout" onClick={() => { logout(); setMenuOpen(false); navigate("/"); }} className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-gray-50">Logout</button>
                  </>
                ) : (
                  <>
                    {(user.role === "super_admin" || user.role === "admin" || user.role === "operations") && (
                      <Link to="/admin" data-testid="menu-admin" className="block px-3 py-2 text-sm rounded-lg hover:bg-gray-50">Open Admin Panel</Link>
                    )}
                    {user.role === "seller" && (
                      <Link to="/seller" data-testid="menu-seller" className="block px-3 py-2 text-sm rounded-lg hover:bg-gray-50">Open Seller Portal</Link>
                    )}
                    {user.role === "delivery_partner" && (
                      <Link to="/rider" data-testid="menu-rider" className="block px-3 py-2 text-sm rounded-lg hover:bg-gray-50">Open Rider App</Link>
                    )}
                    <button data-testid="menu-logout" onClick={() => { logout(); setMenuOpen(false); navigate("/admin/login"); }} className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-gray-50">Logout</button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Cart */}
          <button
            data-testid="cart-btn"
            onClick={() => setDrawerOpen(true)}
            className="hidden sm:flex items-center gap-2 btn-primary px-4 py-2 text-sm"
          >
            <ShoppingCart className="h-4 w-4" />
            <span>{itemCount} item{itemCount === 1 ? "" : "s"}</span>
            <span className="opacity-90">· ₹{Math.round(subtotal)}</span>
          </button>
        </div>

        {/* Mobile location row */}
        <button
          data-testid="location-pill-mobile"
          onClick={() => setOpenLoc(true)}
          className="md:hidden flex items-center gap-2 pb-3 -mt-1"
        >
          <span className="bg-[#E4002B] text-white text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-md">{eta} {t("minutes")}</span>
          <span className="text-sm font-semibold text-gray-800 truncate">
            {pincode ? `${t("delivery_to")} ${pincode}` : "Set delivery location"}
          </span>
          <ChevronDown className="h-4 w-4 text-gray-400" />
        </button>
      </div>

      <LocationPicker open={openLoc} onClose={() => setOpenLoc(false)} />
    </header>
  );
}
