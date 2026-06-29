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

### Phase 3 — Seller portal + Rider app + Marketing/Finance/CRM/Analytics (2026-06-29)
**18 missing/broken modules delivered in one sweep.** Iteration_5 test report: **33/33 backend tests pass, all 5 new admin pages + seller portal + rider app + customer profile verified.**

- **Admin → Finance** (`/admin/finance`): GMV/revenue summary with daily trend + by-payment-method; COD reconciliation by-rider + per-order mark-collected; seller settlements preview (10% commission) → create → mark-paid with UTR; refunds initiate → complete; GST invoice generator per order; CSV exports for GMV + settlements.
- **Admin → Marketing** (`/admin/marketing`): Banners CRUD, coupons CRUD (percent / flat / free_delivery / BOGO) with min order + max discount + per-user limit + pincode scoping + `validate` endpoint; campaign drafts (SMS/push/email/whatsapp) with segments (all/recent_buyers/inactive/by_pincode); MOCK send (`status="sent_mock"` in `campaign_sends`).
- **Admin → CRM** (`/admin/crm`): Customer list with LTV, AOV, segment (active/inactive/new) and full order history detail panel; support tickets with reply + status flow.
- **Admin → Analytics** (`/admin/analytics`): Revenue overview with previous-period deltas + repeat rate, daily trend bars, top products, top categories, by-pincode.
- **Admin → Seller KYC** (`/admin/seller-kyc`): Review queue + approve/reject with rejection reason.
- **Seller portal** (`/seller`): JWT login → dashboard (today/week GMV + pending fulfilment + KYC banner) → KYC form (GSTIN/PAN/FSSAI + bank) → my products (Add product modal scoped to seller_id) → orders (seller items only, mark-packed) → payouts (settlements view).
- **Rider app** (`/rider`): Mobile-optimized JWT-login PWA. Online/Offline toggle, Available orders tab → Accept → Active tab → Pickup → POD modal (photo upload via existing /payments/upload, recipient name, notes, COD-cash checkbox) → Delivered. Earnings tab shows 14-day daily + total (₹25 per delivery).
- **Customer profile** (`/profile`): Edit name/email + saved addresses CRUD with default toggle and 6-digit PIN validation.

Backend additions: 7 new route modules — `finance.py`, `marketing.py`, `crm.py`, `analytics.py`, `seller.py`, `rider.py`, `customer.py`. All RBAC-guarded (STAFF for reads, ADMINS for writes). New collections: `settlements`, `refunds`, `banners`, `coupons`, `campaigns`, `campaign_sends`, `support_tickets`, `seller_kyc`, `addresses`.

Mocked: SMS / Push / Email campaign send (clearly labelled with `mocked=true`); OTP SMS provider (dev_code returned).

## User personas (unchanged)
Customer (India), Super Admin, Admin, Operations, Seller (Phase 3), Delivery Partner (Phase 3).

## Prioritized backlog

### P0 (next phase candidates)
- DPDP compliance console: versioned consent records, data-rights / erasure request workflow, grievance officer, retention policy enforcement.
- Customer wishlist + reviews + referrals (already in nav, needs UI + endpoints).

### P1
- Real provider integrations: MSG91 SMS, Resend / SendGrid email, FCM push, Twilio WhatsApp Business (campaigns infra already wired, just swap the mock).
- Loyalty / wallet / credits.
- Razorpay or UPI Intent on checkout (data model already supports payment_method extension).

### P2
- **Phase 5 — Compliance & hardening**: audit retention policy, security hardening, rate limits, breach notification workflow.
- Expo React Native mobile app (customer + rider native).
- Real-time WebSocket updates for OMS / rider.

## Next tasks
1. Push to GitHub repo `VFast_Marketplace` via Emergent Save-to-GitHub (CI workflows already included).
2. Deploy via Emergent Deploy button → live URL.
3. Begin DPDP compliance console + real SMS/Email/Push provider wiring once user provides MSG91 / Resend / FCM keys.
