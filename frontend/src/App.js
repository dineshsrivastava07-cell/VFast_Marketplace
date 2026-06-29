import React from "react";
import "./App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";

import { AuthProvider } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";
import { LocationProvider } from "./context/LocationContext";
import { I18nProvider } from "./lib/i18n";

import Header from "./components/Layout/Header";
import Footer from "./components/Layout/Footer";
import BottomCartBar from "./components/Layout/BottomCartBar";
import CartDrawer from "./components/CartDrawer";

import Home from "./pages/Home";
import Category, { SearchPage } from "./pages/Category";
import ProductDetail from "./pages/ProductDetail";
import Login from "./pages/Login";
import Checkout from "./pages/Checkout";
import Orders from "./pages/Orders";
import OrderDetail from "./pages/OrderDetail";
import Profile from "./pages/Profile";

import AdminLogin from "./pages/Admin/AdminLogin";
import AdminLayout from "./pages/Admin/AdminLayout";
import AdminDashboard from "./pages/Admin/AdminDashboard";
import AdminOrders from "./pages/Admin/AdminOrders";
import AdminPincodes from "./pages/Admin/AdminPincodes";
import AdminQR from "./pages/Admin/AdminQR";
import AdminPaymentQueue from "./pages/Admin/AdminPaymentQueue";
import AdminProducts from "./pages/Admin/AdminProducts";
import AdminUsers from "./pages/Admin/AdminUsers";
import AdminCatalog from "./pages/Admin/AdminCatalog";
import AdminInventory from "./pages/Admin/AdminInventory";
import AdminStores from "./pages/Admin/AdminStores";
import AdminRiders from "./pages/Admin/AdminRiders";
import AdminRBAC from "./pages/Admin/AdminRBAC";
import AdminAudit from "./pages/Admin/AdminAudit";
import AdminSettings from "./pages/Admin/AdminSettings";
import AdminFinance from "./pages/Admin/AdminFinance";
import AdminMarketing from "./pages/Admin/AdminMarketing";
import AdminCRM from "./pages/Admin/AdminCRM";
import AdminAnalytics from "./pages/Admin/AdminAnalytics";
import AdminSellerKYC from "./pages/Admin/AdminSellerKYC";
import AdminDPDP from "./pages/Admin/AdminDPDP";

import SellerLogin from "./pages/Seller/SellerLogin";
import SellerLayout from "./pages/Seller/SellerLayout";
import SellerDashboard from "./pages/Seller/SellerDashboard";
import SellerProducts from "./pages/Seller/SellerProducts";
import SellerOrders from "./pages/Seller/SellerOrders";
import SellerKYC from "./pages/Seller/SellerKYC";
import SellerPayouts from "./pages/Seller/SellerPayouts";

import RiderLogin from "./pages/Rider/RiderLogin";
import RiderApp from "./pages/Rider/RiderApp";

import Wishlist from "./pages/Wishlist";
import CookieBanner from "./components/CookieBanner";

function StoreShell({ children }) {
  return (
    <>
      <Header />
      <main className="min-h-[60vh] pb-24 md:pb-8">{children}</main>
      <BottomCartBar />
      <CartDrawer />
      <CookieBanner />
      <Footer />
    </>
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <I18nProvider>
          <AuthProvider>
            <LocationProvider>
              <CartProvider>
                <Toaster richColors position="top-right" />
                <Routes>
                  {/* Customer storefront */}
                  <Route path="/" element={<StoreShell><Home /></StoreShell>} />
                  <Route path="/c/:slug" element={<StoreShell><Category /></StoreShell>} />
                  <Route path="/search" element={<StoreShell><SearchPage /></StoreShell>} />
                  <Route path="/p/:slug" element={<StoreShell><ProductDetail /></StoreShell>} />
                  <Route path="/login" element={<StoreShell><Login /></StoreShell>} />
                  <Route path="/checkout" element={<StoreShell><Checkout /></StoreShell>} />
                  <Route path="/orders" element={<StoreShell><Orders /></StoreShell>} />
                  <Route path="/orders/:orderNo" element={<StoreShell><OrderDetail /></StoreShell>} />
                  <Route path="/profile" element={<StoreShell><Profile /></StoreShell>} />
                  <Route path="/wishlist" element={<StoreShell><Wishlist /></StoreShell>} />

                  {/* Admin */}
                  <Route path="/admin/login" element={<AdminLogin />} />
                  <Route path="/admin" element={<AdminLayout />}>
                    <Route index element={<AdminDashboard />} />
                    <Route path="orders" element={<AdminOrders />} />
                    <Route path="pincodes" element={<AdminPincodes />} />
                    <Route path="qr-codes" element={<AdminQR />} />
                    <Route path="payment-queue" element={<AdminPaymentQueue />} />
                    <Route path="products" element={<AdminProducts />} />
                    <Route path="catalog" element={<AdminCatalog />} />
                    <Route path="inventory" element={<AdminInventory />} />
                    <Route path="stores" element={<AdminStores />} />
                    <Route path="riders" element={<AdminRiders />} />
                    <Route path="rbac" element={<AdminRBAC />} />
                    <Route path="audit" element={<AdminAudit />} />
                    <Route path="settings" element={<AdminSettings />} />
                    <Route path="users" element={<AdminUsers />} />
                    <Route path="finance" element={<AdminFinance />} />
                    <Route path="marketing" element={<AdminMarketing />} />
                    <Route path="crm" element={<AdminCRM />} />
                    <Route path="analytics" element={<AdminAnalytics />} />
                    <Route path="seller-kyc" element={<AdminSellerKYC />} />
                    <Route path="dpdp" element={<AdminDPDP />} />
                  </Route>

                  {/* Seller portal */}
                  <Route path="/seller/login" element={<SellerLogin />} />
                  <Route path="/seller" element={<SellerLayout />}>
                    <Route index element={<SellerDashboard />} />
                    <Route path="products" element={<SellerProducts />} />
                    <Route path="orders" element={<SellerOrders />} />
                    <Route path="kyc" element={<SellerKYC />} />
                    <Route path="payouts" element={<SellerPayouts />} />
                  </Route>

                  {/* Rider app */}
                  <Route path="/rider/login" element={<RiderLogin />} />
                  <Route path="/rider" element={<RiderApp />} />

                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </CartProvider>
            </LocationProvider>
          </AuthProvider>
        </I18nProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
