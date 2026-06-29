# VFast Marketplace — PRD

## Original problem statement
Build VFast, an enterprise-grade quick-commerce (10–30 minute delivery) marketplace owned by V-Mart Retail Ltd. India only. Web responsive PWA + Expo mobile (later) + admin panel on a shared FastAPI/MongoDB backend. 6 roles, COD + UPI-QR payments with proof upload + admin verification, DPDP-ready, RBAC, audit logs. Strong FMCG focus (6 top categories, ~50 subcategories, brand/pack/veg/HSN/FSSAI attributes).

## User personas
1. **Customer (India only)** — wants 10-minute FMCG delivery. Logs in via +91 OTP.
2. **Super Admin / Admin** — operates the whole marketplace, manages PINs, QR codes, orders, catalog, users.
3. **Operations** — handles fulfillment, payment verification, dispatch.
4. **Seller (Phase 3)** — manages own SKUs + payouts.
5. **Delivery Partner / Rider (Phase 3)** — picks up & delivers.

## What's been implemented — 2026-02-XX (Phase 1)
- FastAPI backend with modular routes (`auth`, `catalog`, `serviceability`, `cart`, `orders`, `payments`, `admin`, `misc`) and JWT+RBAC
- Phone OTP login (+91 only, mock SMS, pluggable provider)
- Email+password login for staff/seller/rider with bcrypt-hashed seeded accounts
- FMCG catalog: 6 top categories, 53 subcategories, ~50 realistic Indian FMCG products (Amul, Aashirvaad, Maggi, Lay's, Dove, Surf Excel, Tata Salt, Colgate, Dabur, etc.) with brand, pack size + unit, veg/non-veg/vegan markers, FSSAI, HSN, nutrition, allergens, storage, country of origin, shelf life
- Filters: brand, dietary (veg/vegan/non-veg), price range, min-discount, in-stock; sorts: price asc/desc, discount, newest
- Cart (local + server) with savings, free-delivery threshold (₹199), minimum order check, ETA
- COD + UPI-QR checkout; QR is admin-uploaded (global or per-PIN); customer uploads payment screenshot + UTR → "payment_verifying" → admin verifies/rejects in queue
- Order timeline & live polling on the order detail page
- Admin console: dashboard (GMV, orders, queue, PINs, products), OMS with status advancement, PIN management, QR upload, payment verification queue, users, products
- Buy-again section for logged-in customers based on recent orders
- Serviceability: India-only +91 phone validation, 6-digit PIN allowlist, "Coming soon — notify me" for non-serviceable PINs
- PWA: manifest, V-Mart logo as favicon + OG image, Outfit + Plus Jakarta Sans fonts, brand crimson (#E4002B), light theme, mobile responsive with sticky bottom cart bar
- English / Hindi i18n toggle (backend dictionary)
- GitHub Actions CI (backend lint + import + frontend build) and deploy info workflow
- README + test_credentials seeded
- Demo seed: 5 Delhi-NCR PINs, 1 global QR, demo accounts for all 6 roles

## Prioritized backlog
### P0 (next)
- Coupon engine (% / flat / free-delivery / BOGO)
- Real SMS (MSG91) wiring
- Multi-address book per customer
- Server-side cart price-recompute & inventory hold on order create
### P1
- Seller portal (catalog CRUD, KYC, payouts)
- Rider app (assignment, proof of delivery, earnings)
- Marketing & campaign module (banners CRUD, push/email/SMS templates, segmentation)
- CRM, support tickets, blocklist, loyalty/credits
- Finance: GMV reports, settlements, refunds, GST invoicing, exports
- Analytics dashboard (charts)
### P2
- DPDP console (consent versioning, erasure, grievance officer), audit logs
- Expo React Native mobile app
- FCM push, Resend / SendGrid email
- Real payment gateway (Razorpay / UPI intent) — data model is already future-proof
- Reviews & wishlist, referrals

## Next tasks
1. Push to GitHub repo `VFast_Marketplace` via the Emergent Save-to-GitHub button (CI workflows already included).
2. Deploy via the Emergent Deploy button to get the live URL.
3. Iterate based on user feedback on Phase 2.
