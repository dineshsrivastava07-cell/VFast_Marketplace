# VFast — Quick Delivery in 10 Minutes

> **A V-Mart Retail Ltd. company.** Production domain: **[vfast.co.in](https://vfast.co.in)** · India only.

[![build](https://img.shields.io/badge/build-passing-brightgreen)](.github/workflows/ci.yml)
[![license](https://img.shields.io/badge/license-Proprietary-red)](#license)
[![version](https://img.shields.io/badge/version-1.0.0-blue)](memory/PRD.md)

VFast is a full-stack enterprise quick-commerce marketplace (inspired by Blinkit/Zepto) delivering FMCG groceries and essentials in 10 minutes across India.

## Overview

VFast bundles three apps on one FastAPI + MongoDB backend:

| App | Stack | Status |
| --- | --- | --- |
| Customer storefront (PWA) | React 19 + Tailwind + shadcn/ui | ✅ Phase 1 |
| Enterprise admin panel | React 19 (same SPA, `/admin/*` routes) | ✅ Phase 2 |
| Mobile (customer + rider) | React Native + Expo | 🛠 Phase 3 |

Core capabilities (Phase 1 + 2):
- +91 phone OTP login (mock SMS, MSG91-ready), JWT + bcrypt for staff
- FMCG catalog: 6 top categories × 53 subcategories × ~50 demo SKUs with brand / pack / unit / veg-marker / FSSAI / HSN / nutrition / allergens / storage / country / shelf-life
- Cart, checkout, COD & UPI-QR (proof upload + admin verification), live order tracking
- 13 admin modules: live dashboard with KPIs + ops board + charts, OMS with SLA monitor & bulk actions, catalog + inventory CRUD + CSV bulk import, batch/expiry tracking, serviceability with PIN bulk import + waitlist, dark stores + zones, riders, UPI QR upload (global + PIN-scoped + preview), RBAC matrix, audit log, settings + feature flags + notification templates
- 6 RBAC roles with per-role permission matrix and audit log on every admin write

## Tech stack

- **Backend** — FastAPI · Motor (async MongoDB) · PyJWT · bcrypt · Pydantic v2
- **Frontend** — React 19 · Tailwind · shadcn/ui · sonner · lucide-react · axios · React Router 7
- **Database** — MongoDB 6
- **CI/CD** — GitHub Actions
- **Containers** — Docker · docker-compose
- **PWA** — Manifest + installable as "VFast"

## Quick start (local dev)

### Prerequisites
- **Docker** 24+ and Docker Compose (or `docker compose` plugin)
- *(Optional, for native runs)* Node 20+ with **yarn**, Python 3.11+

### Run with Docker Compose
```bash
git clone https://github.com/<your-org>/VFast_Marketplace.git
cd VFast_Marketplace
docker compose up --build
```

- Frontend → http://localhost:8080
- Backend  → http://localhost:8001/api/health
- MongoDB  → mongodb://localhost:27017

### Run natively
```bash
# Backend
cd backend
cp .env.example .env
pip install -r requirements.txt
uvicorn server:app --reload --port 8001

# Frontend (new shell)
cd ../frontend
cp .env.example .env
yarn install && yarn start
```

## Project structure

```
VFast_Marketplace/
├── frontend/          # React PWA (customer + admin SPA)
├── backend/           # FastAPI + MongoDB
├── mobile/            # Expo apps — placeholder, Phase 3
├── admin/             # ← Admin lives INSIDE /frontend (see /frontend/src/pages/Admin/*)
├── docs/              # All product, operations and technical docs
│   ├── DNS_SETUP.md
│   ├── ARCHITECTURE.md
│   ├── OPERATIONS_PLAYBOOK.md
│   ├── TECHNICAL_PLAYBOOK.md
│   └── guides/
│       ├── SUPER_ADMIN_GUIDE.md
│       ├── ADMIN_GUIDE.md
│       ├── OPS_USER_GUIDE.md
│       ├── SELLER_GUIDE.md
│       └── CUSTOMER_GUIDE.md
├── scripts/           # Seeders, CSV templates, utilities
├── .github/workflows/ # CI/CD (test → lint → build → deploy)
├── docker-compose.yml
├── .gitignore
└── README.md
```

> **Note:** The admin panel is implemented as `/admin/*` routes inside the same React SPA at `/frontend`. There is **no separate `/admin` directory** — this keeps shared auth, theme and components in one place.

## Available scripts

### Backend (`/backend`)
| Command | What it does |
| --- | --- |
| `uvicorn server:app --reload --port 8001` | Local dev with hot reload |
| `pip install -r requirements.txt` | Install Python deps |
| `pytest` | Run unit & API tests (Phase 3+) |

### Frontend (`/frontend`)
| Command | What it does |
| --- | --- |
| `yarn start` | Dev server on port 3000 (8080 in Docker) |
| `yarn build` | Production build (`/build`) |
| `yarn test` | Jest unit tests |
| `yarn lint` | ESLint |

## Environment variables

Both `backend/.env.example` and `frontend/.env.example` document every variable. **Highlights**:

| Backend var | Purpose |
| --- | --- |
| `MONGO_URL`, `DB_NAME` | MongoDB connection |
| `JWT_SECRET` | HMAC secret (64 hex chars) |
| `CORS_ORIGINS` | Comma-separated allowed origins (include `https://vfast.co.in`) |
| `SMS_PROVIDER` | `mock` (dev) → `msg91` (prod) |
| `*_EMAIL`, `*_PASSWORD` | Seeded staff accounts (override in prod) |

| Frontend var | Purpose |
| --- | --- |
| `REACT_APP_BACKEND_URL` | Base API URL, e.g. `https://api.vfast.co.in` in prod |

## Deployment

1. **Push to GitHub** — code lives at `github.com/<your-org>/VFast_Marketplace`. CI runs on every PR.
2. **Deploy via Emergent** — the Emergent platform deploys the FastAPI service + the React build behind its managed HTTPS ingress. Subdomain is provisioned automatically.
3. **Point `vfast.co.in` to Emergent** — see [`docs/DNS_SETUP.md`](docs/DNS_SETUP.md) for the exact GoDaddy records.
4. **Switch `REACT_APP_BACKEND_URL`** to `https://api.vfast.co.in` and rebuild.

## Demo accounts (seeded automatically)

| Role | Email / Phone | Password |
| --- | --- | --- |
| Super Admin | super.admin@vfast.local | admin123 |
| Admin | admin@vfast.local | admin123 |
| Operations | ops@vfast.local | ops123 |
| Seller | seller@vfast.local | seller123 |
| Delivery Partner | rider@vfast.local | rider123 |
| Customer (OTP) | +91 99999 99999 | OTP shown on-screen in mock mode |

Serviceable PIN codes for the demo: **110001, 110016, 110024, 201301, 122001** (Delhi-NCR).

## Contributing

1. Create a branch from `main` named `feature/<short-name>` or `fix/<short-name>`.
2. Run linters before pushing — Python (`ruff`) and JS (`eslint`).
3. Write tests for backend endpoints (`pytest`) and front-end critical flows (`@testing-library/react` or Playwright).
4. Open a PR with a description, screenshots for UI changes, and link to the issue.
5. CI must pass before merge.

Code style follows the [Coding Guidelines](memory/PRD.md). Bug fixes don't refactor surrounding code; minimal targeted changes are preferred.

## License

**Proprietary — V-Mart Retail Ltd.** All rights reserved. Unauthorised copying, distribution or modification of any portion of this software is strictly prohibited. For licensing enquiries contact `legal@vmart.local`.

---

Built with 🛒 by V-Mart Retail Ltd. for India. © 2026.
