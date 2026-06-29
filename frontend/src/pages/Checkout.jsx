import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { useLocation as useLoc } from "../context/LocationContext";
import api from "../lib/api";
import { Helmet } from "../components/Helmet";
import { toast } from "sonner";

const STATES = ["Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat","Haryana","Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur","Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana","Tripura","Uttar Pradesh","Uttarakhand","West Bengal","Delhi","Chandigarh","Puducherry","Jammu and Kashmir","Ladakh","Andaman and Nicobar Islands","Dadra and Nagar Haveli and Daman and Diu","Lakshadweep"];

export default function Checkout() {
  const { lines, subtotal, savings, clear } = useCart();
  const { user } = useAuth();
  const { pincode, serviceability } = useLoc();
  const navigate = useNavigate();
  const [addr, setAddr] = useState({
    label: "Home", flat: "", area: "", landmark: "",
    city: serviceability?.city || "New Delhi", state: "Delhi", pincode: pincode || "", phone: user?.phone || "",
  });
  const [payment, setPayment] = useState("cod");
  const [placing, setPlacing] = useState(false);
  const [qr, setQr] = useState(null);

  useEffect(() => {
    setAddr((a) => ({ ...a, pincode: pincode || a.pincode, city: serviceability?.city || a.city, phone: user?.phone || a.phone }));
  }, [pincode, serviceability, user]);

  // Fetch active QR / UPI VPA whenever PIN changes (for the UPI-Intent deep-link)
  useEffect(() => {
    api.get(`/catalog/active-qr${addr.pincode ? `?pincode=${addr.pincode}` : ""}`)
      .then((r) => setQr(r.data))
      .catch(() => setQr(null));
  }, [addr.pincode]);

  if (!user) {
    return <div className="max-w-md mx-auto p-8 text-center" data-testid="checkout-need-login">
      <div className="text-gray-700">Please <a className="text-[#E4002B] font-semibold" href="/login">login</a> to checkout.</div>
    </div>;
  }
  if (lines.length === 0) {
    return <div className="max-w-md mx-auto p-8 text-center text-gray-500" data-testid="checkout-empty">Your cart is empty.</div>;
  }

  const deliveryFee = subtotal >= 199 ? 0 : (serviceability?.delivery_fee ?? 20);
  const total = Math.round(subtotal + deliveryFee);

  const place = async () => {
    if (!addr.flat || !addr.area || !addr.pincode || addr.pincode.length !== 6) {
      toast.error("Please fill in your address completely."); return;
    }
    setPlacing(true);
    try {
      // sync cart to backend
      await api.post("/cart/set", { items: lines.map(l => ({ product_id: l.product.id, qty: l.qty })), pincode: addr.pincode });
      const { data: order } = await api.post("/orders/", { address: addr, payment_method: payment, delivery_slot: "express" });
      clear();
      toast.success(`Order ${order.order_no} placed!`);
      navigate(`/orders/${order.order_no}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Could not place order");
    } finally { setPlacing(false); }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid lg:grid-cols-3 gap-6" data-testid="checkout-page">
      <Helmet title="Checkout" />
      <div className="lg:col-span-2 space-y-6">
        <section className="bg-white border border-gray-100 rounded-2xl p-5">
          <h2 className="font-display text-lg font-bold mb-3">Delivery address</h2>
          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <input data-testid="addr-flat" value={addr.flat} onChange={(e)=>setAddr({...addr, flat:e.target.value})} placeholder="Flat / House no." className="px-3 py-2.5 rounded-xl border border-gray-200" />
            <input data-testid="addr-area" value={addr.area} onChange={(e)=>setAddr({...addr, area:e.target.value})} placeholder="Area / Street" className="px-3 py-2.5 rounded-xl border border-gray-200" />
            <input data-testid="addr-landmark" value={addr.landmark} onChange={(e)=>setAddr({...addr, landmark:e.target.value})} placeholder="Landmark (optional)" className="px-3 py-2.5 rounded-xl border border-gray-200 sm:col-span-2" />
            <input data-testid="addr-city" value={addr.city} onChange={(e)=>setAddr({...addr, city:e.target.value})} placeholder="City" className="px-3 py-2.5 rounded-xl border border-gray-200" />
            <select data-testid="addr-state" value={addr.state} onChange={(e)=>setAddr({...addr, state:e.target.value})} className="px-3 py-2.5 rounded-xl border border-gray-200">
              {STATES.map(s => <option key={s}>{s}</option>)}
            </select>
            <input data-testid="addr-pincode" inputMode="numeric" maxLength={6} value={addr.pincode} onChange={(e)=>setAddr({...addr, pincode:e.target.value.replace(/\D/g,"")})} placeholder="6-digit PIN" className="px-3 py-2.5 rounded-xl border border-gray-200" />
            <input data-testid="addr-phone" value={addr.phone} onChange={(e)=>setAddr({...addr, phone:e.target.value})} placeholder="+91XXXXXXXXXX" className="px-3 py-2.5 rounded-xl border border-gray-200" />
          </div>
        </section>

        <section className="bg-white border border-gray-100 rounded-2xl p-5">
          <h2 className="font-display text-lg font-bold mb-3">Payment</h2>
          <div className="space-y-2">
            <label data-testid="pay-cod" className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer ${payment==="cod"?"border-[#E4002B] bg-[#FDE6EA]":"border-gray-200"}`}>
              <input type="radio" checked={payment==="cod"} onChange={()=>setPayment("cod")} />
              <div>
                <div className="font-semibold text-sm">Cash on Delivery</div>
                <div className="text-xs text-gray-500">Pay with cash to your VFast rider on delivery.</div>
              </div>
            </label>
            <label data-testid="pay-upi" className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer ${payment==="upi_qr"?"border-[#E4002B] bg-[#FDE6EA]":"border-gray-200"}`}>
              <input type="radio" checked={payment==="upi_qr"} onChange={()=>setPayment("upi_qr")} />
              <div className="flex-1">
                <div className="font-semibold text-sm">UPI QR (Scan & Pay)</div>
                <div className="text-xs text-gray-500">Scan our UPI QR with any UPI app, then upload the payment screenshot/UTR on the next screen.</div>
              </div>
            </label>
            {payment === "upi_qr" && qr?.upi_id && (
              <a
                data-testid="pay-upi-intent"
                href={`upi://pay?pa=${encodeURIComponent(qr.upi_id)}&pn=${encodeURIComponent("VFast")}&am=${encodeURIComponent(total)}&cu=INR&tn=${encodeURIComponent("VFast order")}`}
                className="mt-2 ml-7 inline-flex items-center justify-center gap-2 text-sm font-semibold py-2 px-4 rounded-xl border border-[#E4002B] text-[#E4002B] hover:bg-[#FDE6EA]"
              >
                ⚡ Pay via UPI app · ₹{total}
              </a>
            )}
          </div>
        </section>
      </div>

      <aside className="bg-white border border-gray-100 rounded-2xl p-5 h-fit sticky top-24">
        <h3 className="font-display font-bold mb-3">Order summary</h3>
        <div className="space-y-2 text-sm">
          {lines.map(({ product, qty }) => (
            <div key={product.id} className="flex justify-between gap-2">
              <span className="text-gray-700 truncate">{product.name} × {qty}</span>
              <span className="font-semibold">₹{product.price * qty}</span>
            </div>
          ))}
        </div>
        <hr className="my-3"/>
        <div className="flex justify-between text-sm"><span>Subtotal</span><span>₹{Math.round(subtotal)}</span></div>
        <div className="flex justify-between text-sm"><span>Delivery fee</span><span>{deliveryFee === 0 ? <span className="text-green-700 font-semibold">FREE</span> : `₹${deliveryFee}`}</span></div>
        {savings > 0 && <div className="flex justify-between text-sm text-green-700"><span>Savings</span><span>-₹{Math.round(savings)}</span></div>}
        <div className="flex justify-between mt-3 text-lg font-display font-extrabold"><span>Total</span><span>₹{total}</span></div>
        <button data-testid="place-order-btn" onClick={place} disabled={placing} className="mt-4 w-full btn-primary py-3 disabled:opacity-60">
          {placing ? "Placing..." : `Place order · ₹${total}`}
        </button>
      </aside>
    </div>
  );
}
