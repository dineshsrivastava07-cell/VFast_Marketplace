# DNS setup for vfast.co.in

This guide configures DNS at GoDaddy so that the production app at
**`vfast.co.in`** points to the Emergent-hosted (or any cloud-hosted)
VFast deployment.

> **Registrar:** GoDaddy  
> **Nameservers in use:** `ns27.domaincontrol.com` · `ns28.domaincontrol.com` (primary = `ns27`).

---

## 1. Records to add

Add the following at **GoDaddy → My Products → DNS → vfast.co.in → Manage DNS**.

Replace the placeholders:
- `[DEPLOYMENT_IP]` — IPv4 of the frontend host (or the `A` value of your hosting provider).
- `[BACKEND_HOST]` — fully-qualified host of the backend (e.g. the Emergent subdomain that exposes FastAPI).

| Type | Host / Name | Value / Points To | TTL | Purpose |
| --- | --- | --- | --- | --- |
| **A** | `@` | `[DEPLOYMENT_IP]` | 600 | Root domain → frontend |
| **CNAME** | `www` | `vfast.co.in` | 600 | `www` redirect to apex |
| **CNAME** | `api` | `[BACKEND_HOST]` | 600 | API subdomain → backend |
| **CNAME** | `admin` | `vfast.co.in` | 600 | Optional vanity subdomain for the admin panel |
| **TXT** | `@` | `v=spf1 include:_spf.google.com -all` | 3600 | SPF for outbound transactional email |
| **TXT** | `_dmarc` | `v=DMARC1; p=quarantine; rua=mailto:dmarc@vfast.co.in` | 3600 | DMARC policy |
| **CAA** | `@` | `0 issue "letsencrypt.org"` | 3600 | Restrict who can issue SSL |

> ✅ Verify with `dig vfast.co.in +short` and `dig api.vfast.co.in +short` after propagation (usually 10–60 min).

---

## 2. Connecting Emergent hosting

If you're using **Emergent** for hosting:

1. In Emergent → your project → **Domains** → click **Add custom domain** and enter `vfast.co.in`.
2. Emergent will issue you a target hostname like `xxxxx-yyyy.preview.emergentagent.com` for **both** the frontend root and an `api.xxxxx-yyyy.preview.emergentagent.com` for the backend service.
3. Set the GoDaddy records:
   - `A @ → [DEPLOYMENT_IP]` (the IP shown in Emergent for the frontend)
   - **OR** if Emergent uses a hostname-only target: `CNAME @ → xxxxx-yyyy.preview.emergentagent.com` *(some providers require ALIAS at apex; GoDaddy supports CNAME flattening via "Forwarding" if needed)*
   - `CNAME api → api.xxxxx-yyyy.preview.emergentagent.com`
4. Click **Verify** in Emergent. Once the verification check succeeds, Emergent provisions HTTPS automatically (Let's Encrypt).
5. In the frontend `.env` for production set:
   ```
   REACT_APP_BACKEND_URL=https://api.vfast.co.in
   ```
   Trigger a rebuild so the new URL is baked into the bundle.

---

## 3. HTTPS / SSL

Two options, depending on your hosting:

### A. Emergent-managed SSL (recommended)
Emergent provisions and renews Let's Encrypt certs automatically once the
domain verification succeeds. No manual steps required after step 2 above.

### B. Self-managed (Let's Encrypt + nginx)
If you self-host (e.g. on a VPS):

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d vfast.co.in -d www.vfast.co.in -d api.vfast.co.in
sudo systemctl status certbot.timer    # renewal cron
```

`certbot` writes the certs to `/etc/letsencrypt/live/vfast.co.in/` and edits
nginx so port 443 is served. Renewals happen automatically (every 90 days).

Sample nginx vhost (apex + api):

```
server {
    server_name vfast.co.in www.vfast.co.in;
    root /var/www/vfast/build;
    index index.html;
    location / { try_files $uri /index.html; }
    listen 443 ssl;
    ssl_certificate     /etc/letsencrypt/live/vfast.co.in/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/vfast.co.in/privkey.pem;
}
server {
    server_name api.vfast.co.in;
    location / { proxy_pass http://127.0.0.1:8001; proxy_set_header Host $host; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; }
    listen 443 ssl;
    ssl_certificate     /etc/letsencrypt/live/vfast.co.in/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/vfast.co.in/privkey.pem;
}
```

---

## 4. Backend env after cutover

Once DNS resolves, update `backend/.env` (or hosting secrets):
```
CORS_ORIGINS=https://vfast.co.in,https://www.vfast.co.in,https://admin.vfast.co.in
```
Restart the backend so the new origins are honoured by the CORS middleware.

---

## 5. Verification checklist

- [ ] `dig vfast.co.in +short` resolves to `[DEPLOYMENT_IP]`
- [ ] `dig api.vfast.co.in +short` resolves to `[BACKEND_HOST]`
- [ ] `curl -I https://vfast.co.in` returns `200` with `strict-transport-security` header
- [ ] `curl https://api.vfast.co.in/api/health` returns `{"status":"ok"}`
- [ ] `https://www.vfast.co.in` redirects to `https://vfast.co.in`
- [ ] Browser address bar shows the V-Mart 🔒 padlock (no mixed content)
- [ ] `https://vfast.co.in/manifest.json` returns the PWA manifest (short_name = `VFast`)
- [ ] In the customer app, login + checkout works against `api.vfast.co.in`
