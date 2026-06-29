import React from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { LayoutDashboard, Package, ShoppingBag, FileText, Wallet, LogOut } from "lucide-react";
import { Helmet } from "../../components/Helmet";

const NAV = [
  { to: "/seller", icon: LayoutDashboard, label: "Dashboard", end: true },
  { to: "/seller/products", icon: Package, label: "My products" },
  { to: "/seller/orders", icon: ShoppingBag, label: "Orders" },
  { to: "/seller/kyc", icon: FileText, label: "KYC" },
  { to: "/seller/payouts", icon: Wallet, label: "Payouts" },
];

export default function SellerLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (user === undefined) return <div className="p-8">Loading…</div>;
  if (!user || user.role !== "seller") {
    return <div className="p-8" data-testid="seller-unauth">Please <Link to="/seller/login" className="text-[#E4002B]">login as seller</Link>.</div>;
  }
  return (
    <div className="min-h-screen bg-gray-50" data-testid="seller-layout">
      <Helmet title="Seller portal" />
      <div className="flex">
        <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-gray-100 min-h-screen p-4">
          <Link to="/" className="flex items-center gap-2 mb-6">
            <img src="/icons/vfast-logo.png" alt="VFast" className="h-9 w-9 rounded-lg" />
            <div>
              <div className="font-display font-extrabold text-[#E4002B] text-lg leading-none">VFast</div>
              <div className="text-[10px] uppercase tracking-wider text-gray-500">Seller portal</div>
            </div>
          </Link>
          <nav className="space-y-1">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} data-testid={`snav-${n.to.replace(/\//g, "-")}`}
                className={({ isActive }) => `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold ${isActive ? "bg-[#FDE6EA] text-[#E4002B]" : "text-gray-700 hover:bg-gray-50"}`}>
                <n.icon className="h-4 w-4" /> {n.label}
              </NavLink>
            ))}
          </nav>
          <button onClick={() => { logout(); navigate("/seller/login"); }} data-testid="seller-logout"
            className="mt-auto flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg">
            <LogOut className="h-4 w-4" /> Logout
          </button>
        </aside>
        <div className="flex-1 min-w-0">
          <header className="bg-white border-b border-gray-100 px-4 sm:px-6 py-3 flex items-center justify-between">
            <div className="font-semibold text-sm text-gray-600">Signed in as <span className="text-gray-900">{user.email}</span> · <span className="uppercase text-xs bg-gray-100 px-2 py-0.5 rounded-md">{user.role}</span></div>
            <Link to="/" className="text-sm text-[#E4002B] font-semibold">← View store</Link>
          </header>
          <main className="p-4 sm:p-6"><Outlet /></main>
          <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-2 flex justify-around z-30">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `flex flex-col items-center gap-0.5 px-2 py-1 text-[10px] font-semibold ${isActive ? "text-[#E4002B]" : "text-gray-500"}`}>
                <n.icon className="h-5 w-5" />{n.label.split(" ")[0]}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>
    </div>
  );
}
