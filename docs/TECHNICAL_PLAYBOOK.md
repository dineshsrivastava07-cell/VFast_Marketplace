# VFast — Technical Playbook

Audience: backend / frontend / devops engineers.

---

## 1. Local development setup

### Option A — Docker (fastest)
```bash
git clone https://github.com/<your-org>/VFast_Marketplace.git
cd VFast_Marketplace
docker compose up --build
```
- Frontend → http://localhost:8080
- Backend  → http://localhost:8001/api/health
- Mongo    → mongodb://localhost:27017 (admin/admin not required)

### Option B — Native
```bash
# 1. MongoDB locally (Mac / Linux)
brew services start mongodb-community     # or: sudo systemctl start mongod

# 2. Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn server:app --reload --port 8001

# 3. Frontend
cd ../frontend
cp .env.example .env       # set REACT_APP_BACKEND_URL=http://localhost:8001
yarn install && yarn start
```

---

## 2. Environment variables

### Backend (`backend/.env`)
| Var | Default | Description |
| --- | --- | --- |
| `MONGO_URL` | `mongodb://localhost:27017` | Mongo connection string |
| `DB_NAME` | `vfast_marketplace` | Database name |
| `CORS_ORIGINS` | `*` (dev) | Comma-separated allowed origins (include `https://vfast.co.in` in prod) |
| `JWT_SECRET` | random | HMAC key for JWT signing (64 hex chars recommended) |
| `SMS_PROVIDER` | `mock` | `mock` (dev), `msg91` (prod) |
| `MSG91_AUTH_KEY` | — | Required when `SMS_PROVIDER=msg91` |
| `SUPER_ADMIN_EMAIL` / `PASSWORD` | seeded | First Super Admin created on startup |
| `ADMIN_EMAIL`, `OPS_EMAIL`, `SELLER_EMAIL`, `RIDER_EMAIL` (+ passwords) | seeded | Other demo staff |
| `DEMO_CUSTOMER_PHONE` | `+919999999999` | Pre-seeded customer for the OTP demo |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | — | Future PG integration (Phase 5) |
| `FCM_SERVER_KEY` | — | Push notifications (Phase 3+) |
| `RESEND_API_KEY` | — | Transactional email (Phase 3+) |

### Frontend (`frontend/.env`)
| Var | Default | Description |
| --- | --- | --- |
| `REACT_APP_BACKEND_URL` | `http://localhost:8001` | API base (must be HTTPS in prod) |
| `REACT_APP_GA4_ID` | — | Google Analytics 4 ID |
| `REACT_APP_SENTRY_DSN` | — | Frontend error reporting |

---

## 3. Database

### Collections
See `/docs/ARCHITECTURE.md` §6 for the full list (24 collections).

### Indexes (created automatically on startup)
```js
db.users.createIndex({email:1}, {unique:true, sparse:true})
db.users.createIndex({phone:1}, {unique:true, sparse:true})
db.products.createIndex({slug:1}, {unique:true})
db.categories.createIndex({slug:1}, {unique:true})
db.serviceable_pincodes.createIndex({pincode:1}, {unique:true})
db.orders.createIndex({order_no:1}, {unique:true})
```

### Connection string formats
| Env | Format |
| --- | --- |
| Local | `mongodb://localhost:27017` |
| Docker compose | `mongodb://mongodb:27017` |
| Atlas | `mongodb+srv://<user>:<pwd>@<cluster>.mongodb.net/vfast_marketplace?retryWrites=true&w=majority` |

---

## 4. Running tests

### Backend
```bash
cd backend
pytest -q                          # unit + API tests
pytest -q -k orders                # only test files matching 'orders'
```

### Frontend
```bash
cd frontend
yarn test --watchAll=false         # Jest tests
```

### E2E (Playwright — Phase 3+)
```bash
yarn dlx playwright install
yarn playwright test
```

CI runs **all of the above** on every PR (`.github/workflows/ci.yml`).

---

## 5. CI/CD pipeline

```
┌────────────┐    PR opened    ┌─────────────────────┐
│  Developer ├────────────────►│ ci.yml              │
└────────────┘                 │  • backend lint     │
                               │  • backend import   │
                               │  • frontend build   │
                               └──────────┬──────────┘
                                          │ pass
                                          ▼
                                   merge to main
                                          │
                                          ▼
                               ┌─────────────────────┐
                               │ deploy.yml          │
                               │  • build artefacts  │
                               │  • build Docker     │
                               │  • POST to hosting  │
                               │     webhook         │
                               └──────────┬──────────┘
                                          ▼
                                   Emergent / VPS
                                   live at vfast.co.in
```

GitHub Secrets required for deploy:
- `REACT_APP_BACKEND_URL`     (`https://api.vfast.co.in`)
- `DEPLOY_WEBHOOK_URL`        (hosting trigger; optional)
- `DEPLOY_WEBHOOK_TOKEN`      (bearer for the webhook)

Watch builds at `github.com/<org>/VFast_Marketplace/actions`.

---

## 6. Deployment (Emergent + vfast.co.in)

1. Connect GitHub: Emergent → Profile → GitHub → authorise → select `VFast_Marketplace`.
2. Click **Deploy** in Emergent. The platform builds both `/frontend` and `/backend`, runs MongoDB as a managed addon, and exposes both via HTTPS at `*.preview.emergentagent.com`.
3. Add the custom domain **`vfast.co.in`** in Emergent → Domains.
4. In GoDaddy DNS, follow `/docs/DNS_SETUP.md` to point records at the Emergent target.
5. Re-deploy with `REACT_APP_BACKEND_URL=https://api.vfast.co.in` and `CORS_ORIGINS=https://vfast.co.in,https://www.vfast.co.in,https://admin.vfast.co.in`.

---

## 7. Adding a new API endpoint

Example: a new "wishlist" endpoint, write-protected to customers only.

```python
# backend/app/routes/wishlist.py
from fastapi import APIRouter, Depends, Request
from ..security import get_current_user, require_roles

router = APIRouter(prefix="/api/wishlist", tags=["wishlist"])

@router.get("/")
async def list_wishlist(request: Request, user=Depends(require_roles("customer"))):
    db = request.state.db
    return await db.wishlists.find({"user_id": user["id"]}, {"_id": 0}).to_list(200)

@router.post("/{product_id}")
async def add_wishlist(product_id: str, request: Request, user=Depends(require_roles("customer"))):
    db = request.state.db
    await db.wishlists.update_one(
        {"user_id": user["id"], "product_id": product_id},
        {"$set": {"user_id": user["id"], "product_id": product_id}},
        upsert=True,
    )
    return {"ok": True}
```

Then **register** in `backend/app/routes/__init__.py` and `backend/server.py` (add to the include_router loop). Write a corresponding `pytest` and a frontend page.

---

## 8. Adding a new frontend page/route

1. Create `/frontend/src/pages/Wishlist.jsx`.
2. Register in `/frontend/src/App.js`:
   ```jsx
   import Wishlist from "./pages/Wishlist";
   ...
   <Route path="/wishlist" element={<StoreShell><Wishlist /></StoreShell>} />
   ```
3. Add navigation entries where needed (e.g. account menu in `Header.jsx`).
4. Add `data-testid` to every interactive element (see `coding_guidelines` in this repo).

---

## 9. Adding Razorpay later (stub)

When the time comes to add a real UPI payment gateway:

1. Add Razorpay keys to backend env (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`).
2. Install `razorpay` in `backend/requirements.txt`.
3. Create `/api/payments/razorpay/order` that creates a Razorpay order and returns the `order_id`.
4. Frontend uses the Razorpay Checkout JS SDK loaded from `https://checkout.razorpay.com/v1/checkout.js`.
5. Configure a Razorpay **webhook** at `https://api.vfast.co.in/api/payments/razorpay/webhook` to mark orders paid automatically (replacing the manual UPI QR verification queue).

The current data model (orders with `payment_method` + `proof` + `payment_status`) is already future-proof for this addition.

---

## 10. FCM push notifications

1. Create a Firebase project, generate a server key & a web push VAPID key.
2. Add `FCM_SERVER_KEY` to backend env; expose `REACT_APP_FCM_VAPID_KEY` in frontend env.
3. Add `firebase-messaging-sw.js` to `/frontend/public/`.
4. Call `messaging.getToken(...)` after the user grants notification permission; persist the token on the user document (`fcm_tokens: [...]`).
5. Send pushes from the backend by POSTing to `https://fcm.googleapis.com/fcm/send` using the seeded `notification_templates` per event.

---

## 11. MSG91 SMS OTP

To swap the mock SMS for real ones:

1. Get an MSG91 auth key and approve an OTP template (DLT). Example body: `Your VFast OTP is {OTP}.`
2. Add to backend env: `SMS_PROVIDER=msg91`, `MSG91_AUTH_KEY=...`, `MSG91_TEMPLATE_ID=...`, `MSG91_SENDER_ID=VFAST`.
3. Update `/app/backend/app/services/sms.py` so `send_otp_sms` calls MSG91's `POST https://control.msg91.com/api/v5/otp` with the user's `+91` number and the OTP variable.
4. Remove `dev_code` from the API response in production builds.

---

## 12. Monitoring & logs

| Log | Where |
| --- | --- |
| Backend app logs (supervisor) | `/var/log/supervisor/backend.*.log` |
| Frontend build (CI) | GitHub Actions → ci.yml |
| Browser console | DevTools |
| Mongo logs | `docker compose logs mongodb` |
| Audit log | `/admin/audit` in the UI, or `audit_logs` collection |

Common errors:
- **401 from API** → JWT expired or missing; check the `Authorization` header.
- **403 from API** → User's role doesn't have the permission; check `/admin/rbac`.
- **CORS error** → origin isn't in `CORS_ORIGINS`. Add it and restart backend.
- **OTP verify always fails** → check time skew + that `otp_codes` document hasn't expired (TTL 10 min).

---

## 13. Security checklist

- [ ] `JWT_SECRET` is ≥ 32 random bytes, stored in env / GitHub Secrets, never in code
- [ ] HTTPS enforced (HSTS header on all responses)
- [ ] CORS origins list is closed (no `*` in production)
- [ ] Rate limits on `/auth/otp/request` (1/min/phone) and `/auth/login` (5/min/IP) — add via FastAPI middleware before launch
- [ ] All admin write endpoints use `require_roles(...)`
- [ ] Audit log written for every admin write (see `log_action`)
- [ ] No PII in URLs (PIN code OK; phone/email always in body)
- [ ] Backend image uploads validated for MIME + 5MB cap
- [ ] No `console.log` of secrets in frontend builds
- [ ] DPDP: data is stored in an India region (`ap-south-1`)
- [ ] Backups: MongoDB daily snapshot retained 30 days (see §15)

---

## 14. GitHub Secrets to configure

In `Settings → Secrets and variables → Actions`:

| Secret | Used by |
| --- | --- |
| `REACT_APP_BACKEND_URL` | deploy.yml |
| `DEPLOY_WEBHOOK_URL` | deploy.yml |
| `DEPLOY_WEBHOOK_TOKEN` | deploy.yml |
| `DOCKERHUB_USERNAME` / `_TOKEN` | (optional) push backend image |

---

## 15. Backup & recovery

| What | How | Retention |
| --- | --- | --- |
| MongoDB | `mongodump --uri $MONGO_URL --out /backup/$(date +%F)` via daily cron | 30 days hot, 1y cold |
| Object storage / uploads | S3 versioning on (when moved off disk) | 1 year |
| Audit logs | Append-only collection; nightly export to S3 | 7 years (compliance) |

Restore drill: every quarter restore the latest snapshot to a staging DB, run a smoke test (`pytest tests/restore`), and document the time-to-restore.

---

## 16. Scaling guide

| Trigger | Action |
| --- | --- |
| Backend CPU > 70% sustained | Add more uvicorn workers (Gunicorn `-w`), then horizontal scale |
| Mongo connections > 80% | Increase connection pool size in `motor`; add read replicas |
| Mongo p95 query latency > 200ms | Add indexes (use `db.currentOp` + profiler) |
| > 5 dark stores | Move per-store inventory to `store_inventory` (already modelled) + region-shard Mongo by `store_id` |
| Push send > 10k/day | Move notification dispatch to a queue worker (Celery + Redis) |
| Customer base > 1M | Add Redis cache for catalog and rate-limit per user/IP |
| Multi-region launch (outside India) | Replicate Mongo, but keep PII region-pinned per DPDP |
