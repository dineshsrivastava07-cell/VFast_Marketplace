# VFast Mobile (Expo) — Placeholder for Phase 3

This directory is reserved for the **VFast** customer and rider mobile apps,
built with **React Native + Expo (SDK 51+)**. The apps will consume the same
FastAPI backend used by the web (see `/backend`).

## Planned structure (Phase 3)

```
mobile/
├── apps/
│   ├── customer/   # Customer-facing app (iOS + Android)
│   └── rider/      # Delivery-partner app
├── packages/
│   ├── api/        # Shared API client (axios + JWT) — same endpoints as web
│   ├── ui/         # Shared UI components
│   └── theme/      # V-Mart red theme tokens (#E4002B)
├── app.config.ts   # Expo config (per-flavor)
└── README.md
```

## Phase 3 scope

- Customer app: OTP login, catalog, cart, checkout, COD/UPI QR with proof, order tracking, push notifications.
- Rider app: KYC onboarding, online/offline toggle, assigned-orders list, pickup → drop with map, delivery OTP, mark COD cash collected.

## Tracking
See `/docs/ARCHITECTURE.md` and `/memory/PRD.md` for the cross-platform plan.
