# VFast — System Architecture

A V-Mart Retail Ltd. company · Production domain `vfast.co.in`.

## 1. System overview

```
                            ┌────────────────────────────┐
                            │   Cloudflare / Emergent     │
                            │  TLS · WAF · CDN · Ingress  │
                            └─────────────┬───────────────┘
                                          │ HTTPS
        ┌─────────────────────┬───────────┼───────────┬──────────────────────┐
        │                     │           │           │                      │
        ▼                     ▼           ▼           ▼                      ▼
  ┌───────────┐         ┌───────────┐  ┌───────┐  ┌───────────┐         ┌───────────┐
  │ Customer  │         │  Admin    │  │ Rider │  │ Seller    │         │  Mobile    │
  │ React PWA │         │ React SPA │  │ React │  │ React     │         │  (Expo)    │
  │ (web)     │         │ (web)     │  │ pages │  │ pages     │         │  Phase 3   │
  └─────┬─────┘         └─────┬─────┘  └───┬───┘  └─────┬─────┘         └─────┬─────┘
        │                     │            │            │                     │
        └─────────────────────┴────────────┴────────────┴─────────────────────┘
                                          │
                                          ▼  REST  /api/*
                              ┌───────────────────────────┐
                              │   FastAPI backend (8001)  │
                              │  JWT auth · RBAC · Audit  │
                              │  CORS · Pydantic validate │
                              └───────────────┬───────────┘
                                              │ Motor
                                              ▼
                              ┌───────────────────────────┐
                              │       MongoDB 6           │
                              │ users · products · orders │
                              │ carts · qr_codes ...      │
                              └───────────────────────────┘
```

## 2. Auth flow

```
[Customer]
   │ phone (+91)
   ▼
POST /api/auth/otp/request ──► generate 6-digit OTP, store in otp_codes (TTL 10m), log+SMS
   │
   ◄── 200 {dev_code (mock only)}
   │ user enters OTP
   ▼
POST /api/auth/otp/verify ──► match code, find/create user, issue JWT (HS256, 7-day)
   │
   ◄── 200 {token, user}
   │ axios attaches Authorization: Bearer <token>
   ▼
Every subsequent request ─► get_current_user() decodes JWT → looks up user → request.user
                          ─► require_roles(*roles) dependency checks RBAC

[Staff / Seller / Rider]
POST /api/auth/login {email, password} ──► bcrypt verify → JWT (same)
```

## 3. Order lifecycle

```
Browse ──► /api/catalog/products
Add to cart ──► local CartContext + POST /api/cart/set
Checkout ──► POST /api/orders/ {address, payment_method}
                                   ├─ COD ──────────► status=placed
                                   └─ UPI QR ───────► status=payment_pending + qr_code

UPI QR proof
POST /api/orders/{no}/upi-proof ──► status=payment_verifying

Admin verify
POST /api/admin/orders/{no}/verify-payment {status:verified|rejected}
       │
       ├─ verified ──► payment_status=verified, status=packed
       └─ rejected ──► status=payment_rejected (customer notified)

OMS advance
POST /api/admin/orders/{no}/advance {status: out_for_delivery|delivered}

Rider assignment
POST /api/admin/orders/{no}/assign-rider {rider_id}

Final
delivered  ─► COD orders enter cod-reconciliation; rider marks cash_collected
cancelled  ─► appears in exception queue
```

## 4. Payment flow (UPI QR — no PG)

```
Admin uploads UPI QR ──► POST /api/payments/upload + POST /api/admin/qr-codes
       │                       (global or PIN-scoped)
       ▼
Checkout (customer) ── picks UPI QR ──► order created status=payment_pending, qr embedded
       │
       ▼
Customer scans, pays in their UPI app, uploads screenshot + UTR
       │
POST /api/orders/{no}/upi-proof ──► status=payment_verifying
       │
       ▼
Admin payment-verification queue (manual)
       ├─ verified  ──► fulfillment proceeds
       └─ rejected  ──► customer notified, can retry
```

## 5. Notification flow

```
Order state change ──► template lookup in notification_templates {channel,event}
   │                                                 │
   ├─► sms_provider (mock | msg91)                   │
   ├─► email_provider (Resend / SendGrid)            │   Phase 3+
   └─► push_provider (FCM)                           │
```

For Phase 1+2 the templates are stored and rendered — the actual provider call is **stubbed**.

## 6. Data model (Mongo collections)

| Collection | Key fields | Purpose |
| --- | --- | --- |
| `users` | id, role, email/phone, password_hash, rider_status, kyc | All actors (6 roles) |
| `otp_codes` | phone, code, expires_at | Phone OTP cache |
| `categories` | id, slug, name, parent_id, tint, image | Top & sub categories |
| `products` | id, slug, name, brand, category_id, subcategory_id, price, mrp, pack_size, unit, veg_type, stock, reorder_level, hsn_code, fssai_no, nutrition_per_100, allergens, storage, country_of_origin, shelf_life_days, express_eligible | FMCG catalog |
| `store_inventory` | store_id, product_id, stock, reorder_level | Per-store stock |
| `batches` | id, product_id, batch_no, qty, expiry_date, store_id | Inward + expiry |
| `serviceable_pincodes` | pincode, city, delivery_fee, min_order_value, eta_minutes, zone_id, store_id, active | India PIN allowlist |
| `pincode_waitlist` | pincode, contact | "Coming soon" signups |
| `dark_stores` | id, name, address, pincodes, manager_email, operating_hours | Fulfillment centres |
| `zones` | id, name, pincodes, store_id | PIN groupings |
| `carts` | user_id, items[], pincode | Server cart |
| `orders` | id, order_no, user_id, items, subtotal, total, payment_method, payment_status, status, timeline, qr_code, proof, rider_id, rider_name, eta_minutes | Order ledger |
| `qr_codes` | id, label, upi_id, image_url, scope, pincode, active | UPI QR registry |
| `role_permissions` | role, permissions{module:[actions]} | RBAC matrix |
| `audit_logs` | id, user_email, user_role, action, target_type, target_id, details, at | Tamper-evident log |
| `settings` | id="global", settings, flags | App config |
| `notification_templates` | id, channel, event, subject, body, active | SMS/email/push bodies |
| `support_tickets` | id, user_id, status, … | CRM (Phase 4) |
| `coupons` | id, code, type, value, expires_at | Phase 4 |
| `campaigns` | id, name, segment, schedule | Phase 4 |
| `referrals` | inviter_id, invitee_id, status | Phase 4 |
| `settlements` | seller_id, period, gross, net | Phase 4 |
| `payouts` | rider_id, period, amount, status | Phase 4 |
| `consent_records` | user_id, scope, version, granted_at | DPDP (Phase 5) |

Indexes: `users.email` (unique sparse), `users.phone` (unique sparse), `products.slug`, `categories.slug`, `serviceable_pincodes.pincode`, `orders.order_no`.

## 7. API layer

```
/app/backend/
├── server.py            # FastAPI app, CORS, MongoDB client, startup seed, request.state.db
└── app/
    ├── models.py        # Pydantic schemas, new_id(), now_iso()
    ├── security.py      # bcrypt, JWT, get_current_user, require_roles(...)
    ├── seed.py          # Demo data + default settings/flags/store/zone
    ├── routes/
    │   ├── auth.py            # /api/auth/{otp/request,otp/verify,login,me,logout}
    │   ├── catalog.py         # /api/catalog/{categories,products,brands,banners,buy-again}
    │   ├── serviceability.py  # /api/serviceability/{check,notify-me}
    │   ├── cart.py            # /api/cart/{preview,set,GET,DELETE}
    │   ├── orders.py          # /api/orders/{POST,GET,upi-proof,cancel}
    │   ├── payments.py        # /api/payments/{upload,qr-for-checkout}
    │   ├── admin.py           # Phase-1 admin (dashboard, OMS basics, PIN, QR, products)
    │   ├── admin_more.py      # Phase-2 admin (everything in §10–§17 of /docs/guides/ADMIN_GUIDE.md)
    │   └── misc.py            # /api/{health,i18n/dictionary}
    └── services/
        ├── audit.py           # log_action(db, user, action, target_type, target_id, details)
        ├── permissions.py     # DEFAULT_PERMISSIONS, MODULES, ACTIONS
        └── sms.py             # pluggable provider (mock for now)
```

Cross-cutting:
- **CORS** allow-listed via `CORS_ORIGINS` env (comma-separated).
- **Audit log** is written by every privileged endpoint via `log_action()`.
- **RBAC** enforced via `Depends(require_roles("super_admin", "admin"))` on each route.
- **Validation** via Pydantic models; uploads limited to 5MB and image MIME types.

## 8. RBAC permission matrix

| Module | super_admin | admin | operations | seller | delivery_partner | customer |
| --- | --- | --- | --- | --- | --- | --- |
| dashboard | RWD | RWD | R | R | R | — |
| orders | RWD | RWD | RW | R | RW (own) | R (own) |
| catalog | RWD | RWD | R | RW (own) | — | R |
| inventory | RWD | RWD | RW | RW (own) | — | — |
| pincodes | RWD | RWD | R | — | — | — |
| qr_codes | RWD | RWD | R | — | — | — |
| stores | RWD | RWD | R | — | — | — |
| zones | RWD | RWD | R | — | — | — |
| riders | RWD | RWD | RW | — | RW (self) | — |
| users | RWD | RWD | R | — | — | — |
| **rbac** | RWD | R | — | — | — | — |
| audit | RWD | RWD | R | — | — | — |
| settings | RWD | RWD | R | — | — | — |
| payments | RWD | RWD | RW | — | RW (own) | — |
| campaigns | RWD | RWD | R | — | — | — |

`R = read · W = write · D = delete`. Super Admin can edit this matrix at `/admin/rbac`.

## 9. Infrastructure

```
            ┌──── DNS (GoDaddy) ────┐
            │   vfast.co.in         │
            │   *.vfast.co.in       │
            └──────────┬────────────┘
                       │
        ┌──────────────┴────────────────┐
        │ Emergent managed ingress      │  ← TLS termination, HTTP/2, gzip
        │ (or nginx + Let's Encrypt)    │
        └────┬────────────────┬─────────┘
             │                │
       ┌─────▼─────┐    ┌─────▼─────┐
       │ frontend  │    │ backend   │   ←  Docker containers managed by
       │ nginx +   │    │ FastAPI   │      Emergent / supervisor / k8s
       │ build/    │    │ uvicorn   │
       └───────────┘    └─────┬─────┘
                              │
                        ┌─────▼─────┐
                        │ MongoDB   │  ← Atlas or self-hosted replica set
                        │ (Region:  │     (India for DPDP compliance)
                        │ ap-south) │
                        └───────────┘
```

## 10. Scalability notes

- **Stateless FastAPI** — scale horizontally behind a load balancer; JWT means no session affinity required.
- **MongoDB** — start with a single replica set in `ap-south-1`; add sharding by `pincode` or `store_id` when GMV crosses ~1L orders/day.
- **Catalog reads** — add Redis cache in front of `/api/catalog/products` once read QPS > 1k/s.
- **Image uploads** — currently disk-backed via `/api/static/uploads`. Move to S3/GCS via the Emergent object-storage playbook before public launch.
- **Realtime ops** — add a WebSocket channel for OMS live updates (Phase 4); rider locations via per-2-second updates from the rider app.
- **Multi-region** — keep all PII in `ap-south-1` (DPDP); the static CDN can be edge-distributed.
- **Background jobs** — promote the in-process audit & notification writes to a queue (Celery + Redis or BullMQ) once notification volume crosses ~10k/day.
