import React from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { LayoutDashboard, ShoppingBag, MapPin, QrCode, ListChecks, Users, LogOut, Package } from "lucide-react";
import { Helmet } from "../../components/Helmet";

const NAV = [
  { to: "/admin", icon: LayoutDashboard, label: "Dashboard", end: true },
  { to: "/admin/orders", icon: ShoppingBag, label: "Orders (OMS)" },
  { to: "/admin/payment-queue", icon: ListChecks, label: "Payment verification" },
  { to: "/admin/pincodes", icon: MapPin, label: "Serviceable PINs" },
  { to: "/admin/qr-codes", icon: QrCode, label: "UPI QR codes" },
  { to: "/admin/products", icon: Package, label: "Catalog" },
  { to: "/admin/users", icon: Users, label: "Users & roles" },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (user === undefined) return <div className="p-8">Loading…</div>;
  if (!user || !["super_admin", "admin", "operations"].includes(user.role)) {
    return (
      <div className="p-8" data-testid="admin-unauth">
        Please <Link to="/admin/login" className="text-[#E4002B]">login as staff</Link>.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" data-testid="admin-layout">
      <Helmet title="Admin" />
      <div className="flex">
        <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-gray-100 min-h-screen p-4">
          <Link to="/" className="flex items-center gap-2 mb-6">
            <img src="/icons/vfast-logo.png" alt="VFast" className="h-9 w-9 rounded-lg" />
            <div>
              <div className="font-display font-extrabold text-[#E4002B] text-lg leading-none">VFast</div>
              <div className="text-[10px] uppercase tracking-wider text-gray-500">Admin console</div>
            </div>
          </Link>
          <nav className="space-y-1">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                data-testid={`nav-${n.to.replace(/\//g, "-")}`}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold ${isActive ? "bg-[#FDE6EA] text-[#E4002B]" : "text-gray-700 hover:bg-gray-50"}`
                }
              >
                <n.icon className="h-4 w-4" /> {n.label}
              </NavLink>
            ))}
          </nav>
          <button onClick={() => { logout(); navigate("/admin/login"); }} data-testid="admin-logout"
            className="mt-auto flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg">
            <LogOut className="h-4 w-4" /> Logout
          </button>
        </aside>

        <div className="flex-1 min-w-0">
          <header className="bg-white border-b border-gray-100 px-4 sm:px-6 py-3 flex items-center justify-between">
            <div className="font-semibold text-sm text-gray-600">Signed in as <span className="text-gray-900">{user.email}</span> · <span className="uppercase text-xs bg-gray-100 px-2 py-0.5 rounded-md">{user.role}</span></div>
            <Link to="/" className="text-sm text-[#E4002B] font-semibold">← View store</Link>
          </header>
          <main className="p-4 sm:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
