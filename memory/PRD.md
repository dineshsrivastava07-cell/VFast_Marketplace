# VFast Marketplace — PRD

## Original problem statement
Build VFast — a 10-minute quick-commerce FMCG marketplace owned by V-Mart Retail Ltd. (India only). Web responsive PWA + Expo mobile (later) + enterprise admin panel on a shared FastAPI/MongoDB backend. 6 RBAC roles, COD + UPI-QR payments with proof upload + admin verification, DPDP-ready, audit logs.

## What's been implemented

### Phase 1 — Customer storefront (2026-02-XX)
- Customer PWA with +91 OTP login (mock SMS, dev_code in response), FMCG catalog (6 top categories, 53 subcategories, ~50 realistic Indian FMCG products with brand / pack / unit / veg-type / FSSAI / HSN / nutrition / allergens / storage / country / shelf life), filters (brand/dietary/price/discount/in-stock), sort, search, cart, checkout with COD or UPI-QR (proof upload + UTR), live order tracking, English/Hindi i18n, V-Mart red theme PWA installable as "VFast", buy-again section.
- Backend modular FastAPI: auth, catalog, serviceability, cart, orders, payments. JWT + bcrypt for staff; phone OTP for customers.

### Phase 2 — Enterprise admin panel (2026-02-XX)
**13 admin modules, all wired to backend with RBAC + audit log:**
- **Live dashboard** — 6 KPI cards (Orders today, GMV today, Active riders, Pending pay, Low stock, Open tickets), live operations board (status counts), hourly trend chart, today vs yesterday revenue, category-wise sales, quick action buttons.
- **OMS** — Filtered orders (status / payment / search), SLA red/amber/green monitor, exception queue, COD reconciliation, assign-rider dropdown, manual status override with reason, bulk cancel/assign/advance, CSV export.
- **Catalog CRUD** — Categories + products with full FMCG attributes (brand, pack_size, unit, veg_type, FSSAI, HSN, nutrition, allergens, storage, country, shelf life). Product CSV bulk import.
- **Inventory** — Per-product stock + reorder level, low-stock alerts, batch entry with expiry tracking + near-expiry warning.
- **Serviceability** — PIN CRUD with zone + dark-store mapping, CSV bulk import, "Coming soon" waitlist tab.
- **Dark stores & Zones** — Full CRUD; zones map to a store; stores list pincodes + manager + hours.
- **Riders** — List with rider_status (online/offline/on_delivery), today's orders + earnings, lifetime deliveries, KYC fields; add rider modal; admin status toggle.
- **UPI QR** — Global QR + PIN-scoped overrides + preview-by-PIN tool.
- **Roles & permissions (RBAC)** — Per-role module×action matrix (super_admin / admin / operations / seller / delivery_partner / customer). Super Admin can edit; user-role assignment.
- **Audit log** — Searchable (user/action/target/date), CSV export. Every admin write action logged automatically.
- **Settings & feature flags** — App name, support email/phone, DPO contact, maintenance mode; flags for COD/UPI/referrals/wallet/Hindi/DPDP banner; notification templates (sms/email/push) CRUD.
- **Users** — List with role assignments.

Test report iteration_3.json: **100% backend refix tests pass**, all 13 admin pages load without errors, RBAC matrix renders & saves.

## User personas (unchanged)
Customer (India), Super Admin, Admin, Operations, Seller (Phase 3), Delivery Partner (Phase 3).

## Prioritized backlog

### P0 (next phase candidates)
- **Phase 3 — Seller portal + Rider app**: seller onboarding/KYC + catalog control + payouts; rider mobile flow (pickup→drop, proof of delivery, COD cash mark, earnings).
- Customer multi-address book + saved cards (no PG yet).

### P1
- **Phase 4 — Marketing & Finance**: banners CRUD, coupons (% / flat / BOGO / free delivery), campaigns with segmentation + scheduling, push/SMS/email send queue. Finance: GMV reports, settlements, refunds, GST invoicing, exports. Analytics dashboard with charts.
- Reviews & wishlist, referrals, loyalty/credits/wallet.
- Real MSG91 SMS, Resend/SendGrid email, FCM push.

### P2
- **Phase 5 — Compliance & hardening**: DPDP console (consent versioning, erasure requests, grievance officer flow), audit retention policy, security hardening, rate limits, breach notification workflow.
- Expo React Native mobile app (customer + rider).
- Razorpay/UPI intent integration (data model already future-proof).
- Real-time WebSocket updates for OMS / rider.

## Next tasks
1. Push to GitHub repo `VFast_Marketplace` via Emergent Save-to-GitHub (CI workflows already included).
2. Deploy via Emergent Deploy button → live URL.
3. Begin Phase 3 (Seller + Rider) based on user feedback.
