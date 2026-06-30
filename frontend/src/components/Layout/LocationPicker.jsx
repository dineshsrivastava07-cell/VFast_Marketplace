import React, { useEffect, useRef, useState } from "react";
import { useLocation as useLoc } from "../../context/LocationContext";
import { Loader2, MapPin } from "lucide-react";
import api from "../../lib/api";

const DEMO_PINS = ["110001", "110016", "110024", "201301", "122001"];

export default function LocationPicker({ open, onClose }) {
  const { pincode, setPincode, serviceability, setServiceability, checking, runCheck } = useLoc();
  const [val, setVal] = useState("");
  const [contact, setContact] = useState("");
  const [notified, setNotified] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);
  const resultRef = useRef(null);
  const inputRef = useRef(null);

  // When modal opens: reset to show clean state, pre-fill val with current pincode
  useEffect(() => {
    if (open) {
      setVal(pincode || "");
      setServiceability(null);
      setContact("");
      setNotified(false);
      setHasChecked(false);
      // Focus input on open (helps mobile keyboard appear)
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // (No auto-scroll needed — the modal itself is `max-h-[92vh] overflow-y-auto`
  // so the result is reachable by scrolling within the sheet on any device.)

  if (!open) return null;

  const doCheck = (pin) => {
    if (!/^\d{6}$/.test(pin)) return;
    setHasChecked(true);
    setPincode(pin);   // update context (persists to localStorage)
    runCheck(pin);     // force API call even if same pincode
  };

  const submit = (e) => {
    e.preventDefault();
    doCheck(val);
  };

  const notifyMe = async () => {
    if (!contact || !/^\d{6}$/.test(val)) return;
    await api.post("/serviceability/notify-me", { pincode: val, contact });
    setNotified(true);
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/40 flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        data-testid="location-picker"
        className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-6 m-0 sm:m-4 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-1">
          <MapPin className="h-5 w-5 text-[#E4002B]" />
          <h2 className="text-xl font-display font-bold">Select delivery location</h2>
        </div>
        <p className="text-sm text-gray-500">Enter your 6-digit PIN code to check delivery availability.</p>

        <form onSubmit={submit} className="mt-4 flex gap-2">
          <input
            ref={inputRef}
            data-testid="pincode-input"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={val}
            onChange={(e) => setVal(e.target.value.replace(/\D/g, ""))}
            placeholder="e.g. 110001"
            className="flex-1 px-3 py-3 rounded-xl border-2 border-gray-200 focus:outline-none focus:border-[#E4002B] text-base"
          />
          <button
            type="submit"
            data-testid="pincode-check-btn"
            disabled={val.length !== 6}
            className="btn-primary px-5 py-3 text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Check
          </button>
        </form>

        {/* Quick-tap demo PINs */}
        <div className="mt-3">
          <p className="text-xs text-gray-400 mb-1.5">Quick select (demo PINs):</p>
          <div className="flex flex-wrap gap-1.5">
            {DEMO_PINS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => { setVal(p); doCheck(p); }}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${
                  val === p
                    ? "bg-[#E4002B] text-white border-[#E4002B]"
                    : "bg-gray-50 text-gray-700 border-gray-200 hover:border-[#E4002B] hover:text-[#E4002B]"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        <div ref={resultRef} className="mt-4 min-h-[60px]">
          {checking && (
            <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
              <Loader2 className="h-4 w-4 animate-spin text-[#E4002B]" />
              Checking availability for {val}…
            </div>
          )}
          {hasChecked && !checking && serviceability?.serviceable && (
            <div
              data-testid="serviceable-banner"
              className="bg-green-50 text-green-700 border border-green-200 rounded-xl p-4 text-sm"
            >
              <div className="font-bold text-base">✅ VFast delivers to {serviceability.pincode}!</div>
              <div className="text-xs mt-1 text-green-600">
                ETA ~{serviceability.eta_minutes} min · Delivery fee ₹{serviceability.delivery_fee}
                {serviceability.delivery_fee > 0 ? " (free above ₹199)" : " (free)"}
              </div>
              <button
                onClick={onClose}
                className="mt-3 btn-primary px-5 py-2.5 text-sm font-bold w-full"
                data-testid="start-shopping-btn"
              >
                Start Shopping →
              </button>
            </div>
          )}
          {hasChecked && !checking && serviceability && !serviceability.serviceable && (
            <div
              data-testid="not-serviceable-banner"
              className="bg-amber-50 text-amber-800 border border-amber-200 rounded-xl p-4 text-sm"
            >
              <div className="font-bold">🚀 VFast is coming soon to {serviceability.pincode}!</div>
              <div className="text-xs mt-1">Leave your contact — we&apos;ll notify you when we launch there.</div>
              <div className="flex gap-2 mt-2">
                <input
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder="Email or phone"
                  data-testid="notify-input"
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm"
                />
                <button
                  onClick={notifyMe}
                  data-testid="notify-btn"
                  className="btn-primary px-3 py-2 text-sm"
                >
                  Notify me
                </button>
              </div>
              {notified && <div className="text-xs mt-2 text-green-700 font-semibold">✓ Thanks! We&apos;ll be in touch.</div>}
            </div>
          )}
          {!checking && !serviceability && val.length === 0 && (
            <div className="text-xs text-gray-400 py-2">
              Serviceable areas: Delhi-NCR (110001, 110016, 110024), Noida (201301), Gurugram (122001)
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
