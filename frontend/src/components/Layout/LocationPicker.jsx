import React, { useState } from "react";
import { useLocation as useLoc } from "../../context/LocationContext";
import { Loader2 } from "lucide-react";
import api from "../../lib/api";

export default function LocationPicker({ open, onClose }) {
  const { pincode, setPincode, serviceability, checking } = useLoc();
  const [val, setVal] = useState(pincode || "");
  const [contact, setContact] = useState("");
  const [notified, setNotified] = useState(false);

  if (!open) return null;
  const submit = (e) => {
    e.preventDefault();
    if (/^\d{6}$/.test(val)) setPincode(val);
  };
  const notifyMe = async () => {
    if (!contact || !/^\d{6}$/.test(val)) return;
    await api.post("/serviceability/notify-me", { pincode: val, contact });
    setNotified(true);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/40 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div data-testid="location-picker" className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-6 m-0 sm:m-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-display font-bold">Select delivery location</h2>
        <p className="text-sm text-gray-500 mt-1">Enter your 6-digit PIN code to see if VFast delivers to you.</p>
        <form onSubmit={submit} className="mt-4 flex gap-2">
          <input
            data-testid="pincode-input"
            inputMode="numeric"
            maxLength={6}
            value={val}
            onChange={(e) => setVal(e.target.value.replace(/\D/g, ""))}
            placeholder="e.g. 110001"
            className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:border-[#E4002B] focus:ring-2 focus:ring-[#E4002B]/10"
          />
          <button type="submit" data-testid="pincode-check-btn" className="btn-primary px-4 py-2.5 text-sm">Check</button>
        </form>

        <div className="mt-4 min-h-[60px]">
          {checking && (
            <div className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Checking...</div>
          )}
          {!checking && serviceability?.serviceable && (
            <div data-testid="serviceable-banner" className="bg-green-50 text-green-700 border border-green-100 rounded-xl p-3 text-sm">
              <div className="font-semibold">Great news! VFast delivers to {serviceability.pincode}.</div>
              <div className="text-xs mt-1">ETA ~{serviceability.eta_minutes} min · Delivery fee ₹{serviceability.delivery_fee} (free above ₹199)</div>
              <button onClick={onClose} className="mt-3 btn-primary px-4 py-2 text-sm" data-testid="start-shopping-btn">Start shopping</button>
            </div>
          )}
          {!checking && serviceability && !serviceability.serviceable && (
            <div data-testid="not-serviceable-banner" className="bg-amber-50 text-amber-800 border border-amber-100 rounded-xl p-3 text-sm">
              <div className="font-semibold">VFast is coming soon to {serviceability.pincode}.</div>
              <div className="text-xs mt-1">Leave your email or phone — we'll notify you when we launch.</div>
              <div className="flex gap-2 mt-2">
                <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="email or phone" data-testid="notify-input"
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm" />
                <button onClick={notifyMe} data-testid="notify-btn" className="btn-primary px-3 py-2 text-sm">Notify me</button>
              </div>
              {notified && <div className="text-xs mt-2 text-green-700">Thanks! We'll be in touch.</div>}
            </div>
          )}
          {!checking && !serviceability && (
            <div className="text-xs text-gray-500">Try a Delhi-NCR PIN like 110001, 110016, 110024, 201301, or 122001 for the demo.</div>
          )}
        </div>
      </div>
    </div>
  );
}
