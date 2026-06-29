import React from "react";
import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-gray-100 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 grid grid-cols-2 md:grid-cols-4 gap-8 text-sm">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <img src="/icons/vfast-logo.png" alt="VFast" className="h-8 w-8 rounded-md" />
            <div className="font-display font-extrabold text-[#E4002B] text-lg">VFast</div>
          </div>
          <p className="text-gray-500 text-xs leading-relaxed">
            10-minute delivery of groceries & essentials across India.
          </p>
        </div>
        <div>
          <div className="font-semibold mb-2">Company</div>
          <ul className="space-y-1 text-gray-600 text-xs">
            <li>About V-Mart</li><li>Careers</li><li>Press</li>
          </ul>
        </div>
        <div>
          <div className="font-semibold mb-2">Help</div>
          <ul className="space-y-1 text-gray-600 text-xs">
            <li><Link to="/orders" data-testid="footer-orders">My Orders</Link></li>
            <li>Customer support</li>
            <li>Returns & refunds</li>
          </ul>
        </div>
        <div>
          <div className="font-semibold mb-2">Policies</div>
          <ul className="space-y-1 text-gray-600 text-xs">
            <li>Privacy (DPDP)</li><li>Terms of use</li><li>Grievance officer</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-gray-100 py-4 text-center text-xs text-gray-500">
        © {new Date().getFullYear()} A V-Mart Retail Ltd. company. VFast is available in India only.
      </div>
    </footer>
  );
}
