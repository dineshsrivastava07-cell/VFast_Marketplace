# Admin Guide — VFast

This guide covers everything an **Admin** can do day to day. See the **Super Admin** guide for RBAC and global settings.

## 1. Dashboard & KPIs

Login at `/admin/login` and you land at `/admin`. The dashboard shows six KPI cards at the top:

| KPI | What it means |
| --- | --- |
| Orders today | Count placed since 00:00 today |
| GMV today | Sum of `order.total` for non-cancelled orders today; the small caption shows the % vs yesterday |
| Active riders | Riders whose `rider_status = online` |
| Pending pay | UPI QR orders awaiting your verification |
| Low stock | Products at or below their reorder level |
| Open tickets | Support tickets not yet closed (Phase 4) |

Below the cards: live operations board, hourly orders chart, today-vs-yesterday revenue, and category sales today.

The three top-right buttons jump straight to the work waiting for you.

## 2. Order management (OMS)
**Admin → Orders (OMS)** (`/admin/orders`).

### Filters
- Search box: order number / customer phone / PIN
- Status dropdown: placed, payment_pending, payment_verifying, packed, out_for_delivery, delivered, cancelled, payment_rejected
- Payment dropdown: COD or UPI QR

### SLA monitor
Each row carries a small pill `Xm / Ym` (elapsed vs ETA):
- 🟢 within ETA
- 🟡 50% over ETA
- 🔴 > 1.5× ETA — intervene now

### Per-order actions
- **Rider dropdown** — assigns / reassigns a delivery partner instantly.
- **→ next** button — advances to the next status (`placed → packed → out_for_delivery → delivered`).
- **Override** — choose any status and provide a reason (audited).

### Bulk actions
Tick the checkbox on multiple rows, then in the bulk bar choose:
- **Cancel** with a reason
- **Assign rider** (rider dropdown appears)
- **Advance status** (prompts for the target status)

### Export
**CSV** button downloads up to 5,000 most recent orders.

### Exception queue
The status filter `payment_rejected` and `cancelled` give you the exception view. Phase 3+ adds dedicated views for stockouts and failed deliveries.

## 3. Payment verification (UPI QR)
**Admin → Payment verification** (`/admin/payment-queue`).

Each card shows the customer's screenshot + UTR + total. For each card:
1. Verify the amount and UTR against your UPI app dashboard.
2. Click **Verify** — order auto-advances to `packed`, customer is notified.
3. Or click **Reject** with a reason ("UTR not found", "amount mismatch") — customer is notified to retry.

SLA: every queued order should be touched in ≤ 10 minutes.

## 4. Catalog & inventory

### Catalog
**Admin → Catalog** (`/admin/catalog`)
- **Products tab** — list with quick edit/delete.
- **+ Add product** opens a modal with every FMCG field: slug, name, brand, category, subcategory, image URL, price, MRP, pack size, unit, veg type, stock, reorder level, ETA, HSN, FSSAI, storage, country of origin, shelf life, allergens, description.
- **Categories tab** — view tree of top + sub categories.
- **CSV import** — bulk-load products with columns documented in the panel.

### Inventory
**Admin → Inventory** (`/admin/inventory`)
- **Stock list** tab — edit stock and reorder level inline; click Save.
- **Low stock** tab — list of products at or below reorder level. Triage replenishment from here.
- **Batches** tab — add inward batch entry (product, batch no., qty, expiry); stock is auto-incremented. "Near expiry" list highlights items within 7 days.

## 5. Serviceability & PIN codes
**Admin → Serviceability** (`/admin/pincodes`).

Three tabs:
- **Serviceable PINs** — add a PIN with city, delivery fee, min order value, ETA; optionally map to a zone + dark store. Delete to retire a PIN.
- **Waitlist** — every customer who hit "Notify me" on a non-serviceable PIN. Use it when planning expansion.
- **CSV import** — bulk-load PINs with columns `pincode,city,delivery_fee,min_order_value,eta_minutes,active,zone_id,store_id`.

## 6. Stores & zones
**Admin → Stores & zones** (`/admin/stores`)

- **Dark stores** tab — add / edit / delete a dark store (name, address, list of PINs served, manager email, operating hours).
- **Zones** tab — group PINs together and assign a serving dark store.

## 7. Rider management
**Admin → Riders** (`/admin/riders`)

- See every rider with today's earnings (₹25 per delivery in the demo) and lifetime deliveries.
- The **Status** dropdown lets ops force a rider online / offline / on_delivery.
- **+ Add rider** opens a modal with email, password (default `rider123`), phone, vehicle, PAN, License no., KYC verified.
- Rider mobile app (Phase 3) will let riders manage their own status; until then, ops drives this manually.

## 8. UPI QR upload
**Admin → UPI QR** — see the [Super Admin guide §6](SUPER_ADMIN_GUIDE.md#6-upi-qr-code-management).

## 9. Customer CRM (Phase 4)
Phase 4 adds a dedicated CRM module: customer profiles, segments, support tickets, blocklist, loyalty/credits. Until then use Admin → Users (`/admin/users`) for a basic list.

## 10. Campaigns & coupons (Phase 4)
The Marketing & Campaigns module is on the Phase 4 roadmap. It will include:
- Banner / carousel CRUD
- Coupons: %, flat, BOGO, free-delivery, min-order
- Push / SMS / email scheduled campaigns with customer segmentation
- Referrals & loyalty programmes

Until that ships, edits to the home banners are done via Mongo.

---

For SOPs around picking, packing, dispatch & escalation see [`OPERATIONS_PLAYBOOK.md`](../OPERATIONS_PLAYBOOK.md).
